"""Stripe: checkout / portal / refund endpoints against the fake gateway, and the webhook with
real Stripe signatures (the stripe library verifies them; no network)."""
from __future__ import annotations

import json
import time
from datetime import timedelta

import stripe

from trail.server.billing import PLANS, send_renewal_reminders
from trail.server.store import utcnow
from tests.conftest import sign_in

WHSEC = "whsec_test"


def signed(payload: dict) -> tuple[bytes, str]:
    body = json.dumps(payload).encode()
    ts = int(time.time())
    sig = stripe.WebhookSignature._compute_signature(f"{ts}.{body.decode()}", WHSEC)
    return body, f"t={ts},v1={sig}"


def post_webhook(client, payload: dict, header: str | None = None):
    body, sig = signed(payload)
    return client.post("/v1/billing/webhook", content=body, headers={"Stripe-Signature": header or sig, "Content-Type": "application/json"})


def sub_object(sub_id: str, customer: str, uid: str, plan: str, status: str = "active", days: int = 122, cancel: bool = False) -> dict:
    return {"id": sub_id, "object": "subscription", "customer": customer, "status": status,
            "current_period_end": int((utcnow() + timedelta(days=days)).timestamp()), "cancel_at_period_end": cancel,
            "metadata": {"trail_user": uid, "plan": plan}, "items": {"data": [{"price": {"id": "price_sem" if plan == "semester" else "price_mon"}}]}}


def test_checkout_then_webhook_flips_plan_and_cancel_flips_back(client, mailer, store, gateway):
    cb = sign_in(client, mailer, "pay@uni.example")
    uid = cb["user"]
    assert client.post("/v1/billing/portal").status_code == 400  # nothing charged yet
    r = client.post("/v1/billing/checkout", json={"plan": "semester"})
    assert r.status_code == 200 and r.json()["url"].startswith("https://checkout.stripe.test/")
    assert client.post("/v1/billing/checkout", json={"plan": "yearly"}).status_code == 422
    customer = store.get_user(uid).stripe_customer_id
    assert customer == f"cus_{uid}"

    gateway.subscriptions["sub_1"] = sub_object("sub_1", customer, uid, "semester")
    r = post_webhook(client, {"id": "evt_1", "type": "checkout.session.completed",
                              "data": {"object": {"client_reference_id": uid, "customer": customer, "subscription": "sub_1"}}})
    assert r.status_code == 200 and r.json()["handled"]
    me = client.get("/v1/me").json()
    assert me["plan"] == "semester" and me["entitled"] and me["currentPeriodEnd"] and me["billing"]["hasCustomer"] and me["billing"]["refundable"]
    assert client.post("/v1/billing/portal").json()["url"].startswith("https://portal.stripe.test/")

    # Customer Portal cancel (at period end) keeps access until the end, then Stripe deletes it
    r = post_webhook(client, {"id": "evt_2", "type": "customer.subscription.updated", "data": {"object": sub_object("sub_1", customer, uid, "semester", cancel=True)}})
    assert r.json()["handled"] and client.get("/v1/me").json()["cancelAtPeriodEnd"] is True
    r = post_webhook(client, {"id": "evt_3", "type": "customer.subscription.deleted", "data": {"object": sub_object("sub_1", customer, uid, "semester", status="canceled", days=-5)}})
    assert r.json()["handled"]
    me = client.get("/v1/me").json()
    assert me["plan"] == "trial"  # trial never started: still entitled until first replay
    client.post("/v1/me/trial-start")
    store.set_trial_started(uid, utcnow() - timedelta(days=20))
    assert client.get("/v1/me").json()["plan"] == "expired"

    # webhooks are idempotent and unknown events are acknowledged
    assert post_webhook(client, {"id": "evt_3", "type": "customer.subscription.deleted", "data": {"object": sub_object("sub_1", customer, uid, "semester", status="canceled", days=-5)}}).status_code == 200
    assert post_webhook(client, {"id": "evt_4", "type": "invoice.paid", "data": {"object": {}}}).json() == {"received": True, "handled": False}


def test_webhook_rejects_bad_signature(client):
    payload = {"id": "evt_x", "type": "checkout.session.completed", "data": {"object": {}}}
    assert post_webhook(client, payload, header="t=1,v1=deadbeef").status_code == 400
    body, _ = signed(payload)
    assert client.post("/v1/billing/webhook", content=body, headers={"Content-Type": "application/json"}).status_code == 400


def test_one_click_refund_within_14_days(client, mailer, store, gateway):
    cb = sign_in(client, mailer, "refund@uni.example")
    uid = cb["user"]
    client.post("/v1/billing/checkout", json={"plan": "monthly"})
    customer = store.get_user(uid).stripe_customer_id
    gateway.subscriptions["sub_m"] = sub_object("sub_m", customer, uid, "monthly", days=30)
    post_webhook(client, {"id": "evt_5", "type": "checkout.session.completed", "data": {"object": {"client_reference_id": uid, "customer": customer, "subscription": "sub_m"}}})
    assert client.get("/v1/me").json()["plan"] == "monthly"

    assert client.post("/v1/billing/refund").status_code == 409  # no charge on file yet
    gateway.charges.append({"id": "ch_1", "customer": customer, "created": utcnow() - timedelta(days=3), "refunded": False})
    r = client.post("/v1/billing/refund")
    assert r.status_code == 200 and r.json()["refunded"] and gateway.refunds == ["ch_1"] and gateway.cancelled == ["sub_m"]
    assert r.json()["plan"] == "trial"  # back to wherever the trial clock is; nothing held hostage
    gateway.charges.append({"id": "ch_old", "customer": customer, "created": utcnow() - timedelta(days=40), "refunded": False})
    assert client.post("/v1/billing/refund").status_code == 409


def test_billing_unconfigured_gives_clear_error(client, mailer, gateway):
    sign_in(client, mailer, "nobill@uni.example")
    gateway.configured = False
    r = client.post("/v1/billing/checkout", json={"plan": "semester"})
    assert r.status_code == 503 and "not configured" in r.json()["detail"]
    assert client.get("/v1/billing/plans").json()["configured"] is False


def test_renewal_reminder_seven_days_before(store, mailer, gateway):
    uid, _ = store.create_user("renew@uni.example")
    store.set_stripe_customer(uid, "cus_r")
    end = utcnow() + timedelta(days=7)
    store.upsert_subscription(sub_id="sub_r", uid=uid, plan="semester", status="active", current_period_end=end, cancel_at_period_end=False)
    assert send_renewal_reminders(store, mailer, "https://trail.app") == 1
    m = mailer.sent[-1]
    assert m["to"] == "renew@uni.example" and "renews on" in m["subject"] and PLANS["semester"]["price_usd"] in m["text"] and "/app/settings" in m["text"]
    assert send_renewal_reminders(store, mailer, "https://trail.app") == 0  # not twice for the same period
    # cancelled-at-period-end subscriptions get no reminder (nothing will be charged)
    store.upsert_subscription(sub_id="sub_r", uid=uid, plan="semester", status="active", current_period_end=end + timedelta(days=200), cancel_at_period_end=True)
    assert send_renewal_reminders(store, mailer, "https://trail.app", now=utcnow() + timedelta(days=200)) == 0
