"""
Event Ingestion Service — FastAPI, port 8002 per §13.4.

Endpoints:
  POST /ingest          → accept one Envelope
  GET  /state/{asset_id} → current window (debug)
  GET  /candidates      → list of open incident candidates
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from common.envelope import Envelope
from .event_router import route_event
from .state_store import store
from . import correlation

app = FastAPI(
    title="GridOps Event Ingestion Service",
    description="Ingests event envelopes and triggers incident correlation",
    version="1.0.0",
)

# Track when the current scenario window started
_scenario_window_start: dict[str, str] = {}


class IngestResponse(BaseModel):
    status: str
    candidates_emitted: int
    candidate_id: str | None = None


@app.post("/ingest", response_model=IngestResponse)
def ingest(envelope: Envelope) -> IngestResponse:
    """Ingest one event envelope and optionally emit an incident candidate."""
    # Track first event timestamp per asset as window_start
    asset_id = envelope.asset_id or envelope.site_id
    if asset_id not in _scenario_window_start:
        _scenario_window_start[asset_id] = envelope.timestamp

    # Update state store
    route_event(envelope.model_dump(), store)

    # Trigger correlation on new alert events
    candidate = None
    if envelope.event_type == "alert" and envelope.asset_id:
        window_start = _scenario_window_start.get(envelope.asset_id, envelope.timestamp)
        candidate = correlation.on_new_alert(
            asset_id=envelope.asset_id,
            envelope_timestamp=envelope.timestamp,
            store=store,
            window_start=window_start,
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
