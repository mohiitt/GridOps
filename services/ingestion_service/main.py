"""
Event Ingestion Service — FastAPI, port 8002 per §13.4.

Endpoints:
  POST /ingest              → accept one Envelope; triggers crew on new candidate
  POST /set_context         → set scenario metadata before streaming
  GET  /state/{asset_id}    → current window (debug)
  GET  /candidates          → list of open incident candidates
  POST /reset               → reset state between scenarios
"""
from __future__ import annotations

import logging
import os
from typing import Any

import requests as _requests
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel

from common.envelope import Envelope
from .event_router import route_event
from .state_store import store
from . import correlation

logger = logging.getLogger("gridops.ingestion")

app = FastAPI(
    title="GridOps Event Ingestion Service",
    description="Ingests event envelopes and triggers incident correlation",
    version="1.0.0",
)

# Track when the current scenario window started (per asset)
_scenario_window_start: dict[str, str] = {}

# Scenario context set by /set_context before streaming
_scenario_context: dict[str, str] = {
    "scenario": "inverter_cooling_degradation",
    "scenario_id": "SCN-B",
    "site_id": "SITE-DS-001",
}

SCENARIO_IDS = {
    "normal_operation": "SCN-A",
    "inverter_cooling_degradation": "SCN-B",
    "bess_thermal_risk": "SCN-C",
    "weather_false_positive": "SCN-D",
}

CREW_SERVICE_URL = os.getenv("CREW_SERVICE_URL", "http://localhost:8003")
INCIDENT_API_URL = os.getenv("INCIDENT_API_URL", "http://localhost:8000")


# ── Background dispatch ────────────────────────────────────────────────────────

def dispatch_to_crew(candidate: dict[str, Any], context: dict[str, str]) -> None:
    """
    Background task: POST candidate to crew service, register report with incident API.
    Errors are logged but never propagated (keeps ingestion service stable).
    """
    crew_url = os.getenv("CREW_SERVICE_URL", CREW_SERVICE_URL)
    api_url = os.getenv("INCIDENT_API_URL", INCIDENT_API_URL)

    try:
        logger.info(
            "Dispatching candidate %s to crew service %s",
            candidate.get("candidate_id"),
            crew_url,
        )
        resp = _requests.post(
            f"{crew_url}/run_incident",
            json={"candidate": candidate, "context": context},
            timeout=300,  # crew may take up to 5 min with 9 LLM calls
        )
        resp.raise_for_status()
        report = resp.json()
        inc_id = report.get("incident_id", "unknown")
        logger.info("Crew produced report %s", inc_id)
    except Exception as exc:
        logger.error("Crew dispatch failed for candidate %s: %s", candidate.get("candidate_id"), exc)
        return

    # Register with incident API
    try:
        reg = _requests.post(f"{api_url}/api/reports", json=report, timeout=15)
        reg.raise_for_status()
        logger.info("Report %s registered with incident API", inc_id)
    except Exception as exc:
        logger.error("Failed to register report %s with incident API: %s", inc_id, exc)


# ── Request / response models ─────────────────────────────────────────────────

class IngestResponse(BaseModel):
    status: str
    candidates_emitted: int
    candidate_id: str | None = None


class SetContextRequest(BaseModel):
    scenario: str
    scenario_id: str | None = None   # auto-derived from scenario if omitted
    site_id: str = "SITE-DS-001"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/set_context")
def set_context(req: SetContextRequest) -> dict[str, str]:
    """Set the current scenario context. Call this before streaming events."""
    scenario_id = req.scenario_id or SCENARIO_IDS.get(req.scenario, "SCN-B")
    _scenario_context.update({
        "scenario": req.scenario,
        "scenario_id": scenario_id,
        "site_id": req.site_id,
    })
    return {"status": "ok", **_scenario_context}


@app.post("/ingest", response_model=IngestResponse)
def ingest(envelope: Envelope, background_tasks: BackgroundTasks) -> IngestResponse:
    """
    Ingest one event envelope. When a new incident candidate is emitted,
    dispatches to the crew service in the background per §13.7.
    """
    asset_id = envelope.asset_id or envelope.site_id
    if asset_id not in _scenario_window_start:
        _scenario_window_start[asset_id] = envelope.timestamp

    route_event(envelope.model_dump(), store)

    candidate = None
    if envelope.event_type == "alert" and envelope.asset_id:
        window_start = _scenario_window_start.get(envelope.asset_id, envelope.timestamp)
        candidate = correlation.on_new_alert(
            asset_id=envelope.asset_id,
            envelope_timestamp=envelope.timestamp,
            store=store,
            window_start=window_start,
        )

    if candidate:
        # Build crew context with current scenario metadata + asset info
        assets_path = __import__("pathlib").Path("data/assets.json")
        asset_name = candidate["asset_id"]
        try:
            import json
            assets_data = json.loads(assets_path.read_text())
            asset = next(
                (a for a in assets_data.get("assets", [])
                 if a["asset_id"] == candidate["asset_id"]),
                None,
            )
            if asset:
                asset_name = asset.get("asset_name", candidate["asset_id"])
        except Exception:
            pass

        context = {
            **_scenario_context,
            "asset_name": asset_name,
        }
        background_tasks.add_task(dispatch_to_crew, candidate, context)
        logger.info(
            "Incident candidate %s queued for crew dispatch (scenario=%s)",
            candidate["candidate_id"],
            context.get("scenario_id"),
        )

    return IngestResponse(
        status="ok",
        candidates_emitted=1 if candidate else 0,
        candidate_id=candidate["candidate_id"] if candidate else None,
    )


@app.get("/state/{asset_id}")
def get_state(asset_id: str) -> dict[str, Any]:
    """Return current state window for an asset (debug endpoint)."""
    return store.snapshot(asset_id)


@app.get("/candidates")
def get_candidates() -> list[dict[str, Any]]:
    """Return all emitted incident candidates."""
    return correlation.get_all_candidates()


@app.post("/reset")
def reset() -> dict[str, str]:
    """Reset state between scenarios (demo/testing use)."""
    _scenario_window_start.clear()
    correlation.reset()
    from .state_store import StateStore
    # Replace store contents
    store._assets.clear()
    if hasattr(store, "_latest_site_weather"):
        del store._latest_site_weather
    return {"status": "reset"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ingestion"}
