from __future__ import annotations
from datetime import datetime, timezone

def format_ts(dt: datetime) -> str:
    if dt.tzinfo is None:
        raise ValueError("timestamps must be timezone-aware")
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")

def now_ts() -> str:
    return format_ts(datetime.now(timezone.utc))

def parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)

def ms(ts: str) -> int:
    return int(parse_ts(ts).timestamp() * 1000)
