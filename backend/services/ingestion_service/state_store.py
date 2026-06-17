"""
In-memory asset state store per §13.4.

Keyed by asset_id, holds:
  - rolling telemetry window (deque maxlen 48 — last 24 points * 2 safety)
  - recent alerts (60-min sliding window)
  - latest weather payload
  - latest forecast payload
  - active dispatch payload
"""
from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Any


class AssetState:
    def __init__(self) -> None:
        self.telemetry_window: deque[dict[str, Any]] = deque(maxlen=48)
        self.alerts: list[dict[str, Any]] = []
        self.latest_weather: dict[str, Any] | None = None
        self.latest_forecast: dict[str, Any] | None = None
        self.active_dispatch: dict[str, Any] | None = None
        self.asset_type: str | None = None
        self._latest_ts: datetime = datetime.min.replace(tzinfo=timezone.utc)

    def add_telemetry(self, payload: dict[str, Any], timestamp: str) -> None:
        entry = {**payload, "_timestamp": timestamp}
        self.telemetry_window.append(entry)
        if payload.get("asset_type"):
            self.asset_type = payload["asset_type"]
        ts_dt = _parse_ts(timestamp)
        if ts_dt > self._latest_ts:
            self._latest_ts = ts_dt

    def add_alert(self, payload: dict[str, Any], timestamp: str) -> None:
        self.alerts.append({**payload, "_timestamp": timestamp})
        # Track the latest event timestamp seen (for replay-safe windowing)
        ts_dt = _parse_ts(timestamp)
        if ts_dt > self._latest_ts:
            self._latest_ts = ts_dt
        self._prune_alerts()

    def _prune_alerts(self) -> None:
        """Keep only alerts within the last 60 minutes of the latest seen event."""
        # Use latest seen event time (not wall-clock) so replay works correctly
        ref = self._latest_ts if self._latest_ts > datetime.min.replace(tzinfo=timezone.utc) else datetime.now(timezone.utc)
        cutoff = ref - timedelta(minutes=60)
        self.alerts = [
            a for a in self.alerts
            if _parse_ts(a.get("_timestamp", "")) >= cutoff
        ]

    def recent_alerts(self, window_minutes: int = 60) -> list[dict[str, Any]]:
        """Return alerts within window_minutes of the latest seen event timestamp."""
        ref = self._latest_ts if self._latest_ts > datetime.min.replace(tzinfo=timezone.utc) else datetime.now(timezone.utc)
        cutoff = ref - timedelta(minutes=window_minutes)
        return [a for a in self.alerts if _parse_ts(a.get("_timestamp", "")) >= cutoff]

    def window_payloads(self) -> list[dict[str, Any]]:
        """Return raw payload dicts (without _timestamp key)."""
        return [{k: v for k, v in t.items() if k != "_timestamp"} for t in self.telemetry_window]


def _parse_ts(ts: str) -> datetime:
    from dateutil.parser import parse as parse_dt
    try:
        dt = parse_dt(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


class StateStore:
    def __init__(self) -> None:
        self._assets: dict[str, AssetState] = defaultdict(AssetState)

    def get(self, asset_id: str) -> AssetState:
        return self._assets[asset_id]

    def all_asset_ids(self) -> list[str]:
        return list(self._assets.keys())

    def snapshot(self, asset_id: str) -> dict[str, Any]:
        """Return a debug snapshot of an asset's current state."""
        state = self._assets[asset_id]
        return {
            "asset_id": asset_id,
            "asset_type": state.asset_type,
            "telemetry_count": len(state.telemetry_window),
            "alert_count": len(state.alerts),
            "latest_weather": state.latest_weather,
            "latest_forecast": state.latest_forecast,
            "active_dispatch": state.active_dispatch,
        }


# Module-level singleton
store = StateStore()
