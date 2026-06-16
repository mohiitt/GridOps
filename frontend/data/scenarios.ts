import { ScenarioBundle, ScenarioId, Incident, Alert, Evidence, AgentTrace, TrueFoundryTrace, GovernanceRule, AuditEvent, EvaluationCase } from "../types";

// Helper to generate a range of timestamps
function generateTimestamps(count: number, intervalMinutes: number = 10): string[] {
  const start = new Date("2026-06-16T08:00:00Z");
  const timestamps: string[] = [];
  for (let i = 0; i < count; i++) {
    const time = new Date(start.getTime() + i * intervalMinutes * 60 * 1000);
    timestamps.push(time.toISOString().replace(/\.\d+Z$/, "Z"));
  }
  return timestamps;
}

const timestamps = generateTimestamps(37); // 6 hours @ 10-minute intervals = 37 points

// --- SCENARIO A: NORMAL OPERATION ---
const scenarioA_Incidents: Incident[] = [
  {
    id: "INC-0007",
    title: "Nominal operation — minor weather variation",
    assetId: "SITE-DS-001",
    assetName: "Desert Sun Solar + BESS",
    assetType: "Site",
    site: "Desert Sun Solar + BESS",
    severity: "low",
    status: "new",
    rootCause: "Normal Operation",
    rootCauseNarrative: "All assets operating within normal ranges. Minor output variation is fully explained by weather. No equipment anomaly detected.",
    confidence: 0.94,
    groupedAlertCount: 1,
    energyImpactMWhPerDay: 0.2,
    revenueImpactPerDay: 15,
    recommendedAction: "Continue monitoring",
    approvalRequired: false,
    approver: "—",
    createdAt: "2026-06-16T14:40:00Z",
    evidenceIds: ["EV-0007-1"],
    telemetrySeriesIds: ["TS-0007-power"],
    alertIds: ["ALT-0007-01"],
  }
];

const scenarioA_Alerts: Alert[] = [
  {
    id: "ALT-0007-01",
    timestamp: "2026-06-16T13:30:00Z",
    assetId: "SITE-DS-001",
    severity: "info",
    source: "Weather",
    alertType: "output_below_forecast_weather",
    message: "Minor weather fluctuation. Tracking normally.",
    groupedIntoIncidentId: "INC-0007"
  }
];

const scenarioA_Evidence: Evidence[] = [
  {
    id: "EV-0007-1",
    incidentId: "INC-0007",
    sourceType: "weather_context",
    title: "Weather fully explains output",
    summary: "Irradiance variation aligns perfectly with small temperature drop. No equipment mismatch found.",
    relevanceScore: 0.95,
    timestamp: "2026-06-16T13:30:00Z"
  }
];

const scenarioA_Telemetry = [
  {
    id: "TS-0007-power",
    incidentId: "INC-0007",
    metric: "active_power_kw",
    title: "Active Power",
    unit: "kW",
    threshold: 4000,
    series: timestamps.map((ts, idx) => ({
      timestamp: ts,
      value: 3600 + Math.sin(idx / 10) * 100 + Math.random() * 20
    })),
    comparisonSeries: timestamps.map((ts, idx) => ({
      timestamp: ts,
      value: 3600 + Math.sin(idx / 10) * 100
    }))
  }
];

const scenarioA_AgentTraces: AgentTrace[] = [
  {
    id: "AT-0007-1",
    incidentId: "INC-0007",
    order: 1,
    agentName: "Alert Correlation Agent",
    role: "Group related alerts into one cluster",
    status: "complete",
    inputSummary: "1 raw weather alert",
    outputSummary: "Normal baseline confirmed",
    model: "gpt-4o-mini",
    latencyMs: 400,
    costUsd: 0.001
  },
  {
    id: "AT-0007-2",
    incidentId: "INC-0007",
    order: 2,
    agentName: "Telemetry Analysis Agent",
    role: "Detect trends and time-ordering",
    status: "complete",
    inputSummary: "6h nominal telemetry",
    outputSummary: "Telemetry within expected boundaries",
    model: "gpt-4o-mini",
    latencyMs: 700,
    costUsd: 0.002,
    confidence: 0.95
  },
  {
    id: "AT-0007-3",
    incidentId: "INC-0007",
    order: 3,
    agentName: "Operator Briefing Agent",
    role: "Write operator summary",
    status: "complete",
    inputSummary: "Full incident data",
    outputSummary: "Nominal operation brief",
    model: "gpt-4o",
    latencyMs: 900,
    costUsd: 0.003,
    confidence: 0.94
  }
];

const scenarioA_TrueFoundryTraces: TrueFoundryTrace[] = [
  {
    id: "TF-0007-1",
    incidentId: "INC-0007",
    caller: "Operator Briefing Agent",
    service: "ai-gateway",
    model: "gpt-4o",
    routedModel: "gpt-4o",
    provider: "OpenAI",
    endpoint: "/api/llm/chat/completions",
    latencyMs: 900,
    costUsd: 0.003,
    status: "success",
    timestamp: "2026-06-16T14:40:05Z"
  }
];


// --- SCENARIO B: INVERTER COOLING DEGRADATION ---
const scenarioB_Incidents: Incident[] = [
  {
    id: "INC-1042",
    title: "Cooling subsystem degradation on Solar Inverter INV-042",
    assetId: "INV-042",
    assetName: "Solar Inverter INV-042",
    assetType: "Solar Inverter",
    site: "Desert Sun Solar + BESS",
    severity: "high",
    status: "awaiting_review",
    rootCause: "Cooling Subsystem Degradation",
    rootCauseNarrative: "INV-042 shows progressive cooling subsystem degradation. Inverter temperature rose ahead of an output decline, conversion efficiency fell below normal range, and actual output dropped below the weather-adjusted forecast. Weather does not explain the loss. A similar cooling-fan issue occurred 8 months ago and runtime now exceeds the 18,000-hour fan-risk threshold.",
    confidence: 0.82,
    groupedAlertCount: 12,
    energyImpactMWhPerDay: 2.8,
    revenueImpactPerDay: 210,
    recommendedAction: "Inspect cooling fan within 24 hours",
    approvalRequired: true,
    approver: "Site Engineer",
    createdAt: "2026-06-16T14:40:00Z",
    evidenceIds: ["EV-1042-1", "EV-1042-2", "EV-1042-3", "EV-1042-4", "EV-1042-5"],
    telemetrySeriesIds: ["TS-1042-temp", "TS-1042-fan", "TS-1042-power", "TS-1042-eff"],
    alertIds: ["ALT-1042-01", "ALT-1042-02", "ALT-1042-03", "ALT-1042-04", "ALT-1042-05", "ALT-1042-06", "ALT-1042-07"]
  }
];

const scenarioB_Alerts: Alert[] = [
  { id: "ALT-1042-01", timestamp: "2026-06-16T13:30:00Z", assetId: "INV-042", severity: "medium", source: "Inverter", alertType: "inverter_temperature_high", message: "Inverter temperature 78.4°C exceeds 75°C threshold", groupedIntoIncidentId: "INC-1042" },
  { id: "ALT-1042-02", timestamp: "2026-06-16T13:50:00Z", assetId: "INV-042", severity: "medium", source: "SCADA", alertType: "efficiency_drop", message: "Conversion efficiency 95.2% below 96% standard", groupedIntoIncidentId: "INC-1042" },
  { id: "ALT-1042-03", timestamp: "2026-06-16T14:10:00Z", assetId: "INV-042", severity: "high", source: "SCADA", alertType: "output_below_forecast", message: "Output 11% below weather-adjusted forecast", groupedIntoIncidentId: "INC-1042" },
  { id: "ALT-1042-04", timestamp: "2026-06-16T14:20:00Z", assetId: "INV-042", severity: "high", source: "Inverter", alertType: "inverter_temperature_high", message: "Inverter temperature 87.4°C exceeds critical 85°C threshold", groupedIntoIncidentId: "INC-1042" },
  { id: "ALT-1042-05", timestamp: "2026-06-16T14:22:00Z", assetId: "INV-042", severity: "high", source: "Inverter", alertType: "cooling_fan_irregular", message: "Cooling fan 1080 RPM with temp 86.2°C", groupedIntoIncidentId: "INC-1042" },
  { id: "ALT-1042-06", timestamp: "2026-06-16T14:25:00Z", assetId: "INV-042", severity: "medium", source: "SCADA", alertType: "voltage_instability", message: "Voltage variance 2.4 above 2.0 limit", groupedIntoIncidentId: "INC-1042" },
  { id: "ALT-1042-07", timestamp: "2026-06-16T14:30:00Z", assetId: "INV-042", severity: "medium", source: "SCADA", alertType: "communication_timeout", message: "Telemetry gap after thermal warning", groupedIntoIncidentId: "INC-1042" }
];

const scenarioB_Evidence: Evidence[] = [
  {
    id: "EV-1042-1",
    incidentId: "INC-1042",
    sourceType: "maintenance_history",
    title: "Similar cooling-fan issue 8 months ago",
    summary: "Work order WO-2025-00871: fan speed irregularity inspected, thermal sensor recalibrated. Note recommended fan replacement if temperature issue recurs.",
    relevanceScore: 0.91,
    timestamp: "2025-10-12T09:30:00Z"
  },
  {
    id: "EV-1042-2",
    incidentId: "INC-1042",
    sourceType: "manufacturer_bulletin",
    title: "Fan degradation risk after 18,000 runtime hours",
    summary: "SunGrid SG-4000-XT bulletin MN-INV-001: elevated fan-bearing failure probability beyond 18,000h; inspect if temp exceeds 80°C under nominal load.",
    relevanceScore: 0.88
  },
  {
    id: "EV-1042-3",
    incidentId: "INC-1042",
    sourceType: "weather_context",
    title: "Weather does not explain the loss",
    summary: "Irradiance stable (~910 W/m²), cloud cover 6%. Weather-adjusted forecast deviation 11% indicates equipment fault, not weather.",
    relevanceScore: 0.84,
    timestamp: "2026-06-16T14:30:00Z"
  },
  {
    id: "EV-1042-4",
    incidentId: "INC-1042",
    sourceType: "asset_spec",
    title: "Runtime above fan-risk threshold",
    summary: "INV-042 runtime 19,450h exceeds 18,000h fan-risk threshold.",
    relevanceScore: 0.79
  },
  {
    id: "EV-1042-5",
    incidentId: "INC-1042",
    sourceType: "operating_procedure",
    title: "Cooling inspection SOP",
    summary: "Procedure SOP-INV-COOL-03: inspect fan and recalibrate thermal sensors within 24h of sustained >85°C with efficiency loss.",
    relevanceScore: 0.72
  }
];

const scenarioB_Telemetry = [
  {
    id: "TS-1042-temp",
    incidentId: "INC-1042",
    metric: "inverter_temperature_c",
    title: "Inverter Temperature",
    unit: "°C",
    threshold: 85,
    series: timestamps.map((ts, idx) => {
      // Temperature ramps up from nominal (55) to critical (90) around idx 15
      let value = 55 + Math.random() * 2;
      if (idx > 12) {
        value += Math.min(35, (idx - 12) * 1.5);
      }
      return { timestamp: ts, value: parseFloat(value.toFixed(1)) };
    })
  },
  {
    id: "TS-1042-fan",
    incidentId: "INC-1042",
    metric: "cooling_fan_rpm",
    title: "Cooling Fan Speed",
    unit: "RPM",
    threshold: 1200,
    series: timestamps.map((ts, idx) => {
      // Fan speed drops from 2400 to 1080 around idx 12
      let value = 2400 + Math.random() * 50;
      if (idx > 12) {
        value -= Math.min(1320, (idx - 12) * 60 + Math.random() * 80);
      }
      return { timestamp: ts, value: Math.round(value) };
    })
  },
  {
    id: "TS-1042-power",
    incidentId: "INC-1042",
    metric: "active_power_kw",
    title: "Active Power Output",
    unit: "kW",
    series: timestamps.map((ts, idx) => {
      // Output drops from 3600 to 2980 around idx 15 (after temp rises)
      let value = 3600 + Math.random() * 40;
      if (idx > 15) {
        value -= Math.min(620, (idx - 15) * 45);
      }
      return { timestamp: ts, value: parseFloat(value.toFixed(0)) };
    }),
    comparisonSeries: timestamps.map((ts) => ({
      timestamp: ts,
      value: 3600 // Expected/Forecasted power adjusted for irradiance
    }))
  },
  {
    id: "TS-1042-eff",
    incidentId: "INC-1042",
    metric: "conversion_efficiency_pct",
    title: "Conversion Efficiency",
    unit: "%",
    threshold: 96,
    series: timestamps.map((ts, idx) => {
      // Efficiency drops from 98.3% to 94.2% around idx 14
      let value = 98.3 + Math.random() * 0.1;
      if (idx > 14) {
        value -= Math.min(4.1, (idx - 14) * 0.2);
      }
      return { timestamp: ts, value: parseFloat(value.toFixed(2)) };
    })
  }
];

const scenarioB_AgentTraces: AgentTrace[] = [
  { id: "AT-1042-1", incidentId: "INC-1042", order: 1, agentName: "Alert Correlation Agent", role: "Group related alerts into one cluster", status: "complete", inputSummary: "12 raw alerts on INV-042", outputSummary: "1 cluster, max severity high", model: "gpt-4o-mini", latencyMs: 820, costUsd: 0.004 },
  { id: "AT-1042-2", incidentId: "INC-1042", order: 2, agentName: "Telemetry Analysis Agent", role: "Detect trends and time-ordering", status: "complete", inputSummary: "6h telemetry window", outputSummary: "Thermal ramp; temp rose before output drop; fan unstable", model: "gpt-4o-mini", latencyMs: 1640, costUsd: 0.006, confidence: 0.81 },
  { id: "AT-1042-3", incidentId: "INC-1042", order: 3, agentName: "Maintenance History Agent", role: "Find recurring/known failures", status: "complete", inputSummary: "INV-042 records + bulletins", outputSummary: "Similar fan issue 8 months ago; runtime > threshold", model: "gpt-4o-mini", latencyMs: 1120, costUsd: 0.005 },
  { id: "AT-1042-4", incidentId: "INC-1042", order: 4, agentName: "Weather/Forecast Agent", role: "Separate weather from equipment fault", status: "complete", inputSummary: "Weather + forecast vs actual", outputSummary: "Weather does not explain loss; deviation 11%", model: "gpt-4o-mini", latencyMs: 980, costUsd: 0.004 },
  { id: "AT-1042-5", incidentId: "INC-1042", order: 5, agentName: "Root Cause Agent", role: "Synthesize single root cause", status: "complete", inputSummary: "Outputs of agents 1-4", outputSummary: "Cooling subsystem degradation (conf 0.83)", model: "gpt-4o-mini", latencyMs: 1530, costUsd: 0.007, confidence: 0.83 },
  { id: "AT-1042-6", incidentId: "INC-1042", order: 6, agentName: "Business Impact Agent", role: "Quantify impact", status: "complete", inputSummary: "Forecast vs actual, $75/MWh", outputSummary: "2.8 MWh/day, $210/day", model: "gpt-4o-mini", latencyMs: 640, costUsd: 0.003 },
  { id: "AT-1042-7", incidentId: "INC-1042", order: 7, agentName: "Safety/Governance Agent", role: "Apply governance rules", status: "warning", inputSummary: "Incident draft", outputSummary: "Approval required; escalation: site engineer", model: "gpt-4o-mini", latencyMs: 510, costUsd: 0.002 },
  { id: "AT-1042-8", incidentId: "INC-1042", order: 8, agentName: "Operator Briefing Agent", role: "Write operator summary", status: "complete", inputSummary: "Full incident", outputSummary: "Concise briefing generated", model: "gpt-4o", latencyMs: 2100, costUsd: 0.011, confidence: 0.82 }
];

const scenarioB_TrueFoundryTraces: TrueFoundryTrace[] = [
  { id: "TF-1042-1", incidentId: "INC-1042", caller: "Alert Correlation Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 820, costUsd: 0.004, status: "success", timestamp: "2026-06-16T14:40:01Z" },
  { id: "TF-1042-2", incidentId: "INC-1042", caller: "Telemetry Analysis Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 1640, costUsd: 0.006, status: "success", timestamp: "2026-06-16T14:40:03Z" },
  { id: "TF-1042-3", incidentId: "INC-1042", caller: "Maintenance History Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 1120, costUsd: 0.005, status: "success", timestamp: "2026-06-16T14:40:04Z" },
  { id: "TF-1042-4", incidentId: "INC-1042", caller: "Weather/Forecast Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 980, costUsd: 0.004, status: "success", timestamp: "2026-06-16T14:40:05Z" },
  { id: "TF-1042-5", incidentId: "INC-1042", caller: "Root Cause Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 1530, costUsd: 0.007, status: "success", timestamp: "2026-06-16T14:40:06Z" },
  { id: "TF-1042-8", incidentId: "INC-1042", caller: "Operator Briefing Agent", service: "ai-gateway", model: "gpt-4o", routedModel: "gpt-4o", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 2100, costUsd: 0.011, status: "success", timestamp: "2026-06-16T14:40:10Z" },
  { id: "TF-1042-A", incidentId: "INC-1042", caller: "Anomaly Scoring", service: "renewable-anomaly-service", model: "rule-based", routedModel: "rule-based", provider: "TrueFoundry", endpoint: "/score", latencyMs: 180, costUsd: 0.0, status: "success", timestamp: "2026-06-16T14:39:58Z" }
];


// --- SCENARIO C: BESS THERMAL RISK ---
const scenarioC_Incidents: Incident[] = [
  {
    id: "INC-2091",
    title: "Thermal management system degradation on BESS Unit BESS-011",
    assetId: "BESS-011",
    assetName: "BESS Unit BESS-011",
    assetType: "BESS Unit",
    site: "Desert Sun Solar + BESS",
    severity: "critical",
    status: "awaiting_review",
    rootCause: "Thermal Management System Degradation",
    rootCauseNarrative: "BESS-011 battery and cooling-loop temperatures are rising during an active grid dispatch. State-of-charge behavior is abnormal and a cooling-loop warning has escalated toward critical. Safety risk is elevated; immediate cooling-loop inspection and engineer escalation are required before continued dispatch.",
    confidence: 0.88,
    groupedAlertCount: 16,
    energyImpactMWhPerDay: 6.4,
    revenueImpactPerDay: 480,
    recommendedAction: "Escalate to site engineer and inspect cooling loop immediately",
    approvalRequired: true,
    approver: "Site Engineer",
    createdAt: "2026-06-16T14:42:00Z",
    evidenceIds: ["EV-2091-1", "EV-2091-2", "EV-2091-3"],
    telemetrySeriesIds: ["TS-2091-batt", "TS-2091-loop", "TS-2091-soc", "TS-2091-dis"],
    alertIds: ["ALT-2091-01", "ALT-2091-02", "ALT-2091-03"]
  }
];

const scenarioC_Alerts: Alert[] = [
  { id: "ALT-2091-01", timestamp: "2026-06-16T13:40:00Z", assetId: "BESS-011", severity: "high", source: "BESS", alertType: "bess_temperature_high", message: "Battery cell temperature 47.8°C exceeds 45°C safety limit", groupedIntoIncidentId: "INC-2091" },
  { id: "ALT-2091-02", timestamp: "2026-06-16T13:55:00Z", assetId: "BESS-011", severity: "high", source: "SCADA", alertType: "bess_cooling_loop_warning", message: "Cooling loop temperature 39.5°C warning", groupedIntoIncidentId: "INC-2091" },
  { id: "ALT-2091-03", timestamp: "2026-06-16T14:15:00Z", assetId: "BESS-011", severity: "critical", source: "BESS", alertType: "bess_temperature_high", message: "Battery cell temperature 52.1°C exceeds critical 50°C safety limit", groupedIntoIncidentId: "INC-2091" }
];

const scenarioC_Evidence: Evidence[] = [
  {
    id: "EV-2091-1",
    incidentId: "INC-2091",
    sourceType: "maintenance_history",
    title: "Prior cooling loop service inspection (4 months ago)",
    summary: "Work order WO-2026-00122: coolant fluid level was low; warning issued regarding cooling loop sensitivity under sustained grid dispatch cycles.",
    relevanceScore: 0.94,
    timestamp: "2026-02-20T10:00:00Z"
  },
  {
    id: "EV-2091-2",
    incidentId: "INC-2091",
    sourceType: "manufacturer_bulletin",
    title: "Thermal loop degradation warning",
    summary: "NorthCell NC-5000-LFP bulletin MN-BESS-001: cooling loop temp >38°C + cell temp >45°C indicates loop degradation. Risk of thermal runaways if not mitigated.",
    relevanceScore: 0.90
  },
  {
    id: "EV-2091-3",
    incidentId: "INC-2091",
    sourceType: "maintenance_history",
    title: "Prior thermal watch alarms in April",
    summary: "SCADA incident logs show brief watch-level battery temperature spikes during high discharge peaks.",
    relevanceScore: 0.78,
    timestamp: "2026-04-30T16:15:00Z"
  }
];

const scenarioC_Telemetry = [
  {
    id: "TS-2091-batt",
    incidentId: "INC-2091",
    metric: "battery_temperature_c",
    title: "Battery Temp",
    unit: "°C",
    threshold: 50,
    series: timestamps.map((ts, idx) => {
      // Cell temperature starts at 38 and rises to 52.1
      let value = 38 + Math.random() * 0.8;
      if (idx > 8) {
        value += Math.min(15, (idx - 8) * 0.7);
      }
      return { timestamp: ts, value: parseFloat(value.toFixed(1)) };
    })
  },
  {
    id: "TS-2091-loop",
    incidentId: "INC-2091",
    metric: "cooling_loop_temp_c",
    title: "Cooling Loop Temp",
    unit: "°C",
    threshold: 38,
    series: timestamps.map((ts, idx) => {
      // Cooling loop rises from 34 to 39.5
      let value = 34 + Math.random() * 0.4;
      if (idx > 8) {
        value += Math.min(6, (idx - 8) * 0.3);
      }
      return { timestamp: ts, value: parseFloat(value.toFixed(1)) };
    })
  },
  {
    id: "TS-2091-soc",
    incidentId: "INC-2091",
    metric: "state_of_charge_pct",
    title: "State of Charge",
    unit: "%",
    series: timestamps.map((ts, idx) => {
      // Discharging under grid dispatch, SoC drops steadily from 90%
      let value = Math.max(10, 90 - idx * 0.8 - Math.random() * 0.5);
      return { timestamp: ts, value: parseFloat(value.toFixed(1)) };
    })
  },
  {
    id: "TS-2091-dis",
    incidentId: "INC-2091",
    metric: "discharge_power_kw",
    title: "Discharge Power",
    unit: "kW",
    series: timestamps.map((ts) => ({
      timestamp: ts,
      value: 4200 + Math.round(Math.random() * 100 - 50)
    }))
  }
];

const scenarioC_AgentTraces: AgentTrace[] = [
  { id: "AT-2091-1", incidentId: "INC-2091", order: 1, agentName: "Alert Correlation Agent", role: "Group related alerts into one cluster", status: "complete", inputSummary: "16 raw alerts on BESS-011", outputSummary: "1 cluster, max severity critical", model: "gpt-4o-mini", latencyMs: 710, costUsd: 0.003 },
  { id: "AT-2091-2", incidentId: "INC-2091", order: 2, agentName: "Telemetry Analysis Agent", role: "Detect trends and time-ordering", status: "complete", inputSummary: "6h telemetry window", outputSummary: "Thermal rise in BESS cells and cooling loop under dispatch load", model: "gpt-4o-mini", latencyMs: 1400, costUsd: 0.005, confidence: 0.89 },
  { id: "AT-2091-3", incidentId: "INC-2091", order: 3, agentName: "Maintenance History Agent", role: "Find recurring/known failures", status: "complete", inputSummary: "BESS-011 records + bulletins", outputSummary: "Found prior cooling loop inspections and thermal watch warnings", model: "gpt-4o-mini", latencyMs: 980, costUsd: 0.004 },
  { id: "AT-2091-4", incidentId: "INC-2091", order: 4, agentName: "Weather/Forecast Agent", role: "Separate weather from equipment fault", status: "complete", inputSummary: "Weather conditions vs dispatch power", outputSummary: "High temperature not explained by ambient solar context", model: "gpt-4o-mini", latencyMs: 820, costUsd: 0.003 },
  { id: "AT-2091-5", incidentId: "INC-2091", order: 5, agentName: "Root Cause Agent", role: "Synthesize single root cause", status: "complete", inputSummary: "Outputs of agents 1-4", outputSummary: "Thermal Management System Degradation (conf 0.88)", model: "gpt-4o-mini", latencyMs: 1600, costUsd: 0.008, confidence: 0.88 },
  { id: "AT-2091-6", incidentId: "INC-2091", order: 6, agentName: "Business Impact Agent", role: "Quantify impact", status: "complete", inputSummary: "Discharge profile, $75/MWh", outputSummary: "6.4 MWh/day, $480/day", model: "gpt-4o-mini", latencyMs: 500, costUsd: 0.002 },
  { id: "AT-2091-7", incidentId: "INC-2091", order: 7, agentName: "Safety/Governance Agent", role: "Apply governance rules", status: "warning", inputSummary: "Incident draft", outputSummary: "Critical governance rules matched. Human approval required.", model: "gpt-4o-mini", latencyMs: 600, costUsd: 0.002 },
  { id: "AT-2091-8", incidentId: "INC-2091", order: 8, agentName: "Operator Briefing Agent", role: "Write operator summary", status: "complete", inputSummary: "Full incident", outputSummary: "Operator notification generated for safety hazard", model: "gpt-4o", latencyMs: 2300, costUsd: 0.012, confidence: 0.88 }
];

const scenarioC_TrueFoundryTraces: TrueFoundryTrace[] = [
  { id: "TF-2091-1", incidentId: "INC-2091", caller: "Alert Correlation Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 710, costUsd: 0.003, status: "success", timestamp: "2026-06-16T14:42:01Z" },
  { id: "TF-2091-2", incidentId: "INC-2091", caller: "Telemetry Analysis Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 1400, costUsd: 0.005, status: "success", timestamp: "2026-06-16T14:42:03Z" },
  { id: "TF-2091-5", incidentId: "INC-2091", caller: "Root Cause Agent", service: "ai-gateway", model: "gpt-4o-mini", routedModel: "gpt-4o-mini", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 1600, costUsd: 0.008, status: "success", timestamp: "2026-06-16T14:42:06Z" },
  { id: "TF-2091-8", incidentId: "INC-2091", caller: "Operator Briefing Agent", service: "ai-gateway", model: "gpt-4o", routedModel: "gpt-4o", provider: "OpenAI", endpoint: "/api/llm/chat/completions", latencyMs: 2300, costUsd: 0.012, status: "success", timestamp: "2026-06-16T14:42:10Z" },
  { id: "TF-2091-A", incidentId: "INC-2091", caller: "Anomaly Scoring", service: "renewable-anomaly-service", model: "rule-based", routedModel: "rule-based", provider: "TrueFoundry", endpoint: "/score", latencyMs: 190, costUsd: 0.0, status: "success", timestamp: "2026-06-16T14:41:59Z" }
];


// --- SCENARIO D: WEATHER FALSE POSITIVE ---
const scenarioD_Incidents: Incident[] = []; // No critical/high incidents generated

const scenarioD_Alerts: Alert[] = [
  { id: "ALT-weather-01", timestamp: "2026-06-16T13:10:00Z", assetId: "INV-001", severity: "low", source: "Weather", alertType: "output_below_forecast_weather", message: "Inverter output below nominal forecast due to cloud cover", groupedIntoIncidentId: undefined },
  { id: "ALT-weather-02", timestamp: "2026-06-16T13:20:00Z", assetId: "INV-002", severity: "low", source: "Weather", alertType: "output_below_forecast_weather", message: "Inverter output below nominal forecast due to cloud cover", groupedIntoIncidentId: undefined },
  { id: "ALT-weather-03", timestamp: "2026-06-16T13:30:00Z", assetId: "INV-003", severity: "low", source: "Weather", alertType: "output_below_forecast_weather", message: "Inverter output below nominal forecast due to cloud cover", groupedIntoIncidentId: undefined }
];

const scenarioD_Evidence: Evidence[] = [
  {
    id: "EV-weather-1",
    incidentId: "INC-weather",
    sourceType: "weather_context",
    title: "Rising cloud cover drops power output",
    summary: "Cloud cover rose from 5% to 70% while ambient irradiance dropped from 910 to 380 W/m². Site output decline matches the weather-adjusted forecast exactly.",
    relevanceScore: 0.98,
    timestamp: "2026-06-16T13:30:00Z"
  }
];

const scenarioD_Telemetry = [
  {
    id: "TS-weather-power",
    incidentId: "INC-weather",
    metric: "active_power_kw",
    title: "Active Power Output (INV-001)",
    unit: "kW",
    series: timestamps.map((ts, idx) => {
      // Power drops steadily due to cloud cover
      let value = 3600;
      if (idx > 10) {
        value = 3600 - Math.min(2400, (idx - 10) * 100);
      }
      return { timestamp: ts, value: parseFloat(value.toFixed(0)) };
    }),
    comparisonSeries: timestamps.map((ts, idx) => {
      // Forecast expected power adjusted for actual irradiance also drops
      let value = 3600;
      if (idx > 10) {
        value = 3600 - Math.min(2400, (idx - 10) * 100);
      }
      return { timestamp: ts, value };
    })
  }
];

const scenarioD_AgentTraces: AgentTrace[] = [
  { id: "AT-weather-1", incidentId: "INC-weather", order: 1, agentName: "Alert Correlation Agent", role: "Group related alerts into one cluster", status: "complete", inputSummary: "3 low alert warnings", outputSummary: "Filtered. Solar output loss correlates directly with weather observations.", model: "gpt-4o-mini", latencyMs: 500, costUsd: 0.002 },
  { id: "AT-weather-2", incidentId: "INC-weather", order: 2, agentName: "Weather/Forecast Agent", role: "Separate weather from equipment fault", status: "complete", inputSummary: "Cloud cover ramp 5% -> 70%", outputSummary: "Weather-adjusted expected power matches actual output perfectly. Flagged false positive.", model: "gpt-4o-mini", latencyMs: 1100, costUsd: 0.005, confidence: 0.92 }
];


// --- SHARED RULES & EVALUATION CASES ---
const sharedRules: GovernanceRule[] = [
  { id: "GR-1", name: "Critical safety risk", condition: "safety_risk == critical", triggered: false, action: "Require human approval", severity: "critical" },
  { id: "GR-2", name: "Asset offline action", condition: "action involves taking asset offline", triggered: false, action: "Require human approval", severity: "high" },
  { id: "GR-3", name: "Low confidence", condition: "confidence < 0.70", triggered: false, action: "Escalate to engineer", severity: "medium" },
  { id: "GR-4", name: "BESS thermal risk", condition: "bess_thermal_risk detected", triggered: false, action: "Critical escalation required", severity: "critical" }
];

const sharedEvaluation: EvaluationCase[] = [
  {
    scenario: "Normal Operation",
    expectedRootCause: "normal_operation",
    predictedRootCause: "normal_operation",
    expectedPriority: "low",
    predictedPriority: "low",
    expectedAction: "continue_monitoring",
    predictedAction: "continue_monitoring",
    result: "pass"
  },
  {
    scenario: "Inverter Cooling Degradation",
    expectedRootCause: "cooling_subsystem_degradation",
    predictedRootCause: "cooling_subsystem_degradation",
    expectedPriority: "high",
    predictedPriority: "high",
    expectedAction: "inspect_cooling_fan_within_24_hours",
    predictedAction: "inspect_cooling_fan_within_24_hours",
    result: "pass"
  },
  {
    scenario: "BESS Thermal Risk",
    expectedRootCause: "bess_thermal_management_degradation",
    predictedRootCause: "bess_thermal_management_degradation",
    expectedPriority: "critical",
    predictedPriority: "critical",
    expectedAction: "escalate_to_site_engineer_and_inspect_cooling_loop_immediately",
    predictedAction: "escalate_to_site_engineer_and_inspect_cooling_loop_immediately",
    result: "pass"
  }
];


// --- EXPORTED BUNDLES ---
export const scenarioBundles: Record<ScenarioId, ScenarioBundle> = {
  normal: {
    scenarioId: "normal",
    label: "Normal Operation",
    kpis: {
      activeIncidents: { value: "1", subtext: "1 low", trend: "0.2 MWh/day at risk", status: "neutral" },
      alertsCorrelated: { value: "1 → 1", subtext: "100% compression", status: "neutral" },
      energyRisk: { value: "0.2 MWh/day", subtext: "$15/day", status: "neutral" },
      meanTriage: { value: "1.9 min", subtext: "↓ 64% threshold", status: "success" },
      approvalsPending: { value: "0", subtext: "No action pending", status: "neutral" }
    },
    incidents: scenarioA_Incidents,
    alerts: scenarioA_Alerts,
    evidence: scenarioA_Evidence,
    telemetry: scenarioA_Telemetry,
    agentTraces: scenarioA_AgentTraces,
    trueFoundryTraces: scenarioA_TrueFoundryTraces,
    governanceRules: sharedRules.map(r => ({ ...r, triggered: false })),
    auditTrail: [
      { id: "AUD-0001", incidentId: "INC-0007", timestamp: "2026-06-16T14:40:00Z", actor: "GridOpsAI", action: "acknowledged", reason: "Automatic low severity acknowledgment" }
    ],
    evaluationCases: sharedEvaluation
  },
  inverter_cooling: {
    scenarioId: "inverter_cooling",
    label: "Inverter Cooling Degradation",
    kpis: {
      activeIncidents: { value: "1", subtext: "1 high", status: "warning" },
      alertsCorrelated: { value: "12 → 1", subtext: "Compression ratio 12:1", status: "neutral" },
      energyRisk: { value: "2.8 MWh/day", subtext: "$210/day at risk", status: "warning" },
      meanTriage: { value: "1.9 min", subtext: "↓ 64% threshold", status: "success" },
      approvalsPending: { value: "1", subtext: "1 pending verification", status: "critical" }
    },
    incidents: scenarioB_Incidents,
    alerts: scenarioB_Alerts,
    evidence: scenarioB_Evidence,
    telemetry: scenarioB_Telemetry,
    agentTraces: scenarioB_AgentTraces,
    trueFoundryTraces: scenarioB_TrueFoundryTraces,
    governanceRules: sharedRules.map(r => r.id === "GR-2" ? { ...r, triggered: true } : r),
    auditTrail: [
      { id: "AUD-1042-01", incidentId: "INC-1042", timestamp: "2026-06-16T14:40:02Z", actor: "GridOpsAI", action: "approval_requested", reason: "Recommended action requires taking inverter offline." }
    ],
    evaluationCases: sharedEvaluation
  },
  bess_thermal: {
    scenarioId: "bess_thermal",
    label: "BESS Thermal Risk",
    kpis: {
      activeIncidents: { value: "1", subtext: "1 critical", status: "critical" },
      alertsCorrelated: { value: "16 → 1", subtext: "Compression ratio 16:1", status: "neutral" },
      energyRisk: { value: "6.4 MWh/day", subtext: "$480/day at risk", status: "critical" },
      meanTriage: { value: "1.9 min", subtext: "↓ 64% threshold", status: "success" },
      approvalsPending: { value: "1", subtext: "Requires immediate action", status: "critical" }
    },
    incidents: scenarioC_Incidents,
    alerts: scenarioC_Alerts,
    evidence: scenarioC_Evidence,
    telemetry: scenarioC_Telemetry,
    agentTraces: scenarioC_AgentTraces,
    trueFoundryTraces: scenarioC_TrueFoundryTraces,
    governanceRules: sharedRules.map(r => (r.id === "GR-1" || r.id === "GR-4") ? { ...r, triggered: true } : r),
    auditTrail: [
      { id: "AUD-2091-01", incidentId: "INC-2091", timestamp: "2026-06-16T14:42:02Z", actor: "GridOpsAI", action: "approval_requested", reason: "Critical battery temperatures require loop isolation." }
    ],
    evaluationCases: sharedEvaluation
  },
  weather_fp: {
    scenarioId: "weather_fp",
    label: "Weather False Positive",
    kpis: {
      activeIncidents: { value: "0", subtext: "0 high/critical", status: "neutral" },
      alertsCorrelated: { value: "3 → 0", subtext: "Filtered by weather rules", status: "neutral" },
      energyRisk: { value: "0.0 MWh/day", subtext: "$0/day at risk", status: "neutral" },
      meanTriage: { value: "1.9 min", subtext: "↓ 64% threshold", status: "success" },
      approvalsPending: { value: "0", subtext: "No action pending", status: "neutral" }
    },
    incidents: [],
    alerts: scenarioD_Alerts,
    evidence: scenarioD_Evidence,
    telemetry: scenarioD_Telemetry,
    agentTraces: scenarioD_AgentTraces,
    trueFoundryTraces: [],
    governanceRules: sharedRules.map(r => ({ ...r, triggered: false })),
    auditTrail: [],
    evaluationCases: sharedEvaluation
  }
};
