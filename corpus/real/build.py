"""Build corpus/real/{human,ai,quotes}.jsonl from public datasets (one-off; see SOURCES.md).

    python corpus/real/build.py --raw /path/with/hc3_*.jsonl,gb/{human,gpt}/N.txt

Downloads are done with curl (no login); this script only filters and samples.
"""
from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORDS = (150, 700)

HC3_URL = "https://huggingface.co/datasets/Hello-SimpleAI/HC3"
HC3_LIC = "CC BY-SA 4.0"
GB_URL = "https://github.com/vivek3141/ghostbuster-data"
GB_LIC = "CC BY 3.0"


def clean(t: str) -> str:
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    # HC3 reddit answers are tokenised ("word , word ."): undo the obvious cases
    t = re.sub(r" ([,.;:!?%)])", r"\1", t)
    t = re.sub(r"\( ", "(", t)
    t = re.sub(r" (n't|'s|'re|'ve|'ll|'d|'m)\b", r"\1", t)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    t = "\n".join(l.strip() for l in t.split("\n"))
    return t.strip()


def ok(t: str) -> bool:
    n = len(t.split())
    return WORDS[0] <= n <= WORDS[1] and "\n" in t or (WORDS[0] <= n <= WORDS[1] and len(t) < 4000)


def item(id_: str, text: str, source: str, url: str, lic: str) -> dict:
    return {"id": id_, "text": text, "words": len(text.split()), "source": source, "url": url, "licence": lic}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    raw = Path(a.raw)
    rng = random.Random(a.seed)
    human: list[dict] = []
    ai: list[dict] = []
    quotes: list[dict] = []

    # Ghostbuster essays: human = student essays (IvyPanda), gpt = ChatGPT essays on the same prompts
    for kind, bucket, src in (("human", human, "ghostbuster essay/human"), ("gpt", ai, "ghostbuster essay/gpt")):
        files = sorted((raw / "gb" / kind).glob("*.txt"), key=lambda p: int(p.stem))
        rng.shuffle(files)
        n = 0
        for p in files:
            t = clean(p.read_text(errors="replace"))
            if not ok(t):
                continue
            bucket.append(item(f"gb-{kind}-{p.stem}", t, src, f"{GB_URL}/blob/master/essay/{kind}/{p.name}", GB_LIC))
            n += 1
            if n >= 100:
                break

    # HC3 reddit_eli5: human answers (Reddit) and ChatGPT answers to the same questions
    rows = [json.loads(l) for l in (raw / "hc3_reddit_eli5.jsonl").read_text().splitlines() if l.strip()]
    rng.shuffle(rows)
    nh = na = 0
    for i, r in enumerate(rows):
        if nh < 60:
            for t in r["human_answers"]:
                t = clean(t)
                if ok(t):
                    human.append(item(f"hc3-eli5-human-{i}", t, "HC3 reddit_eli5 human_answers", HC3_URL, HC3_LIC)); nh += 1
                    break
        if na < 40:
            for t in r["chatgpt_answers"]:
                t = clean(t)
                if ok(t):
                    ai.append(item(f"hc3-eli5-chatgpt-{i}", t, "HC3 reddit_eli5 chatgpt_answers", HC3_URL, HC3_LIC)); na += 1
                    break
        if nh >= 60 and na >= 40:
            break

    # HC3 wiki_csai: ChatGPT explanations of Wikipedia topics; the human side is Wikipedia text, used as quote material
    rows = [json.loads(l) for l in (raw / "hc3_wiki_csai.jsonl").read_text().splitlines() if l.strip()]
    rng.shuffle(rows)
    na = nq = 0
    for i, r in enumerate(rows):
        if na < 20:
            for t in r["chatgpt_answers"]:
                t = clean(t)
                if ok(t):
                    ai.append(item(f"hc3-wiki-chatgpt-{i}", t, "HC3 wiki_csai chatgpt_answers", HC3_URL, HC3_LIC)); na += 1
                    break
        if nq < 60:
            for t in r["human_answers"]:
                t = clean(t)
                sents = re.split(r"(?<=[.!?])\s+", t.split("\n")[0])
                q = " ".join(sents[:2]).strip()
                if 80 <= len(q) <= 400:
                    quotes.append({"id": f"hc3-wiki-quote-{i}", "text": q, "topic": r["question"].replace('Please explain what is ', '').strip('"'),
                                   "source": "HC3 wiki_csai human_answers (Wikipedia)", "url": HC3_URL, "licence": HC3_LIC}); nq += 1
                    break
        if na >= 20 and nq >= 60:
            break

    for name, rows in (("human", human), ("ai", ai), ("quotes", quotes)):
        p = HERE / f"{name}.jsonl"
        p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
        print(name, len(rows), p.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
