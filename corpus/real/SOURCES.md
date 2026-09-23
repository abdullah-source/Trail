# Real texts used by the backtest and the demo

`human.jsonl`, `ai.jsonl` and `quotes.jsonl` are samples of public datasets, filtered to
English texts of 150 to 700 words and lightly normalised (whitespace, tokenisation
artefacts). Each line is `{"id","text","words","source","url","licence"}`. Rebuild with
`corpus/real/build.py` after downloading the raw files with curl (no login needed).

Trail never reads the text to reach a conclusion. These texts exist so that the
simulated writing processes in `trail/synthetic.py` (RealWriter) run over real
student prose and real ChatGPT prose instead of corpus sentences.

## Ghostbuster data (Verma, Fleisig, Tomlin, Klein 2023)

- Repository: https://github.com/vivek3141/ghostbuster-data (paper: https://arxiv.org/abs/2305.15047)
- Licence: Creative Commons Attribution 3.0 Unported (repository `LICENSE`)
- Files: `essay/human/N.txt` (student essays collected from IvyPanda) and `essay/gpt/N.txt`
  (ChatGPT essays written to the same prompts). Files 1 to 260 of each were downloaded over
  HTTPS from `raw.githubusercontent.com`.
- Taken: **100 human essays** into `human.jsonl` (`gb-human-N`) and **100 ChatGPT essays** into
  `ai.jsonl` (`gb-gpt-N`).

## HC3: Human ChatGPT Comparison Corpus (Guo et al. 2023)

- Dataset: https://huggingface.co/datasets/Hello-SimpleAI/HC3 (paper: https://arxiv.org/abs/2301.07597)
- Licence: CC BY-SA 4.0 (dataset card). Not gated; `reddit_eli5.jsonl`, `wiki_csai.jsonl` and
  `open_qa.jsonl` were downloaded directly from `.../resolve/main/`.
- `reddit_eli5`: human long-form answers from Reddit ELI5 and ChatGPT answers to the same
  questions. Taken: **60 human answers** (`hc3-eli5-human-N`) and **40 ChatGPT answers**
  (`hc3-eli5-chatgpt-N`).
- `wiki_csai`: ChatGPT explanations of computer-science topics; the "human" side is Wikipedia
  text. Taken: **20 ChatGPT answers** (`hc3-wiki-chatgpt-N`) into `ai.jsonl`, and the first
  one or two sentences of **60 Wikipedia paragraphs** into `quotes.jsonl` as material for the
  "quotation pasted from a web source" scenario.
- `open_qa`: almost no human answers reach 150 words; not used.

## Totals

| file | items | words (min / median / max) | size |
|---|---|---|---|
| `human.jsonl` | 160 | 151 / 330 / 657 | 379 KB |
| `ai.jsonl` | 160 | 150 / 396 / 698 | 449 KB |
| `quotes.jsonl` | 60 | one or two sentences each | 28 KB |

## Considered and not used

- PERSUADE 2.0 / Kaggle "Learning Agency Lab - Automated Essay Scoring 2.0" and "LLM - Detect
  AI Generated Text": the canonical copies are on Kaggle and need a login; skipped. Mirrors on
  Hugging Face (e.g. `realbenpope/PERSUADE_manageable`, uploader-declared MIT) exist, but the
  Ghostbuster student essays already cover human essay prose, so they were not needed.
- The Hugging Face dataset search API returned no results for "ai generated essay" at the time
  of writing.
