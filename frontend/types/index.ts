export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type IncidentStatus =
  | "new"
  | "analyzing"
  | "awaiting_review"
  | "approved"
  | "work_order_created"
  | "closed";

export type ScenarioId = "normal" | "inverter_cooling" | "bess_thermal" | "weather_fp";

export interface Incident {
  id: string;
  title: string;
  assetId: string;
  assetName: string;
  assetType: string;
  site: string;
  severity: Severity;
  status: IncidentStatus;
  rootCause: string;
  rootCauseNarrative: string; // 2-4 sentence operator briefing
  confidence: number; // 0..1
  groupedAlertCount: number;
  energyImpactMWhPerDay: number;
  revenueImpactPerDay: number;
  recommendedAction: string;
  approvalRequired: boolean;
  approver: string;
  createdAt: string; // ISO-8601 Z
  evidenceIds: string[];
  telemetrySeriesIds: string[];
  alertIds: string[];
}

export interface Alert {
  id: string;
  timestamp: string;
  assetId: string;
  severity: Severity;
  source: "SCADA" | "BESS" | "Inverter" | "Weather" | "CMMS" | "Grid";
  alertType: string; // controlled vocab (matches backend §8)
  message: string;
  groupedIntoIncidentId?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: "Solar Inverter" | "BESS Unit" | "Transformer" | "Substation" | "Weather Station" | "Site";
  site: string;
  capacityMw?: number;
  runtimeHours?: number;
  status: "healthy" | "warning" | "critical" | "offline";
}

export interface TelemetryPoint {
  timestamp: string;
  value: number;
}

export interface TelemetrySeries {
  id: string;
  incidentId: string;
  metric: string; // e.g. "inverter_temperature_c"
  title: string;
  unit: string;
  threshold?: number;
  series: TelemetryPoint[];
  comparisonSeries?: TelemetryPoint[]; // forecast/expected
}

export interface Evidence {
  id: string;
  incidentId: string;
  sourceType:
    | "maintenance_history"
    | "manufacturer_bulletin"
    | "weather_context"
    | "asset_spec"
    | "operating_procedure";
  title: string;
  summary: string;
  relevanceScore: number; // 0..1
  timestamp?: string;
}

export interface AgentTrace {
  id: string;
  incidentId: string;
  order: number;
  agentName: string;
  role: string;
  status: "pending" | "running" | "complete" | "warning" | "failed";
  inputSummary: string;
  outputSummary: string;
  model: string;
  latencyMs: number;
  costUsd: number;
  confidence?: number;
}

export interface TrueFoundryTrace {
  id: string;
  incidentId: string;
  caller: string; // agent name
  service: string;
  model: string;
  routedModel: string;
  provider: string;
  endpoint: string;
  latencyMs: number;
  costUsd: number;
  status: "success" | "failed" | "fallback";
  timestamp: string;
}

export interface GovernanceRule {
  id: string;
  name: string;
  condition: string;
  triggered: boolean;
  action: string;
  severity: Severity;
}

export interface AuditEvent {
  id: string;
  incidentId: string;
  timestamp: string;
  actor: string;
  action:
    | "approval_requested"
    | "approved"
    | "rejected"
    | "escalated"
    | "workorder_created"
    | "acknowledged";
  reason?: string;
}

export interface EvaluationCase {
  scenario: string;
  expectedRootCause: string;
  predictedRootCause: string;
  expectedPriority: Severity;
  predictedPriority: Severity;
  expectedAction: string;
  predictedAction: string;
  result: "pass" | "fail" | "partial";
}

export interface ScenarioBundle {
  scenarioId: ScenarioId;
  label: string;
  kpis: Record<string, { value: string; subtext?: string; trend?: string; status?: string }>;
  incidents: Incident[];
  alerts: Alert[];
  evidence: Evidence[];
  telemetry: TelemetrySeries[];
  agentTraces: AgentTrace[];
  trueFoundryTraces: TrueFoundryTrace[];
  governanceRules: GovernanceRule[];
  auditTrail: AuditEvent[];
  evaluationCases: EvaluationCase[];
}
