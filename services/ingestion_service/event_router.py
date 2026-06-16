"""
Event router — dispatches envelope by event_type to state store handlers.
"""
from __future__ import annotations

from typing import Any

from .state_store import StateStore


def route_event(envelope: dict[str, Any], store: StateStore) -> None:
    """Update the in-memory state store based on the incoming event."""
    event_type = envelope.get("event_type")
    asset_id = envelope.get("asset_id")
    payload = envelope.get("payload", {})
    timestamp = envelope.get("timestamp", "")

    if not asset_id and event_type not in ("weather", "forecast"):
        return

    if event_type == "telemetry":
        store.get(asset_id).add_telemetry(payload, timestamp)

    elif event_type == "alert":
        store.get(asset_id).add_alert(payload, timestamp)

    elif event_type == "weather":
        # Weather events keyed by asset_id (WX-001) but also set on site
        if asset_id:
            store.get(asset_id).latest_weather = payload
        # Propagate latest weather to all assets for scoring
        store._latest_site_weather = payload

    elif event_type == "forecast":
        if asset_id:
            store.get(asset_id).latest_forecast = payload

    elif event_type == "maintenance":
        # Store maintenance in asset's alert buffer as context
        if asset_id:
            store.get(asset_id).add_alert(
                {**payload, "alert_type": "maintenance_record"},
                timestamp,
            )

    elif event_type == "dispatch":
        if asset_id:
            store.get(asset_id).active_dispatch = payload

    elif event_type in ("workorder", "incident", "audit"):
        # Governance events stored but not used for correlation
        pass
