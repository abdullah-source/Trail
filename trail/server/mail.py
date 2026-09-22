"""Transactional email via Resend. Without RESEND_API_KEY the ConsoleMailer logs the message
(and the magic link) instead, which is what local dev and tests use."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Protocol

log = logging.getLogger("longhand.mail")


class Mailer(Protocol):
    def send(self, to: str, subject: str, text: str, html: str | None = None) -> None: ...


@dataclass
class ConsoleMailer:
    sent: list[dict] = field(default_factory=list)

    def send(self, to: str, subject: str, text: str, html: str | None = None) -> None:
        self.sent.append({"to": to, "subject": subject, "text": text, "html": html})
        # Dev only (no RESEND_API_KEY). Logged at WARNING so it shows under uvicorn's
        # default log level; otherwise the sign-in link is invisible to the developer.
        log.warning("DEV MAIL (not sent) to=%s subject=%r\n%s", to, subject, text)


class ResendMailer:
    def __init__(self, api_key: str, sender: str):
        self.api_key = api_key
        self.sender = sender

    def send(self, to: str, subject: str, text: str, html: str | None = None) -> None:
        import httpx

        r = httpx.post("https://api.resend.com/emails", timeout=15,
                       headers={"Authorization": f"Bearer {self.api_key}"},
                       json={"from": self.sender, "to": [to], "subject": subject, "text": text, **({"html": html} if html else {})})
        if r.status_code >= 300:
            log.warning("resend failed status=%s", r.status_code)
            r.raise_for_status()


def magic_link_message(link: str, first_time: bool) -> tuple[str, str, str]:
    subject = "Your Longhand sign-in link" if not first_time else "Welcome to Longhand — sign in"
    text = (f"Hi,\n\nClick to sign in to Longhand:\n\n{link}\n\nThe link works once and expires in 30 minutes. "
            "If you did not ask for it, ignore this email.\n\nLonghand keeps your writing record on your device; "
            "this email is the only password you will ever need.\n")
    html = (f"<p>Click to sign in to Longhand:</p><p><a href=\"{link}\">{link}</a></p>"
            "<p>The link works once and expires in 30 minutes. If you did not ask for it, ignore this email.</p>")
    return subject, text, html


def renewal_reminder_message(plan: str, renews_on: str, amount: str, portal_hint: str) -> tuple[str, str]:
    subject = f"Your Longhand {plan} plan renews on {renews_on}"
    text = (f"A heads-up, as promised: your Longhand {plan} plan renews on {renews_on} for {amount}.\n\n"
            f"Nothing to do if you want to keep it. To cancel in one click, open Settings → Billing ({portal_hint}). "
            "No retention flow, no questions.\n")
    return subject, text
