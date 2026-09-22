"""Trail command line (package name `trail`).

    trail backtest [--lines N] [--seed S] [--out DIR]
    trail demo [--out DIR] [--profile honest|mixed|heavy_paster|autotyper|gapped]
    trail analyse EVENTS.jsonl
    trail pack EVENTS.jsonl [--checkpoints C.jsonl] [--key signer.pem] [--out record.tar.gz] [--title T]
    trail verify RECORD
    trail keygen [--out signer.pem]
    trail serve [--host H] [--port P]
    trail renewal-reminders          email everyone whose plan renews in 7 days (run daily)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from trail import __version__


def _events(path: str):
    from trail.events import Event
    return [Event.from_dict(json.loads(l)) for l in Path(path).read_text().splitlines() if l.strip()]


def cmd_backtest(a):
    from trail.backtest import main
    return main(a.lines, a.seed, a.out)


def cmd_demo(a):
    from trail.chain import verify_chain
    from trail.core.signing import Signer, changed_heads, make_checkpoint
    from trail.pack import build_pack
    from trail.record import build_record, verify_record
    from trail.synthetic import Writer, load_lines

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    w = Writer(profile=a.profile, seed=a.seed, start=datetime(2026, 10, 12, 19, 0, tzinfo=timezone.utc),
               human_lines=load_lines("human.txt"), paste_lines=load_lines("pasted.txt"), target_lines=45)
    d = w.write()
    evs = d["events"]
    signer = Signer.generate()
    heads = verify_chain(evs).heads
    cp = make_checkpoint(signer, tenant="demo-user", agent=d["doc"], heads=changed_heads(heads, []), all_heads=heads,
                         events=len(evs), seq=0, ts=evs[-1].ts)
    (out / "events.jsonl").write_text("".join(json.dumps(e.to_dict(), sort_keys=True, separators=(",", ":")) + "\n" for e in evs))
    pack = build_pack(evs, checkpoints=[cp.to_dict()], title=f"Sample essay ({a.profile} writer)", student="A. Student", course="PHIL101 · Essay 2")
    path = out / f"sample-{a.profile}.trail.tar.gz"
    build_record(path, events=evs, checkpoints=[cp.to_dict()], verifier=signer.public_key, signer=signer, pack=pack)
    from trail.pack import render_html
    (out / f"pack-{a.profile}.html").write_text(render_html(pack))
    (out / f"declaration-{a.profile}.md").write_text(pack["declaration"])
    print(f"wrote {path}, {out / f'pack-{a.profile}.html'}")
    rep = verify_record(path); rep.print()
    an = pack["analysis"]
    print(f"\nfinal words {an['document']['final_words']}, typed share {an['document']['typed_share']}, pasted share {an['pastes']['share_of_final_document']}, "
          f"AI pastes {an['pastes']['ai_pastes']}, regularity flagged {an['regularity']['flagged']}, lines {an['line_labels']}")
    return 0 if rep.failed == 0 else 1


def cmd_analyse(a):
    from trail.analysis import analyse
    r = analyse(_events(a.events))
    r.pop("timeline", None)
    print(json.dumps(r, indent=2))
    return 0


def cmd_pack(a):
    from trail.core.signing import Signer
    from trail.pack import build_pack, render_html
    from trail.record import build_record, verify_record
    evs = _events(a.events)
    cps = [json.loads(l) for l in Path(a.checkpoints).read_text().splitlines() if l.strip()] if a.checkpoints else []
    pack = build_pack(evs, checkpoints=cps, title=a.title, student=a.student, course=a.course)
    if a.html:
        Path(a.html).write_text(render_html(pack)); print(f"wrote {a.html}")
    if a.out:
        signer = Signer.from_pem(Path(a.key).read_bytes()) if a.key else None
        build_record(a.out, events=evs, checkpoints=cps, verifier=signer.public_key if signer else None, signer=signer, pack=pack)
        print(f"wrote {a.out}"); verify_record(a.out).print()
    if not a.html and not a.out:
        print(json.dumps({k: v for k, v in pack.items() if k != "analysis"}, indent=2))
    return 0


def cmd_verify(a):
    from trail.verify import verify_path
    rep = verify_path(a.path, a.public_key); rep.print()
    return 0 if rep.failed == 0 else 1


def cmd_keygen(a):
    from trail.core.signing import Signer
    s = Signer.generate(); Path(a.out).write_bytes(s.to_pem())
    pub = Path(a.out).with_suffix(".pub.pem"); pub.write_bytes(s.public_key.to_pem())
    print(f"wrote {a.out} and {pub} (key id {s.public_key.key_id})"); return 0


def cmd_serve(a):
    import uvicorn
    from trail.server.app import create_app
    uvicorn.run(create_app(), host=a.host, port=a.port); return 0


def cmd_reminders(a):
    from trail.server.app import create_app
    from trail.server.billing import send_renewal_reminders
    app = create_app(static_dir=None)
    n = send_renewal_reminders(app.state.store, app.state.mailer, app.state.settings.app_url, days_ahead=a.days)
    print(f"sent {n} renewal reminder(s)"); return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="trail", description="Trail: your writing record")
    p.add_argument("--version", action="version", version=f"trail {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("backtest"); s.add_argument("--lines", type=int, default=10_000); s.add_argument("--seed", type=int, default=42); s.add_argument("--out", default="backtest-out"); s.set_defaults(fn=cmd_backtest)
    s = sub.add_parser("demo"); s.add_argument("--out", default="demo-out"); s.add_argument("--profile", default="mixed"); s.add_argument("--seed", type=int, default=7); s.set_defaults(fn=cmd_demo)
    s = sub.add_parser("analyse"); s.add_argument("events"); s.set_defaults(fn=cmd_analyse)
    s = sub.add_parser("pack"); s.add_argument("events"); s.add_argument("--checkpoints"); s.add_argument("--key"); s.add_argument("--out"); s.add_argument("--html"); s.add_argument("--title"); s.add_argument("--student"); s.add_argument("--course"); s.set_defaults(fn=cmd_pack)
    s = sub.add_parser("verify"); s.add_argument("path"); s.add_argument("--public-key"); s.set_defaults(fn=cmd_verify)
    s = sub.add_parser("keygen"); s.add_argument("--out", default="signer.pem"); s.set_defaults(fn=cmd_keygen)
    s = sub.add_parser("serve"); s.add_argument("--host", default="127.0.0.1"); s.add_argument("--port", type=int, default=8100); s.set_defaults(fn=cmd_serve)
    s = sub.add_parser("renewal-reminders"); s.add_argument("--days", type=int, default=7); s.set_defaults(fn=cmd_reminders)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
