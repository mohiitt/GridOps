"""
In-memory + file-backed incident report store.

Loads reports from data/eval_reports/*.json on startup.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_reports: dict[str, dict[str, Any]] = {}
_audit_log: dict[str, list[dict[str, Any]]] = {}

EVAL_DIR = Path("data/eval_reports")


def _load_from_disk() -> None:
    """Load any existing reports from data/eval_reports/ on startup."""
    if EVAL_DIR.exists():
        for path in EVAL_DIR.glob("*.json"):
            try:
                report = json.loads(path.read_text())
                inc_id = report.get("incident_id")
                if inc_id:
                    _reports[inc_id] = report
            except Exception:
                pass


def add_report(report: dict[str, Any]) -> None:
    inc_id = report["incident_id"]
    _reports[inc_id] = report
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / f"{inc_id}.json").write_text(json.dumps(report, indent=2))


def get_report(incident_id: str) -> dict[str, Any] | None:
    return _reports.get(incident_id)


def list_reports() -> list[dict[str, Any]]:
    """Return summary list (no evidence/briefing for list view)."""
    summaries = []
    for r in _reports.values():
        summaries.append({
            "incident_id": r.get("incident_id"),
            "asset_id": r.get("asset_id"),
            "asset_name": r.get("asset_name"),
            "title": r.get("title"),
            "priority": r.get("priority"),
            "status": r.get("status"),
            "root_cause": r.get("root_cause"),
            "anomaly_score": r.get("anomaly_score"),
            "created_at": r.get("created_at"),
        })
    return sorted(summaries, key=lambda x: x.get("created_at", ""), reverse=True)


def add_audit_entry(incident_id: str, entry: dict[str, Any]) -> None:
    _audit_log.setdefault(incident_id, []).append(entry)


def get_audit_log(incident_id: str) -> list[dict[str, Any]]:
    return _audit_log.get(incident_id, [])


def apply_decision(incident_id: str, decision: str, actor: str) -> dict[str, Any] | None:
    """Apply an operator decision (approved/rejected) to a report."""
    report = _reports.get(incident_id)
    if not report:
        return None
    report["governance"]["decision"] = decision
    report["status"] = "approved" if decision == "approved" else "rejected"
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    (EVAL_DIR / f"{incident_id}.json").write_text(json.dumps(report, indent=2))
    return report


# Load on import
_load_from_disk()
