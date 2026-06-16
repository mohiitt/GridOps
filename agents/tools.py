"""
CrewAI tools per §14.2 — exact signatures as specified.

Data sources: state store (HTTP) in live mode, or directly from
scenario JSONL / data/*.json files in simple/offline mode.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import requests
from crewai.tools import tool

INGESTION_URL = os.getenv("INGESTION_SERVICE_URL", "http://localhost:8002")
ANOMALY_URL = os.getenv("ANOMALY_SERVICE_URL", "http://localhost:8001")
ENERGY_PRICE = float(os.getenv("ENERGY_PRICE_PER_MWH", "75"))
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))


def _http_get(url: str) -> Any:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


@tool("query_telemetry_window")
def query_telemetry_window(asset_id: str, start_time: str, end_time: str) -> dict:
    """Query the telemetry window for an asset between start_time and end_time (ISO-8601 Z)."""
    try:
        state = _http_get(f"{INGESTION_URL}/state/{asset_id}")
        return {"asset_id": asset_id, "telemetry": state}
    except Exception:
        # Fallback: load from any scenario JSONL
        for scenario in Path(DATA_DIR / "scenarios").iterdir():
            path = scenario / "telemetry_events.jsonl"
            events = _load_jsonl(path)
            filtered = [
                e for e in events
                if e.get("asset_id") == asset_id
                and e.get("timestamp", "") >= start_time
                and e.get("timestamp", "") <= end_time
            ]
            if filtered:
                return {"asset_id": asset_id, "telemetry": [e["payload"] for e in filtered]}
    return {"asset_id": asset_id, "telemetry": []}


@tool("query_alerts")
def query_alerts(asset_id: str, window_minutes: int = 60) -> list:
    """Query recent alerts for an asset within a time window (minutes)."""
    try:
        state = _http_get(f"{INGESTION_URL}/state/{asset_id}")
        return state.get("alerts", [])
    except Exception:
        for scenario in sorted(Path(DATA_DIR / "scenarios").iterdir()):
            path = scenario / "alert_events.jsonl"
            events = _load_jsonl(path)
            alerts = [e["payload"] for e in events if e.get("asset_id") == asset_id]
            if alerts:
                return alerts[-window_minutes // 5:]  # approx last N points
    return []


@tool("query_maintenance_history")
def query_maintenance_history(asset_id: str) -> list:
    """Query maintenance history and manufacturer notes for an asset."""
    records = []
    maint_path = DATA_DIR / "maintenance_records.json"
    if maint_path.exists():
        all_records = json.loads(maint_path.read_text())
        records = [r for r in all_records if r.get("asset_id") == asset_id]

    notes = []
    notes_path = DATA_DIR / "manufacturer_notes.json"
    if notes_path.exists():
        all_notes = json.loads(notes_path.read_text())
        # Match by asset info if available
        assets_path = DATA_DIR / "assets.json"
        if assets_path.exists():
            asset_data = json.loads(assets_path.read_text())
            asset = next(
                (a for a in asset_data.get("assets", []) if a["asset_id"] == asset_id),
                None,
            )
            if asset:
                notes = [
                    n for n in all_notes
                    if n.get("asset_type") == asset.get("asset_type")
                    and n.get("manufacturer") == asset.get("manufacturer")
                ]
            else:
                notes = all_notes

    return {"records": records, "manufacturer_notes": notes}


@tool("query_weather_context")
def query_weather_context(site_id: str, window_minutes: int = 60) -> dict:
    """Query recent weather observations for a site."""
    for scenario in sorted(Path(DATA_DIR / "scenarios").iterdir()):
        path = scenario / "weather_events.jsonl"
        events = _load_jsonl(path)
        if events:
            return {"weather": [e["payload"] for e in events[-window_minutes // 5:]]}
    return {"weather": []}


@tool("query_forecast_vs_actual")
def query_forecast_vs_actual(site_id_or_asset_id: str, window_minutes: int = 60) -> dict:
    """Query forecast vs actual production for an asset or site."""
    for scenario in sorted(Path(DATA_DIR / "scenarios").iterdir()):
        path = scenario / "forecast_events.jsonl"
        events = _load_jsonl(path)
        filtered = [
            e for e in events
            if e.get("asset_id") == site_id_or_asset_id
            or e.get("site_id") == site_id_or_asset_id
        ]
        if filtered:
            return {"forecast": [e["payload"] for e in filtered[-window_minutes // 5:]]}
    return {"forecast": []}


@tool("call_truefoundry_anomaly_service")
def call_truefoundry_anomaly_service(payload: dict) -> dict:
    """
    Call the TrueFoundry-deployed anomaly scoring service.
    Payload: {asset_id, asset_type, telemetry_window, alerts, weather, forecast}.
    """
    try:
        resp = requests.post(f"{ANOMALY_URL}/score", json=payload, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        # Inline fallback
        try:
            from services.anomaly_service.scoring import score_asset
            return score_asset(
                asset_id=payload.get("asset_id", ""),
                asset_type=payload.get("asset_type", "solar_inverter"),
                telemetry_window=payload.get("telemetry_window", []),
                alerts=payload.get("alerts", []),
                weather=payload.get("weather"),
                forecast=payload.get("forecast"),
                dispatch_active=payload.get("dispatch_active", False),
            )
        except Exception:
            return {"error": str(exc), "anomaly_score": 0.0, "symptom": "nominal"}


@tool("calculate_business_impact")
def calculate_business_impact(
    expected_mwh: float,
    actual_mwh: float,
    energy_price: float = ENERGY_PRICE,
) -> dict:
    """
    Calculate daily energy and revenue loss from forecast vs actual production.
    Returns: {energy_loss_mwh_per_day, revenue_loss_usd_per_day, energy_price_per_mwh}
    """
    loss_mwh = max(0.0, expected_mwh - actual_mwh)
    # Scale to daily: if given interval data, multiply up to 24h
    # If the window is per-interval, scale: 24h * (loss per interval / interval_hours)
    # Assume caller passes daily totals or we treat as-is
    revenue_loss = loss_mwh * energy_price
    return {
        "energy_loss_mwh_per_day": round(loss_mwh, 2),
        "revenue_loss_usd_per_day": round(revenue_loss, 2),
        "energy_price_per_mwh": energy_price,
    }


@tool("apply_governance_rules")
def apply_governance_rules(incident: dict) -> dict:
    """
    Apply deterministic governance rules per §14.2.
    Returns approval/escalation requirements.

    Rules (exact from plan):
    - Any action implying offline/disconnect OR priority in {high, critical} → approval_required=True
    - priority==critical OR symptom==thermal_runaway_risk → escalation_level=site_engineer, requires_immediate=True
    - priority==low → approval_required=False, auto_executable=True
    """
    priority = incident.get("priority", "low")
    symptom = incident.get("symptom", "nominal")
    recommended_action = incident.get("recommended_action", "")

    offline_actions = {"inspect_cooling_fan_within_24_hours", "escalate_to_site_engineer_and_inspect_cooling_loop_immediately"}
    implies_offline = any(word in recommended_action for word in ["offline", "disconnect", "inspect", "escalate"])

    if priority == "low":
        return {
            "approval_required": False,
            "auto_executable": True,
            "reason": "Low priority action requires no approval",
            "escalation_level": "none",
            "requires_immediate": False,
        }

    approval_required = (priority in ("high", "critical")) or implies_offline

    if priority == "critical" or symptom == "thermal_runaway_risk":
        escalation_level = "site_engineer"
        requires_immediate = True
    else:
        escalation_level = "site_engineer" if priority == "high" else "supervisor"
        requires_immediate = False

    return {
        "approval_required": approval_required,
        "auto_executable": not approval_required,
        "reason": f"Action may require taking asset offline" if implies_offline else f"Priority {priority} requires approval",
        "escalation_level": escalation_level,
        "requires_immediate": requires_immediate,
    }
