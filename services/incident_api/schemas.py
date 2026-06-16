"""Pydantic response schemas for the Incident Report API (§13.8)."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class EvidenceItem(BaseModel):
    evidence_id: str
    text: str
    source: str


class BusinessImpact(BaseModel):
    energy_loss_mwh_per_day: float
    revenue_loss_usd_per_day: float
    energy_price_per_mwh: float


class Governance(BaseModel):
    approval_required: bool
    auto_executable: bool
    escalation_level: str
    requires_immediate: bool
    decision: Optional[str] = None
    audit_id: str


class TraceInfo(BaseModel):
    tfy_trace_id: str
    llm_calls: int
    total_latency_ms: int
    total_cost_usd: float


class IncidentReport(BaseModel):
    incident_id: str
    scenario_id: str
    site_id: str
    asset_id: str
    asset_name: str
    created_at: str
    status: str
    title: str
    root_cause: str
    priority: str
    confidence: float
    symptom: str
    anomaly_score: float
    grouped_alert_ids: list[str]
    alert_count: int
    evidence: list[dict[str, Any]]
    business_impact: BusinessImpact
    recommended_action: str
    action_window_hours: int
    governance: Governance
    operator_briefing: str
    trace: TraceInfo


class IncidentSummary(BaseModel):
    incident_id: str
    asset_id: str
    asset_name: Optional[str] = None
    title: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    root_cause: Optional[str] = None
    anomaly_score: Optional[float] = None
    created_at: Optional[str] = None


class DecisionRequest(BaseModel):
    decision: str   # "approved" | "rejected"
    actor: str
