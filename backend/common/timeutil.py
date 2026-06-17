"""Time utilities — all timestamps UTC ISO-8601 with Z suffix."""
from datetime import datetime, timezone, timedelta
from dateutil.parser import parse as parse_dt


def utcnow_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_utc(ts: str) -> datetime:
    """Parse ISO-8601 Z-suffix string into a UTC-aware datetime."""
    dt = parse_dt(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def to_iso(dt: datetime) -> str:
    """Convert a datetime to ISO-8601 Z string."""
    utc = dt.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def time_grid(anchor: str, duration_hours: float, interval_minutes: int) -> list[datetime]:
    """Return a list of UTC datetimes from anchor, stepping interval_minutes, for duration_hours."""
    start = parse_utc(anchor)
    steps = int(duration_hours * 60 / interval_minutes)
    return [start + timedelta(minutes=i * interval_minutes) for i in range(steps)]


def seconds_between(ts1: str, ts2: str) -> float:
    return (parse_utc(ts2) - parse_utc(ts1)).total_seconds()
