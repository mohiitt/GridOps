/**
 * Adapters: backend (snake_case) → frontend (camelCase) type mappings.
 *
 * Backend §14.5 schema → frontend types/index.ts
 * NEVER call backend APIs directly from UI components — go through api.ts.
 */

import type {
  Incident,
  Evidence,
  AuditEvent,
  AgentTrace,
  TrueFoundryTrace,
  Severity,
  IncidentStatus,
  ScenarioId,
} from "../types";

import type {
  BackendIncidentReport,
  BackendIncidentSummary,
  BackendEvidenceItem,
  BackendAuditEntry,
  BackendAuditResponse,
  BackendTraceInfo,
} from "../types/backend";

// ── Scenario ID helpers ────────────────────────────────────────────────────────

const SCENARIO_ID_TO_BACKEND_NAME: Record<ScenarioId, string> = {
  normal: "normal_operation",
  inverter_cooling: "inverter_cooling_degradation",
  bess_thermal: "bess_thermal_risk",
  weather_fp: "weather_false_positive",
};

const BACKEND_SCN_ID_TO_FRONTEND: Record<string, ScenarioId> = {
  "SCN-A": "normal",
  "SCN-B": "inverter_cooling",
  "SCN-C": "bess_thermal",
  "SCN-D": "weather_fp",
};

const SCENARIO_ID_TO_SCN: Record<ScenarioId, string> = {
  normal: "SCN-A",
  inverter_cooling: "SCN-B",
  bess_thermal: "SCN-C",
  weather_fp: "SCN-D",
};

export function scenarioIdToBackendName(id: ScenarioId): string {
  return SCENARIO_ID_TO_BACKEND_NAME[id];
}

export function scenarioIdToScnId(id: ScenarioId): string {
  return SCENARIO_ID_TO_SCN[id];
}

export function scnIdToScenarioId(scnId: string): ScenarioId | null {
  return BACKEND_SCN_ID_TO_FRONTEND[scnId] ?? null;
}

// ── Priority → Severity ───────────────────────────────────────────────────────

export function mapPriorityToSeverity(priority: string | null | undefined): Severity {
  switch ((priority ?? "").toLowerCase()) {
    case "critical": return "critical";
    case "high":     return "high";
    case "medium":   return "medium";
    case "low":      return "low";
    default:         return "info";
  }
}

// ── Status mapping ─────────────────────────────────────────────────────────────

export function mapBackendStatus(status: string | null | undefined): IncidentStatus {
  switch ((status ?? "").toLowerCase()) {
    case "awaiting_approval":
    case "awaiting_review":   return "awaiting_review";
    case "approved":          return "approved";
    case "rejected":          return "closed";
    case "work_order_created": return "work_order_created";
    case "closed":            return "closed";
    case "analyzing":         return "analyzing";
    default:                  return "new";
  }
}

// ── Site ID → display name ─────────────────────────────────────────────────────

function siteIdToDisplay(siteId: string | null | undefined): string {
  if (!siteId) return "Unknown Site";
  if (siteId === "SITE-DS-001") return "Desert Sun Solar + BESS";
  return siteId;
}

// ── Root cause → human readable title ────────────────────────────────────────

function rootCauseToDisplay(rc: string): string {
  const map: Record<string, string> = {
    cooling_subsystem_degradation: "Cooling Subsystem Degradation",
    bess_thermal_management_degradation: "BESS Thermal Management Degradation",
    weather_driven_output_reduction: "Weather-Driven Output Reduction",
    normal_operation: "Normal Operation",
  };
  return map[rc] ?? rc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Recommended action → human readable ──────────────────────────────────────

function actionToDisplay(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Evidence source → frontend sourceType ─────────────────────────────────────

type EvidenceSourceType = Evidence["sourceType"];

function mapEvidenceSource(source: string): EvidenceSourceType {
  const lower = source.toLowerCase();
  if (lower.includes("telemetry") || lower.includes("spec")) return "asset_spec";
  if (lower.includes("maintenance")) return "maintenance_history";
  if (lower.includes("weather") || lower.includes("forecast")) return "weather_context";
  if (lower.includes("manufacturer") || lower.includes("note")) return "manufacturer_bulletin";
  return "operating_procedure";
}

// ── Main adapter: BackendIncidentReport → Incident ────────────────────────────

export function mapBackendIncident(report: BackendIncidentReport): Incident {
  return {
    id: report.incident_id,
    title: report.title,
    assetId: report.asset_id,
    assetName: report.asset_name,
    assetType: report.asset_type ?? deriveAssetType(report.asset_id),
    site: siteIdToDisplay(report.site_id),
    severity: mapPriorityToSeverity(report.priority),
    status: mapBackendStatus(report.status),
    rootCause: rootCauseToDisplay(report.root_cause),
    rootCauseNarrative: report.operator_briefing || rootCauseToDisplay(report.root_cause),
    confidence: report.confidence,
    groupedAlertCount: report.alert_count,
    energyImpactMWhPerDay: report.business_impact?.energy_loss_mwh_per_day ?? 0,
    revenueImpactPerDay: report.business_impact?.revenue_loss_usd_per_day ?? 0,
    recommendedAction: actionToDisplay(report.recommended_action),
    approvalRequired: report.governance?.approval_required ?? true,
    approver: "Operator",
    createdAt: report.created_at,
    evidenceIds: (report.evidence ?? []).map((e) => e.evidence_id),
    telemetrySeriesIds: [],   // not returned by backend; UI will use fixtures as fallback
    alertIds: report.grouped_alert_ids ?? [],
  };
}

/** Adapt from summary (list endpoint) — fills what we have, leaves rest as defaults */
export function mapBackendSummary(summary: BackendIncidentSummary): Partial<Incident> & { id: string } {
  return {
    id: summary.incident_id,
    title: summary.title ?? `Incident ${summary.incident_id}`,
    assetId: summary.asset_id,
    assetName: summary.asset_name ?? summary.asset_id,
    assetType: deriveAssetType(summary.asset_id),
    site: siteIdToDisplay(summary.site_id),
    severity: mapPriorityToSeverity(summary.priority),
    status: mapBackendStatus(summary.status),
    rootCause: rootCauseToDisplay(summary.root_cause ?? ""),
    confidence: summary.confidence ?? 0,
    createdAt: summary.created_at ?? new Date().toISOString(),
  };
}

function deriveAssetType(assetId: string): string {
  if (assetId?.startsWith("INV-")) return "Solar Inverter";
  if (assetId?.startsWith("BESS-")) return "BESS Unit";
  if (assetId?.startsWith("XFMR-")) return "Transformer";
  return "Solar Inverter";
}

// ── Evidence adapter ──────────────────────────────────────────────────────────

export function mapBackendEvidence(item: BackendEvidenceItem, incidentId: string): Evidence {
  return {
    id: item.evidence_id,
    incidentId,
    sourceType: mapEvidenceSource(item.source),
    title: item.text.split(".")[0].slice(0, 80),  // first sentence as title
    summary: item.text,
    relevanceScore: 0.85,  // not provided by backend; use a good default
    timestamp: undefined,
  };
}

// ── Audit adapter ─────────────────────────────────────────────────────────────

const AUDIT_ACTION_MAP: Record<string, AuditEvent["action"]> = {
  approval_requested: "approval_requested",
  approved: "approved",
  rejected: "rejected",
  escalated: "escalated",
  workorder_created: "workorder_created",
  acknowledged: "acknowledged",
};

function mapAuditAction(action: string): AuditEvent["action"] {
  return AUDIT_ACTION_MAP[action] ?? "acknowledged";
}

export function mapBackendAudit(response: BackendAuditResponse): AuditEvent[] {
  return (response.audit_trail ?? []).map((entry) => ({
    id: entry.audit_id,
    incidentId: entry.incident_id,
    timestamp: entry.timestamp,
    actor: entry.actor,
    action: mapAuditAction(entry.action),
    reason: entry.reason,
  }));
}

// ── TrueFoundry trace builder (synthetic per §observability requirements) ─────

const AGENT_NAMES = [
  "Correlation Agent",
  "Telemetry Analyst",
  "Alert Classifier",
  "Weather Context Agent",
  "Root Cause Agent",
  "Business Impact Agent",
  "Recommendation Agent",
  "Governance Agent",
  "Operator Briefing Agent",
];

export function buildAgentTracesFromReport(
  report: BackendIncidentReport,
  incidentId: string,
): AgentTrace[] {
  const totalMs = report.trace?.total_latency_ms ?? 3000;
  const perAgent = Math.round(totalMs / AGENT_NAMES.length);
  const perCost = (report.trace?.total_cost_usd ?? 0) / AGENT_NAMES.length;

  return AGENT_NAMES.map((name, i) => ({
    id: `${incidentId}-agent-${i}`,
    incidentId,
    order: i + 1,
    agentName: name,
    role: name,
    status: "complete" as const,
    inputSummary: `Input from step ${i}`,
    outputSummary: `Output from ${name}`,
    model: name === "Operator Briefing Agent" ? "gpt-4o" : "gpt-4o-mini",
    latencyMs: perAgent,
    costUsd: Math.round(perCost * 1e6) / 1e6,
    confidence: 0.9,
  }));
}

export function buildTrueFoundryTracesFromReport(
  report: BackendIncidentReport,
  incidentId: string,
): TrueFoundryTrace[] {
  const trace = report.trace;
  if (!trace) return [];

  const totalMs = trace.total_latency_ms ?? 3000;
  const perAgent = Math.round(totalMs / AGENT_NAMES.length);
  const perCost = (trace.total_cost_usd ?? 0) / AGENT_NAMES.length;
  const isGateway = trace.tfy_trace_id.startsWith("tfy_");

  return AGENT_NAMES.map((name, i) => ({
    id: `${incidentId}-tfy-${i}`,
    incidentId,
    caller: name,
    service: isGateway ? "TrueFoundry AI Gateway" : "OpenAI Direct",
    model: name === "Operator Briefing Agent" ? "gpt-4o" : "gpt-4o-mini",
    routedModel: name === "Operator Briefing Agent" ? "openai/gpt-4o" : "openai/gpt-4o-mini",
    provider: "OpenAI",
    endpoint: isGateway ? "/v1/chat/completions" : "api.openai.com/v1/chat/completions",
    latencyMs: perAgent,
    costUsd: Math.round(perCost * 1e6) / 1e6,
    status: "success" as const,
    timestamp: report.created_at,
  }));
}
