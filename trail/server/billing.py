"""Stripe: hosted Checkout, Customer Portal, refunds and webhooks (DECISIONS §3).

All Stripe API calls go through `StripeGateway` so tests can substitute `FakeGateway`.
Webhook signatures are always verified with the real stripe library."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

log = logging.getLogger("trail.billing")

PLANS = {
    "semester": {"label": "Semester", "price_usd": "12.00", "interval": "4 months"},
    "monthly": {"label": "Monthly", "price_usd": "3.99", "interval": "month"},
}


class Gateway:
    """Interface. Subclasses: StripeGateway, FakeGateway."""

    configured = False

    def ensure_customer(self, email: str, uid: str, existing: str | None) -> str: raise NotImplementedError
    def checkout_url(self, *, customer: str, plan: str, success_url: str, cancel_url: str, uid: str) -> str: raise NotImplementedError
    def portal_url(self, *, customer: str, return_url: str) -> str: raise NotImplementedError
    def subscription(self, sub_id: str) -> dict[str, Any]: raise NotImplementedError
    def cancel_subscription(self, sub_id: str) -> None: raise NotImplementedError
    def refund_recent(self, *, customer: str, since: datetime) -> bool: raise NotImplementedError
    def parse_webhook(self, payload: bytes, sig_header: str) -> dict[str, Any]: raise NotImplementedError


class StripeGateway(Gateway):
    def __init__(self, secret_key: str | None, webhook_secret: str | None, price_semester: str | None, price_monthly: str | None):
        import stripe

        self.stripe = stripe
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self.prices = {"semester": price_semester, "monthly": price_monthly}
        self.configured = bool(secret_key and price_semester and price_monthly)
        if secret_key:
            stripe.api_key = secret_key

    def plan_for_price(self, price_id: str | None) -> str | None:
        for plan, pid in self.prices.items():
            if pid and pid == price_id:
                return plan
        return None

    def ensure_customer(self, email: str, uid: str, existing: str | None) -> str:
        if existing:
            return existing
        c = self.stripe.Customer.create(email=email, metadata={"trail_user": uid})
        return c["id"]

    def checkout_url(self, *, customer: str, plan: str, success_url: str, cancel_url: str, uid: str) -> str:
        s = self.stripe.checkout.Session.create(
            mode="subscription", customer=customer, client_reference_id=uid,
            line_items=[{"price": self.prices[plan], "quantity": 1}],
            success_url=success_url, cancel_url=cancel_url, allow_promotion_codes=True,
            subscription_data={"metadata": {"trail_user": uid, "plan": plan}},
        )
        return s["url"]

    def portal_url(self, *, customer: str, return_url: str) -> str:
        p = self.stripe.billing_portal.Session.create(customer=customer, return_url=return_url)
        return p["url"]

    def subscription(self, sub_id: str) -> dict[str, Any]:
        return dict(self.stripe.Subscription.retrieve(sub_id))

    def cancel_subscription(self, sub_id: str) -> None:
        self.stripe.Subscription.cancel(sub_id)

    def refund_recent(self, *, customer: str, since: datetime) -> bool:
        charges = self.stripe.Charge.list(customer=customer, limit=5)
        for ch in charges.get("data", []):
            created = datetime.fromtimestamp(ch["created"], tz=timezone.utc)
            if ch.get("paid") and not ch.get("refunded") and created >= since:
                self.stripe.Refund.create(charge=ch["id"])
                return True
        return False

    def parse_webhook(self, payload: bytes, sig_header: str) -> dict[str, Any]:
        if not self.webhook_secret:
            raise ValueError("STRIPE_WEBHOOK_SECRET not set")
        self.stripe.Webhook.construct_event(payload, sig_header, self.webhook_secret)  # raises on a bad signature
        return json.loads(payload)


@dataclass
class FakeGateway(Gateway):
    """In-memory Stripe for tests. Webhook signature checks still use the real library."""

    webhook_secret: str = "whsec_test"
    prices: dict[str, str] = field(default_factory=lambda: {"semester": "price_sem", "monthly": "price_mon"})
    customers: dict[str, str] = field(default_factory=dict)
    subscriptions: dict[str, dict[str, Any]] = field(default_factory=dict)
    charges: list[dict[str, Any]] = field(default_factory=list)
    refunds: list[str] = field(default_factory=list)
    cancelled: list[str] = field(default_factory=list)
    configured: bool = True

    def plan_for_price(self, price_id: str | None) -> str | None:
        return next((p for p, pid in self.prices.items() if pid == price_id), None)

    def ensure_customer(self, email: str, uid: str, existing: str | None) -> str:
        if existing:
            return existing
        cid = f"cus_{uid}"
        self.customers[cid] = email
        return cid

    def checkout_url(self, *, customer: str, plan: str, success_url: str, cancel_url: str, uid: str) -> str:
        return f"https://checkout.stripe.test/{customer}/{plan}"

    def portal_url(self, *, customer: str, return_url: str) -> str:
        return f"https://portal.stripe.test/{customer}"

    def subscription(self, sub_id: str) -> dict[str, Any]:
        return self.subscriptions[sub_id]

    def cancel_subscription(self, sub_id: str) -> None:
        self.cancelled.append(sub_id)
        if sub_id in self.subscriptions:
            self.subscriptions[sub_id]["status"] = "canceled"

    def refund_recent(self, *, customer: str, since: datetime) -> bool:
        for ch in self.charges:
            if ch["customer"] == customer and not ch.get("refunded") and ch["created"] >= since:
                ch["refunded"] = True
                self.refunds.append(ch["id"])
                return True
        return False

    def parse_webhook(self, payload: bytes, sig_header: str) -> dict[str, Any]:
        import stripe

        stripe.Webhook.construct_event(payload, sig_header, self.webhook_secret)  # raises on a bad signature
        return json.loads(payload)


def _ts(v: Any) -> datetime | None:
    return datetime.fromtimestamp(int(v), tz=timezone.utc) if v else None


def subscription_fields(gateway: Any, sub: dict[str, Any]) -> dict[str, Any]:
    """Normalise a Stripe subscription object into what the store keeps."""
    items = (sub.get("items") or {}).get("data") or []
    price_id = (items[0].get("price") or {}).get("id") if items else None
    plan = (sub.get("metadata") or {}).get("plan") or gateway.plan_for_price(price_id) or "monthly"
    period_end = sub.get("current_period_end")
    if period_end is None and items:  # newer Stripe API versions put it on the item
        period_end = items[0].get("current_period_end")
    return {"sub_id": sub["id"], "plan": plan, "status": sub.get("status", "active"),
            "current_period_end": _ts(period_end), "cancel_at_period_end": bool(sub.get("cancel_at_period_end"))}


def handle_webhook(store: Any, gateway: Any, event: dict[str, Any]) -> dict[str, Any]:
    """Apply a verified Stripe event to the store. Idempotent."""
    kind = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    if kind == "checkout.session.completed":
        uid = obj.get("client_reference_id")
        customer = obj.get("customer")
        sub_id = obj.get("subscription")
        if uid and customer:
            store.set_stripe_customer(uid, customer)
        if sub_id and uid:
            sub = gateway.subscription(sub_id) if isinstance(sub_id, str) else sub_id
            store.upsert_subscription(uid=uid, **subscription_fields(gateway, sub))
        return {"handled": True, "user": uid}
    if kind in ("customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.created"):
        uid = (obj.get("metadata") or {}).get("trail_user")
        if not uid:
            u = store.user_by_customer(obj.get("customer"))
            uid = u.id if u else None
        if not uid:
            log.info("webhook %s for unknown customer", kind)
            return {"handled": False}
        fields = subscription_fields(gateway, obj)
        if kind == "customer.subscription.deleted":
            fields["status"] = "canceled"
        store.upsert_subscription(uid=uid, **fields)
        return {"handled": True, "user": uid}
    return {"handled": False}


def send_renewal_reminders(store: Any, mailer: Any, app_url: str, *, days_ahead: int = 7, now: datetime | None = None) -> int:
    """Email everyone whose subscription renews in `days_ahead` days (run daily; DECISIONS §3)."""
    from trail.server.mail import renewal_reminder_message

    now = now or datetime.now(timezone.utc)
    start, end = now + timedelta(days=days_ahead - 1), now + timedelta(days=days_ahead + 1)
    n = 0
    for user, sub in store.subscriptions_renewing_between(start, end):
        if user.renewal_reminded_for and abs((user.renewal_reminded_for.replace(tzinfo=timezone.utc) if user.renewal_reminded_for.tzinfo is None else user.renewal_reminded_for) - sub.current_period_end.replace(tzinfo=timezone.utc)) < timedelta(hours=1):
            continue
        plan = PLANS.get(sub.plan, PLANS["monthly"])
        subject, text = renewal_reminder_message(plan["label"].lower(), sub.current_period_end.strftime("%Y-%m-%d"), f"${plan['price_usd']}", f"{app_url}/app/settings")
        mailer.send(user.email, subject, text)
        store.mark_renewal_reminded(user.id, sub.current_period_end)
        n += 1
    return n
