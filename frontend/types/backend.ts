/**
 * Backend wire-format types matching §14.5 (snake_case).
 * These are NEVER exposed to the UI — always map through adapters.ts.
 */

export interface BackendBusinessImpact {
  energy_loss_mwh_per_day: number;
  revenue_loss_usd_per_day: number;
  energy_price_per_mwh: number;
}

export interface BackendGovernance {
  approval_required: boolean;
  auto_executable: boolean;
  escalation_level: string;
  requires_immediate: boolean;
  decision: string | null;
  audit_id: string;
}

export interface BackendTraceInfo {
  tfy_trace_id: string;
  llm_calls: number;
  total_latency_ms: number;
  total_tokens?: number;
  total_cost_usd: number;
}

export interface BackendEvidenceItem {
  evidence_id: string;
  text: string;
  source: string;
  incident_id?: string;
}

export interface BackendIncidentReport {
  incident_id: string;
  scenario_id: string;
  site_id: string;
  asset_id: string;
  asset_name: string;
  asset_type?: string;
  created_at: string;
  status: string;
  title: string;
  root_cause: string;
  priority: string;
  confidence: number;
  symptom: string;
  anomaly_score: number;
  grouped_alert_ids: string[];
  alert_count: number;
  evidence: BackendEvidenceItem[];
  business_impact: BackendBusinessImpact;
  recommended_action: string;
  action_window_hours: number;
  governance: BackendGovernance;
  operator_briefing: string;
  trace: BackendTraceInfo;
}

/** Summary shape returned by GET /api/incidents */
export interface BackendIncidentSummary {
  incident_id: string;
  scenario_id: string | null;
  asset_id: string;
  asset_name: string | null;
  site_id: string | null;
  title: string | null;
  priority: string | null;
  status: string | null;
  root_cause: string | null;
  anomaly_score: number | null;
  confidence: number | null;
  created_at: string | null;
}

export interface BackendAuditEntry {
  audit_id: string;
  incident_id: string;
  action: string;
  actor: string;
  decision?: string | null;
  reason?: string;
  requires_human?: boolean;
  timestamp: string;
}

export interface BackendAuditResponse {
  incident_id: string;
  audit_trail: BackendAuditEntry[];
}

export interface BackendScenarioRunResponse {
  status: string;
  scenario: string;
  scenario_id: string;
  event_count: number;
  message: string;
}
