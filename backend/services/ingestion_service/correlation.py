"""
Incident Correlation Service per §13.6.

- Buffers alerts per asset_id over 60-min sliding window.
- On each new alert, calls anomaly service /score.
- Trigger rule: emit candidate when anomaly_score >= 0.6 AND alert_count >= 3.
  (For BESS critical: also trigger on any 'critical' severity alert.)
- Deduplicate: one open candidate per asset per scenario window.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import requests

from common.ids import candidate_id
from common.timeutil import to_iso


ANOMALY_SERVICE_URL = os.getenv("ANOMALY_SERVICE_URL", "http://localhost:8001")
SCORE_THRESHOLD = 0.6
ALERT_COUNT_THRESHOLD = 3

# Open candidates: asset_id → candidate dict
_open_candidates: dict[str, dict[str, Any]] = {}
# All emitted candidates (for /candidates endpoint)
_all_candidates: list[dict[str, Any]] = []
_candidate_counter = 0


def reset() -> None:
    """Reset state between scenarios."""
    global _candidate_counter
    _open_candidates.clear()
    _all_candidates.clear()
    _candidate_counter = 0


def _call_anomaly_service(
    asset_id: str,
    asset_type: str,
    telemetry_window: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    weather: dict[str, Any] | None,
    forecast: dict[str, Any] | None,
    dispatch_active: bool = False,
) -> dict[str, Any] | None:
    """Call the anomaly scoring service. Returns score result or None on failure."""
    payload = {
        "asset_id": asset_id,
        "asset_type": asset_type,
        "telemetry_window": telemetry_window,
        "alerts": alerts,
        "weather": weather,
        "forecast": forecast,
        "dispatch_active": dispatch_active,
    }
    try:
        resp = requests.post(f"{ANOMALY_SERVICE_URL}/score", json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        # If anomaly service is down, do inline scoring
        try:
            import sys
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
            from services.anomaly_service.scoring import score_asset
            return score_asset(
                asset_id=asset_id,
                asset_type=asset_type,
                telemetry_window=telemetry_window,
                alerts=alerts,
                weather=weather,
                forecast=forecast,
                dispatch_active=dispatch_active,
            )
        except Exception:
            return None


def on_new_alert(
    asset_id: str,
    envelope_timestamp: str,
    store: Any,
    window_start: str,
) -> dict[str, Any] | None:
    """
    Called after a new alert is added to the store.
    Returns the incident candidate if the threshold is crossed, else None.
    """
    global _candidate_counter

    # Already have an open candidate for this asset — deduplicate
    if asset_id in _open_candidates:
        return None

    state = store.get(asset_id)
    recent = state.recent_alerts(window_minutes=60)

    # Filter out maintenance_record pseudo-alerts
    alert_payloads = [
        a for a in recent
        if a.get("alert_type") != "maintenance_record"
    ]
    alert_count = len(alert_payloads)

    # Check for critical severity (BESS override)
    has_critical = any(a.get("severity") == "critical" for a in alert_payloads)

    if alert_count < ALERT_COUNT_THRESHOLD and not has_critical:
        return None

    # Call anomaly service
    asset_type = state.asset_type or "solar_inverter"
    dispatch_active = state.active_dispatch is not None and state.active_dispatch.get("active", False)

    site_weather = getattr(store, "_latest_site_weather", None)
    weather = state.latest_weather or site_weather
    forecast = state.latest_forecast

    score_result = _call_anomaly_service(
        asset_id=asset_id,
        asset_type=asset_type,
        telemetry_window=state.window_payloads(),
        alerts=alert_payloads,
        weather=weather,
        forecast=forecast,
        dispatch_active=dispatch_active,
    )

    if score_result is None:
        return None

    anomaly_score = score_result.get("anomaly_score", 0.0)
    symptom = score_result.get("symptom", "nominal")

    # Trigger condition per §13.6
    should_trigger = (
        (anomaly_score >= SCORE_THRESHOLD and alert_count >= ALERT_COUNT_THRESHOLD)
        or has_critical
    )

    if not should_trigger:
        return None

    # Emit candidate
    _candidate_counter += 1
    cand_id = candidate_id(asset_id, _candidate_counter)
    alert_ids = [a.get("alert_id", "") for a in alert_payloads]
    max_sev_order = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
    max_sev = max(alert_payloads, key=lambda a: max_sev_order.get(a.get("severity", "info"), 0))["severity"] if alert_payloads else "low"

    candidate = {
        "candidate_id": cand_id,
        "asset_id": asset_id,
        "window_start": window_start,
        "window_end": envelope_timestamp,
        "grouped_alert_ids": alert_ids,
        "alert_count": alert_count,
        "max_severity": max_sev,
        "anomaly_score": round(anomaly_score, 3),
        "symptom": symptom,
        "trigger": f"anomaly_score>={anomaly_score:.2f} and alert_count>={alert_count}",
    }

    _open_candidates[asset_id] = candidate
    _all_candidates.append(candidate)
    return candidate


def get_all_candidates() -> list[dict[str, Any]]:
    return list(_all_candidates)


def close_candidate(asset_id: str) -> None:
    """Close an open candidate (after it has been processed by the crew)."""
    _open_candidates.pop(asset_id, None)
