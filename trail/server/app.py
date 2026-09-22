"""Trail API and static server.

    uvicorn trail.server.app:create_app --factory --host 0.0.0.0 --port $PORT

Configuration comes from the environment (see settings.py and .env.example).

Privacy rules, enforced here and tested in tests/test_privacy.py:
  * The service never stores document text. /v1/checkpoint takes chain heads only.
  * /v1/pack takes a full record for one request, builds the evidence pack in memory,
    returns it, and keeps nothing. It logs the user id, the event count and the duration.
  * Request bodies are never logged. The access log records method, path (no query string),
    status and duration.
"""

from __future__ import annotations

import logging
import os
import re
import tempfile
import time
from datetime import timedelta
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, field_validator

from trail import __version__
from trail.chain import verify_chain
from trail.core.signing import Signer
from trail.events import Event
from trail.pack import build_pack, render_html
from trail.record import build_record
from trail.server import billing as billing_mod
from trail.server.clerk import ClerkClient, ClerkVerifier
from trail.server.billing import PLANS, FakeGateway, Gateway, StripeGateway, handle_webhook
from trail.server.mail import ConsoleMailer, Mailer, ResendMailer, magic_link_message
from trail.server.models import schema_description
from trail.server.settings import Settings
from trail.server.store import Store, aware, iso, utcnow

log = logging.getLogger("trail.api")
SESSION_COOKIE = "trail_session"
SESSION_MAX_AGE = 90 * 24 * 3600
REPO_ROOT = Path(__file__).resolve().parents[2]


# ---- helpers ------------------------------------------------------------------------------------


def load_signer(settings: Settings) -> Signer:
    """TRAIL_SIGNING_KEY holds the PEM itself (Railway variables), TRAIL_SIGNING_KEY_PATH a path.
    Without either, a key is generated once and kept in the data dir (local dev only)."""
    if settings.signing_key_pem:
        pem = settings.signing_key_pem.replace("\\n", "\n").strip()
        return Signer.from_pem(pem.encode())
    p = settings.signing_key_path or settings.data_dir / "signing-key.pem"
    if p.exists():
        return Signer.from_pem(p.read_bytes())
    s = Signer.generate()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(s.to_pem())
    os.chmod(p, 0o600)
    (p.parent / "signing-key.pub.pem").write_bytes(s.public_key.to_pem())
    log.warning("generated a new signing key at %s; set TRAIL_SIGNING_KEY in production", p)
    return s


def default_static_dir() -> Path | None:
    env = os.environ.get("STATIC_DIR")
    candidates = [Path(env)] if env else []
    candidates += [Path(__file__).resolve().parent / "static", REPO_ROOT / "web" / "dist"]
    for c in candidates:
        if (c / "index.html").exists():
            return c
    return None


EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def clean_email(v: str) -> str:
    """Lower-case, and drop a +tag so one inbox cannot be many accounts (referral abuse)."""
    v = v.strip().lower()
    if not EMAIL_RE.fullmatch(v) or len(v) > 254:
        raise ValueError("That does not look like an email address.")
    local, domain = v.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if not local:
        raise ValueError("That does not look like an email address.")
    return f"{local}@{domain}"


IP_LINKS_PER_WINDOW = 20
IP_WINDOW_SECONDS = 15 * 60


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---- request models --------------------------------------------------------------------------------


class ClerkSignIn(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    referral: str | None = Field(default=None, max_length=16)


class AuthRequest(BaseModel):
    email: str = Field(max_length=254)
    referral: str | None = Field(default=None, max_length=16)

    @field_validator("email")
    @classmethod
    def _valid(cls, v: str) -> str:
        return clean_email(v)


class CheckpointRequest(BaseModel):
    doc: str = Field(min_length=1, max_length=200)  # the extension's random id for the document
    heads: dict[str, dict[str, Any]]  # session -> {seq, hash, first_ts}


class PackRequest(BaseModel):
    events: list[dict[str, Any]] = Field(max_length=500_000)
    checkpoints: list[dict[str, Any]] = Field(default_factory=list)
    title: str | None = Field(default=None, max_length=200)
    student: str | None = Field(default=None, max_length=200)
    course: str | None = Field(default=None, max_length=200)
    format: str = "json"  # json | html | record


class CheckoutRequest(BaseModel):
    plan: str

    @field_validator("plan")
    @classmethod
    def _plan(cls, v: str) -> str:
        if v not in PLANS:
            raise ValueError("plan must be 'semester' or 'monthly'")
        return v


# ---- app ------------------------------------------------------------------------------------------------


def create_app(
    store: Store | None = None,
    signer: Signer | None = None,
    signup_open: bool | None = None,
    *,
    settings: Settings | None = None,
    mailer: Mailer | None = None,
    gateway: Gateway | None = None,
    static_dir: Path | None = None,
    clerk: ClerkVerifier | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    if signup_open is not None:
        settings.signup_open = signup_open
    if settings.production:
        for problem in settings.missing_for_production():
            log.error("production config missing: %s", problem)
        settings.require_production_config()
    store = store or Store(settings.database_url, secret=settings.session_secret)
    store.free_access = settings.free_access
    signer = signer or load_signer(settings)
    mailer = mailer or (ResendMailer(settings.resend_api_key, settings.resend_from) if settings.resend_api_key else ConsoleMailer())
    if clerk is None:
        clerk = ClerkClient(settings.clerk_publishable_key, settings.clerk_secret_key)
    if gateway is None:
        gateway = StripeGateway(settings.stripe_secret_key, settings.stripe_webhook_secret, settings.stripe_price_semester, settings.stripe_price_monthly)
    static = static_dir if static_dir is not None else default_static_dir()

    if settings.sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(dsn=settings.sentry_dsn, send_default_pii=False, max_request_body_size="never")
        except ImportError:
            log.warning("SENTRY_DSN set but sentry-sdk is not installed")

    app = FastAPI(title="Trail API", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.store = store
    app.state.signer = signer
    app.state.settings = settings
    app.state.mailer = mailer
    app.state.gateway = gateway
    ip_hits: dict[str, list[float]] = {}

    def ip_limited(ip: str) -> bool:
        now = time.time()
        hits = [t for t in ip_hits.get(ip, []) if now - t < IP_WINDOW_SECONDS]
        limited = len(hits) >= IP_LINKS_PER_WINDOW
        if not limited:
            hits.append(now)
        ip_hits[ip] = hits
        if len(ip_hits) > 10_000:  # keep the table bounded
            ip_hits.clear()
        return limited

    # -- access log: method, path, status, duration. Never the query string, never the body. --
    @app.middleware("http")
    async def access_log(request: Request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        if request.url.path.startswith("/v1/") or request.url.path == "/healthz":
            log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code, (time.perf_counter() - t0) * 1000)
        return response

    # -- auth ------------------------------------------------------------------------------------

    def cookie_user(request: Request) -> str | None:
        tok = request.cookies.get(SESSION_COOKIE)
        return store.user_for_session(tok) if tok else None

    def check_origin(request: Request) -> None:
        """Cookie sessions on state-changing requests must come from the app itself."""
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") != settings.app_url and not origin.startswith("http://localhost"):
            raise HTTPException(403, "cross-origin request refused")

    def current_user(request: Request, authorization: str = Header(default="")) -> str:
        if authorization.startswith("Bearer "):
            uid = store.user_for_token(authorization[7:].strip())
            if not uid:
                raise HTTPException(401, "This extension token is no longer valid. Open the app and connect the extension again.")
            return uid
        uid = cookie_user(request)
        if not uid:
            raise HTTPException(401, "Not signed in.")
        check_origin(request)
        return uid

    def entitled_user(uid: str = Depends(current_user)) -> str:
        if not store.is_entitled(uid):
            raise HTTPException(402, "Your 14-day trial has ended. Pick a plan in Settings to keep replay, patterns and packs. "
                                     "Recording, checkpoint signing and raw JSON export are never locked.")
        return uid

    def set_session_cookie(resp: Response, token: str) -> None:
        resp.set_cookie(SESSION_COOKIE, token, max_age=SESSION_MAX_AGE, httponly=True, samesite="lax", secure=settings.secure_cookies, path="/")

    # -- public -------------------------------------------------------------------------------------

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"ok": True, "version": __version__, "key_id": signer.public_key.key_id}

    @app.get("/v1/config")
    def config() -> dict[str, Any]:
        """Public, unauthenticated: what the marketing pages need to say the true thing about pricing."""
        return {"freeAccess": settings.free_access, "billingConfigured": gateway.configured,
                "trialDays": settings.trial_days, "signupOpen": settings.signup_open,
                "clerkPublishableKey": clerk.publishable_key if clerk.configured else None}

    @app.get("/v1/public-key")
    def public_key() -> Response:
        return Response(signer.public_key.to_pem(), media_type="application/x-pem-file")

    @app.get("/v1/transparency")
    def transparency() -> list[dict[str, Any]]:
        return store.transparency_log()

    @app.get("/v1/schema")
    def schema() -> dict[str, Any]:
        """Every table and column the server stores, for /privacy."""
        return {"tables": schema_description()}

    @app.get("/v1/billing/plans")
    def plans() -> dict[str, Any]:
        return {"plans": PLANS, "trialDays": settings.trial_days, "refundDays": settings.refund_days,
                "referralsPerSemester": settings.referrals_per_semester, "configured": gateway.configured}

    # -- magic-link auth ---------------------------------------------------------------------------

    def _request_link(req: AuthRequest, request: Request) -> dict[str, Any]:
        if ip_limited(client_ip(request)):
            raise HTTPException(429, "Too many sign-in links requested from this network. Try again in 15 minutes.")
        referrer = store.user_by_referral_code(req.referral) if req.referral else None
        user, created = store.get_or_create_user(req.email, referred_by=referrer.id if referrer else None, allow_create=settings.signup_open)
        if not user:
            raise HTTPException(403, "Sign-ups are closed right now. If you already have an account, check the address.")
        token = store.create_magic_link(user.id)
        if token is None:
            raise HTTPException(429, "Too many sign-in links requested. Check your inbox, or try again in 15 minutes.")
        link = f"{settings.app_url}/v1/auth/callback?token={token}"
        subject, text, html = magic_link_message(link, first_time=created or user.last_login_at is None)
        try:
            mailer.send(user.email, subject, text, html)
        except Exception:
            log.exception("magic link email failed for user %s", user.id)
            raise HTTPException(502, "We could not send the email. Try again in a minute.")
        return {"sent": True}

    @app.post("/v1/auth/request")
    def auth_request(req: AuthRequest, request: Request) -> dict[str, Any]:
        return _request_link(req, request)

    @app.post("/v1/auth/magic-link")
    def auth_magic_link(req: AuthRequest, request: Request) -> dict[str, Any]:  # alias
        return _request_link(req, request)

    @app.get("/v1/auth/callback")
    def auth_callback(request: Request, token: str = "", format: str = "") -> Response:
        user, first = store.consume_magic_link(token) if token else (None, False)
        if not user:
            if format == "json" or "application/json" in request.headers.get("accept", ""):
                raise HTTPException(401, "This sign-in link has expired or was already used. Request a new one.")
            return RedirectResponse(f"{settings.app_url}/login?error=expired", status_code=303)
        session = store.create_session(user.id)
        if format == "json" or "application/json" in request.headers.get("accept", ""):
            resp: Response = JSONResponse({"user": user.id, "token": store.create_api_token(user.id), "first": first})
        else:
            resp = RedirectResponse(f"{settings.app_url}/app/welcome" if first else f"{settings.app_url}/app?connect=1", status_code=303)
        set_session_cookie(resp, session)
        return resp

    @app.post("/v1/auth/clerk")
    def auth_clerk(req: ClerkSignIn, request: Request) -> Response:
        """Exchange a verified Clerk session token for our session cookie. Clerk holds the
        student's email and login method; the writing record never goes near it."""
        if not clerk.configured:
            raise HTTPException(404, "Clerk sign-in is not enabled on this server.")
        email = clerk.email_for_token(req.token)
        if not email:
            raise HTTPException(401, "Clerk did not accept that sign-in. Try again.")
        referrer = store.user_by_referral_code(req.referral) if req.referral else None
        user, first = store.get_or_create_user(clean_email(email), referred_by=referrer.id if referrer else None, allow_create=settings.signup_open)
        if not user:
            raise HTTPException(403, "Sign-ups are closed right now.")
        session = store.create_session(user.id)
        resp: Response = JSONResponse({"user": user.id, "first": first})
        set_session_cookie(resp, session)
        return resp

    @app.post("/v1/auth/logout")
    def logout(request: Request) -> Response:
        tok = request.cookies.get(SESSION_COOKIE)
        if tok:
            store.delete_session(tok)
        resp = JSONResponse({"ok": True})
        resp.delete_cookie(SESSION_COOKIE, path="/")
        return resp

    @app.post("/v1/auth/extension-token")
    def extension_token(uid: str = Depends(current_user)) -> dict[str, str]:
        """A scoped bearer token the web app hands to the extension (DECISIONS §4)."""
        return {"token": store.create_api_token(uid), "server": settings.app_url}

    # -- me ------------------------------------------------------------------------------------------------

    def me_payload(uid: str) -> dict[str, Any]:
        u = store.get_user(uid)
        if not u:
            raise HTTPException(401, "Not signed in.")
        info = store.plan_info(uid)
        ref = store.referral_summary(uid)
        sub = store.active_subscription(uid)
        refundable = bool(sub and sub.created_at and (utcnow() - aware(sub.created_at)) <= timedelta(days=settings.refund_days))
        return {
            "id": u.id,
            "email": u.email,
            "createdAt": iso(u.created_at),
            "plan": info["plan"],
            "entitled": info["plan"] in ("trial", "semester", "monthly", "free"),
            "trialStartedAt": iso(u.trial_started_at),
            "trialEndsAt": info["trialEndsAt"],
            "currentPeriodEnd": info["currentPeriodEnd"],
            "cancelAtPeriodEnd": bool(sub.cancel_at_period_end) if sub else False,
            "referralCode": ref["code"],
            "referrals": ref["activated"],
            "referralCredits": ref["credits"],
            "freeUntil": ref["freeUntil"],
            "billing": {"configured": gateway.configured, "freeAccess": settings.free_access,
                        "hasCustomer": bool(u.stripe_customer_id), "refundable": refundable},
        }

    @app.get("/v1/me")
    def me(uid: str = Depends(current_user)) -> dict[str, Any]:
        return me_payload(uid)

    @app.delete("/v1/me")
    def delete_me(uid: str = Depends(current_user)) -> Response:
        """Delete every server-side row for this user. Local data on the device is untouched."""
        u = store.get_user(uid)
        sub = store.active_subscription(uid)
        if sub and gateway.configured:
            try:
                gateway.cancel_subscription(sub.id)
            except Exception:
                log.exception("could not cancel subscription for user %s during deletion", uid)
        store.delete_user(uid)
        log.info("deleted user %s", uid)
        resp = JSONResponse({"deleted": True, "email": u.email if u else None})
        resp.delete_cookie(SESSION_COOKIE, path="/")
        return resp

    @app.post("/v1/me/trial-start")
    def trial_start(uid: str = Depends(current_user)) -> dict[str, Any]:
        """Called by the app when it shows the first replay. Starts the 14-day clock and, if this
        user was invited, credits the inviter (3 activated invites = one free semester)."""
        r = store.activate(uid)
        return {**r, **me_payload(uid)}

    @app.get("/v1/me/docs")
    def my_docs(uid: str = Depends(current_user)) -> list[dict[str, Any]]:
        return store.docs(uid)

    @app.get("/v1/docs")
    def docs(uid: str = Depends(current_user)) -> list[dict[str, Any]]:  # legacy name
        return store.docs(uid)

    @app.get("/v1/docs/{doc}/checkpoints")
    def doc_checkpoints(doc: str, uid: str = Depends(current_user)) -> list[dict[str, Any]]:
        return [c.to_dict() for c in store.checkpoints(uid, doc)]

    @app.get("/v1/referrals")
    def referrals(uid: str = Depends(current_user)) -> dict[str, Any]:
        s = store.referral_summary(uid)
        return {**s, "link": f"{settings.app_url}/login?ref={s['code']}", "needed": settings.referrals_per_semester,
                "maxCredits": settings.max_referral_semesters}

    # -- checkpoints and packs ---------------------------------------------------------------------------

    @app.post("/v1/checkpoint")
    def checkpoint(req: CheckpointRequest, uid: str = Depends(current_user)) -> dict[str, Any]:
        for s, h in req.heads.items():
            if not {"seq", "hash", "first_ts"} <= set(h):
                raise HTTPException(400, f"head for session {s} must have seq, hash, first_ts")
        cp = store.checkpoint(uid, req.doc, req.heads, signer)
        latest = None
        if cp is None:
            existing = store.checkpoints(uid, req.doc)
            latest = existing[-1].to_dict() if existing else None
        return {"created": cp is not None, "checkpoint": cp.to_dict() if cp else None, "latest": latest}

    @app.post("/v1/pack")
    def pack(req: PackRequest, uid: str = Depends(entitled_user)) -> Any:
        t0 = time.perf_counter()
        try:
            evs = [Event.from_dict(e) for e in req.events]
        except Exception as e:
            raise HTTPException(400, f"malformed events: {e}")
        if not evs:
            raise HTTPException(400, "no events")
        rep = verify_chain(evs)
        if not rep.ok:
            raise HTTPException(400, {"chain_errors": rep.errors[:10]})
        cps = req.checkpoints or [c.to_dict() for c in store.checkpoints(uid, evs[0].doc)]
        p = build_pack(evs, checkpoints=cps, title=req.title, student=req.student, course=req.course)
        try:
            if req.format == "json":
                return JSONResponse(p)
            if req.format == "html":
                return HTMLResponse(render_html(p))
            if req.format == "record":
                with tempfile.TemporaryDirectory() as tmp:
                    safe = re.sub(r"[^A-Za-z0-9_-]+", "-", (req.title or evs[0].doc[:12])).strip("-") or "essay"
                    path = Path(tmp) / f"{safe[:60]}.trail.tar.gz"
                    build_record(path, events=evs, checkpoints=cps, verifier=signer.public_key, signer=signer, pack=p)
                    data = path.read_bytes()
                return Response(data, media_type="application/gzip", headers={"Content-Disposition": f'attachment; filename="{path.name}"'})
            raise HTTPException(400, "format must be json, html or record")
        finally:
            log.info("pack user=%s events=%d ms=%.0f", uid, len(evs), (time.perf_counter() - t0) * 1000)

    # -- billing --------------------------------------------------------------------------------------------

    def need_billing() -> None:
        if settings.free_access:
            raise HTTPException(409, "Trail is free during early access. There is nothing to buy.")
        if not gateway.configured:
            raise HTTPException(503, "Billing is not configured on this server yet.")

    @app.post("/v1/billing/checkout")
    def checkout(req: CheckoutRequest, uid: str = Depends(current_user)) -> dict[str, str]:
        need_billing()
        u = store.get_user(uid)
        assert u is not None
        customer = gateway.ensure_customer(u.email, uid, u.stripe_customer_id)
        if customer != u.stripe_customer_id:
            store.set_stripe_customer(uid, customer)
        url = gateway.checkout_url(customer=customer, plan=req.plan, uid=uid,
                                   success_url=f"{settings.app_url}/app/settings?checkout=success",
                                   cancel_url=f"{settings.app_url}/app/settings?checkout=cancelled")
        return {"url": url}

    @app.post("/v1/billing/portal")
    def portal(uid: str = Depends(current_user)) -> dict[str, str]:
        need_billing()
        u = store.get_user(uid)
        if not u or not u.stripe_customer_id:
            raise HTTPException(400, "No billing account yet: nothing has been charged.")
        return {"url": gateway.portal_url(customer=u.stripe_customer_id, return_url=f"{settings.app_url}/app/settings")}

    @app.post("/v1/billing/refund")
    def refund(uid: str = Depends(current_user)) -> dict[str, Any]:
        """Full refund of any charge in the last 14 days, and the subscription ends now. No questions."""
        need_billing()
        u = store.get_user(uid)
        if not u or not u.stripe_customer_id:
            raise HTTPException(400, "No billing account yet: nothing has been charged.")
        ok = gateway.refund_recent(customer=u.stripe_customer_id, since=utcnow() - timedelta(days=settings.refund_days))
        if not ok:
            raise HTTPException(409, f"No charge in the last {settings.refund_days} days to refund.")
        sub = store.active_subscription(uid)
        if sub:
            try:
                gateway.cancel_subscription(sub.id)
            except Exception:
                log.exception("refund issued but cancel failed for user %s", uid)
            store.upsert_subscription(sub_id=sub.id, uid=uid, plan=sub.plan, status="canceled", current_period_end=sub.current_period_end, cancel_at_period_end=False)
        log.info("refund user=%s", uid)
        return {"refunded": True, **me_payload(uid)}

    @app.post("/v1/billing/webhook")
    async def webhook(request: Request, stripe_signature: str = Header(default="")) -> dict[str, Any]:
        payload = await request.body()
        try:
            event = gateway.parse_webhook(payload, stripe_signature)
        except Exception as e:
            log.warning("stripe webhook rejected: %s", type(e).__name__)
            raise HTTPException(400, "bad webhook signature")
        result = handle_webhook(store, gateway, event)
        log.info("stripe webhook %s handled=%s", event.get("type"), result.get("handled"))
        return {"received": True, **result}

    # -- static frontend with SPA fallback -----------------------------------------------------------------

    if static is not None:
        index_html = static / "index.html"

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> Response:
            if path.startswith("v1/") or path == "v1":
                raise HTTPException(404, "no such endpoint")
            if path:
                target = (static / path).resolve()
                if target.is_file() and str(target).startswith(str(static.resolve())):
                    headers = {"Cache-Control": "public, max-age=31536000, immutable"} if path.startswith("assets/") else {}
                    return FileResponse(target, headers=headers)
            return FileResponse(index_html, headers={"Cache-Control": "no-cache"})

    return app


__all__ = ["create_app", "load_signer", "billing_mod", "FakeGateway"]
