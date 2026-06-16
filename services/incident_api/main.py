"""
Incident Report API — FastAPI, port 8000 per §13.8.

Frontend-facing endpoints:
  GET  /api/incidents                         → list summaries
  GET  /api/incidents/{incident_id}           → full report
  POST /api/incidents/{incident_id}/decision  → operator decision
  GET  /api/audit/{incident_id}               → audit trail
  GET  /api/scenarios                         → available scenarios + status
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .schemas import DecisionRequest, IncidentSummary
from common.ids import audit_id, work_order_id
from common.timeutil import utcnow_str

app = FastAPI(
    title="GridOps Incident Report API",
    description="Frontend-facing incident management API",
    version="1.0.0",
)

# Allow all origins for demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_audit_counter = 0

SCENARIOS = [
    {"scenario_id": "SCN-A", "name": "normal_operation", "status": "available"},
    {"scenario_id": "SCN-B", "name": "inverter_cooling_degradation", "status": "available"},
    {"scenario_id": "SCN-C", "name": "bess_thermal_risk", "status": "available"},
    {"scenario_id": "SCN-D", "name": "weather_false_positive", "status": "available"},
]


@app.get("/api/incidents", response_model=list[IncidentSummary])
def list_incidents() -> list[dict[str, Any]]:
    """Return list of all incident report summaries."""
    return store.list_reports()


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str) -> dict[str, Any]:
    """Return full incident report."""
    report = store.get_report(incident_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return report


@app.post("/api/incidents/{incident_id}/decision")
def make_decision(incident_id: str, body: DecisionRequest) -> dict[str, Any]:
    """
    Record an operator decision (approved/rejected).
    Creates a governance audit entry. If approved, simulates work order creation.
    """
    global _audit_counter

    report = store.get_report(incident_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="decision must be 'approved' or 'rejected'")

    now = utcnow_str()
    _audit_counter += 1

    # Audit entry for decision
    decision_audit = {
        "audit_id": audit_id(_audit_counter),
        "incident_id": incident_id,
        "action": "approved" if body.decision == "approved" else "rejected",
        "actor": body.actor,
        "decision": body.decision,
        "reason": f"Operator {body.actor} {body.decision} the recommended action",
        "requires_human": False,
        "timestamp": now,
    }
    store.add_audit_entry(incident_id, decision_audit)

    # Update report governance
    updated = store.apply_decision(incident_id, body.decision, body.actor)

    result: dict[str, Any] = {"status": "ok", "decision": body.decision, "audit": decision_audit}

    # If approved, simulate work order creation
    if body.decision == "approved":
        _audit_counter += 1
        wo_id = work_order_id(2026, _audit_counter + 4400)
        wo_event = {
            "work_order_id": wo_id,
            "incident_id": incident_id,
            "status": "created",
            "priority": report.get("priority", "high"),
            "assigned_to": body.actor,
            "task": report.get("recommended_action", "").replace("_", " "),
            "created_by": "GridOpsAI",
            "approval_ref": decision_audit["audit_id"],
            "created_at": now,
        }
        result["work_order"] = wo_event

        # Store work order audit
        wo_audit = {
            "audit_id": audit_id(_audit_counter),
            "incident_id": incident_id,
            "action": "workorder_created",
            "actor": "GridOpsAI",
            "decision": "approved",
            "reason": f"Work order {wo_id} created after approval",
            "requires_human": False,
            "timestamp": now,
        }
        store.add_audit_entry(incident_id, wo_audit)

    return result


@app.get("/api/audit/{incident_id}")
def get_audit(incident_id: str) -> dict[str, Any]:
    """Return the full audit trail for an incident."""
    report = store.get_report(incident_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    # Combine governance audit_id from report + any decision entries
    initial_audit = {
        "audit_id": report.get("governance", {}).get("audit_id", ""),
        "incident_id": incident_id,
        "action": "approval_requested",
        "actor": "GridOpsAI",
        "decision": None,
        "reason": "Incident report generated, awaiting operator approval",
        "requires_human": report.get("governance", {}).get("approval_required", True),
        "timestamp": report.get("created_at"),
    }

    entries = [initial_audit] + store.get_audit_log(incident_id)
    return {"incident_id": incident_id, "audit_trail": entries}


@app.get("/api/scenarios")
def list_scenarios() -> list[dict[str, Any]]:
    """Return available scenarios and their data generation status."""
    scenarios_dir = Path("data/scenarios")
    result = []
    for s in SCENARIOS:
        scenario_dir = scenarios_dir / s["name"]
        has_data = scenario_dir.exists() and (scenario_dir / "telemetry_events.jsonl").exists()
        incidents = [
            r for r in store.list_reports()
            if r.get("scenario_id") == s["scenario_id"]
        ]
        result.append({
            **s,
            "data_generated": has_data,
            "incident_count": len(incidents),
        })
    return result


@app.post("/api/reports")
def ingest_report(report: dict[str, Any]) -> dict[str, Any]:
    """
    Accept a report from the crew service and store it.
    Used by crew service to register its reports with the API.
    """
    store.add_report(report)
    return {"status": "stored", "incident_id": report.get("incident_id")}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "incident_api"}
