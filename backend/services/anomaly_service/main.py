"""
Anomaly Scoring Service — FastAPI, port 8001 per §13.5.

TrueFoundry-deployable. Exposes POST /score.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from .scoring import score_asset

app = FastAPI(
    title="GridOps Anomaly Scoring Service",
    description="Rule-based anomaly scoring for solar + BESS assets",
    version="1.0.0",
)


class ScoreRequest(BaseModel):
    asset_id: str
    asset_type: str
    telemetry_window: list[dict[str, Any]] = []
    alerts: list[dict[str, Any]] = []
    weather: dict[str, Any] | None = None
    forecast: dict[str, Any] | None = None
    dispatch_active: bool = False


class ScoreResponse(BaseModel):
    asset_id: str
    anomaly_score: float
    severity: str
    symptom: str
    confidence: float
    features: dict[str, Any]


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    """Compute anomaly score for an asset telemetry window."""
    result = score_asset(
        asset_id=req.asset_id,
        asset_type=req.asset_type,
        telemetry_window=req.telemetry_window,
        alerts=req.alerts,
        weather=req.weather,
        forecast=req.forecast,
        dispatch_active=req.dispatch_active,
    )
    return ScoreResponse(**result)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "anomaly_scoring"}
