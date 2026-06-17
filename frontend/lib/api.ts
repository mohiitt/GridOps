/**
 * GridOps API client — live mode wrapper.
 *
 * All functions check NEXT_PUBLIC_USE_LIVE_API:
 *   true  → real backend calls, adapted through adapters.ts
 *   false → return empty / null (fixture data is injected by ScenarioProvider)
 *
 * Failures in live mode are logged and re-throw so the caller can toast + fall back.
 */

import type {
  Incident,
  AuditEvent,
  Evidence,
  AgentTrace,
  TrueFoundryTrace,
  ScenarioId,
} from "../types";

import type {
  BackendIncidentReport,
  BackendIncidentSummary,
  BackendAuditResponse,
  BackendScenarioRunResponse,
} from "../types/backend";

import {
  mapBackendIncident,
  mapBackendEvidence,
  mapBackendAudit,
  buildAgentTracesFromReport,
  buildTrueFoundryTracesFromReport,
  scenarioIdToBackendName,
  scenarioIdToScnId,
} from "./adapters";

// ── Configuration ──────────────────────────────────────────────────────────────

export const USE_LIVE_API = process.env.NEXT_PUBLIC_USE_LIVE_API === "true";

function incidentBase(): string {
  return (process.env.NEXT_PUBLIC_INCIDENT_API_URL ?? "http://localhost:8000") + "/api";
}
function ingestionBase(): string {
  return process.env.NEXT_PUBLIC_INGESTION_API_URL ?? "http://localhost:8002";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST ${url} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Incidents ──────────────────────────────────────────────────────────────────

/** Fetch all incident summaries. In fixture mode returns []. */
export async function fetchIncidents(): Promise<Incident[]> {
  if (!USE_LIVE_API) return [];
  const summaries = await get<BackendIncidentSummary[]>(`${incidentBase()}/incidents`);
  // Fetch full reports for proper mapping (summaries lack evidence/briefing)
  const full = await Promise.all(
    summaries.map((s) =>
      get<BackendIncidentReport>(`${incidentBase()}/incidents/${s.incident_id}`).catch(
        () => null,
      ),
    ),
  );
  return full.filter(Boolean).map((r) => mapBackendIncident(r!));
}

/** Fetch a single full incident report. */
export async function fetchIncidentDetail(id: string): Promise<Incident | null> {
  if (!USE_LIVE_API) return null;
  const report = await get<BackendIncidentReport>(`${incidentBase()}/incidents/${id}`);
  return mapBackendIncident(report);
}

/** Fetch evidence items for an incident. */
export async function fetchEvidence(incidentId: string): Promise<Evidence[]> {
  if (!USE_LIVE_API) return [];
  const report = await get<BackendIncidentReport>(`${incidentBase()}/incidents/${incidentId}`);
  return (report.evidence ?? []).map((e) => mapBackendEvidence(e, incidentId));
}

/** Fetch agent traces synthesised from the report trace metadata. */
export async function fetchAgentTraces(incidentId: string): Promise<AgentTrace[]> {
  if (!USE_LIVE_API) return [];
  const report = await get<BackendIncidentReport>(`${incidentBase()}/incidents/${incidentId}`);
  return buildAgentTracesFromReport(report, incidentId);
}

/** Fetch TrueFoundry gateway traces synthesised from the report. */
export async function fetchTrueFoundryTraces(incidentId: string): Promise<TrueFoundryTrace[]> {
  if (!USE_LIVE_API) return [];
  const report = await get<BackendIncidentReport>(`${incidentBase()}/incidents/${incidentId}`);
  return buildTrueFoundryTracesFromReport(report, incidentId);
}

// ── Decisions ──────────────────────────────────────────────────────────────────

/** Post an operator decision (approved | rejected). Returns backend response. */
export async function postIncidentDecision(
  id: string,
  decision: "approved" | "rejected",
  actor = "Operator",
): Promise<{ status: string; work_order?: Record<string, unknown> }> {
  if (!USE_LIVE_API) {
    await delay(500);
    return { status: "simulated" };
  }
  return post(`${incidentBase()}/incidents/${id}/decision`, { decision, actor });
}

/** Fetch full audit trail for an incident, unwrapping the backend wrapper. */
export async function fetchAuditTrail(id: string): Promise<AuditEvent[]> {
  if (!USE_LIVE_API) return [];
  const response = await get<BackendAuditResponse>(`${incidentBase()}/audit/${id}`);
  return mapBackendAudit(response);
}

// ── Scenario runner ────────────────────────────────────────────────────────────

/**
 * Trigger a live scenario run on the incident API.
 * The backend streams events to ingestion → crew → report (background).
 * Returns immediately with event_count.
 */
export async function streamScenario(
  scenarioName: string,
): Promise<BackendScenarioRunResponse> {
  if (!USE_LIVE_API) {
    await delay(300);
    return { status: "simulated", scenario: scenarioName, scenario_id: "SCN-B", event_count: 0, message: "" };
  }
  return post<BackendScenarioRunResponse>(`${incidentBase()}/scenarios/${scenarioName}/run`, {});
}

/**
 * Poll GET /api/incidents until a report with the given scenario_id appears,
 * or until timeoutMs is exceeded.
 * Pass `startedAfterMs` (epoch ms) to ignore stale incidents from previous runs.
 * Returns the mapped Incident, or null on timeout.
 */
export async function pollForIncident(
  scenarioId: string,
  timeoutMs = 180_000,
  intervalMs = 3_000,
  startedAfterMs?: number,
): Promise<Incident | null> {
  if (!USE_LIVE_API) return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const summaries = await get<BackendIncidentSummary[]>(`${incidentBase()}/incidents`);
      const match = summaries.find((s) => {
        if (s.scenario_id !== scenarioId) return false;
        // Ignore incidents created before this run started (stale from previous runs)
        if (startedAfterMs && s.created_at) {
          const incidentMs = new Date(s.created_at).getTime();
          // Allow 60s buffer in case backend clock is slightly behind
          return incidentMs >= startedAfterMs - 60_000;
        }
        return true;
      });
      if (match) {
        const full = await get<BackendIncidentReport>(
          `${incidentBase()}/incidents/${match.incident_id}`,
        );
        return mapBackendIncident(full);
      }
    } catch {
      // network error during poll — keep trying
    }
    if (Date.now() + intervalMs < deadline) {
      await delay(intervalMs);
    } else {
      break;
    }
  }
  return null;
}

// ── Live stream control ────────────────────────────────────────────────────────

export interface LiveStreamResponse {
  status: string;
  pid?: number;
  speed?: number;
  phase1_real_mins?: number;
  estimated_incident_minutes?: number;
}

/**
 * Start the physics-based live event generator on the ingestion service.
 * Events will appear in the SSE /events/stream ticker in real time.
 * The story arc: normal operation for phase1_real_mins, then INV-042 starts degrading.
 */
export async function startLiveStream(
  speed = 20.0,
  phase1RealMins = 2.0,
): Promise<LiveStreamResponse> {
  if (!USE_LIVE_API) {
    await delay(300);
    return { status: "simulated", estimated_incident_minutes: phase1RealMins + 2.5 };
  }
  return post<LiveStreamResponse>(
    `${ingestionBase()}/live-stream/start?speed=${speed}&phase1_real_mins=${phase1RealMins}`,
    {},
  );
}

/** Stop the live stream generator. */
export async function stopLiveStream(): Promise<void> {
  if (!USE_LIVE_API) return;
  try {
    await post(`${ingestionBase()}/live-stream/stop`, {});
  } catch {
    // ignore — best-effort stop
  }
}

// ── Eval ───────────────────────────────────────────────────────────────────────

export interface EvalResults {
  per_scenario: Record<string, unknown>[];
  aggregate: {
    scenarios: number;
    passed: number;
    failed: number;
    root_cause_accuracy: number;
    false_escalation_rate: number;
  };
}

/** Fetch latest eval results. Returns null if not yet generated. */
export async function fetchEvalResults(): Promise<EvalResults | null> {
  if (!USE_LIVE_API) return null;
  try {
    return await get<EvalResults>(`${incidentBase()}/eval/results`);
  } catch {
    return null;
  }
}

// ── Convenience re-exports ─────────────────────────────────────────────────────

export { scenarioIdToBackendName, scenarioIdToScnId } from "./adapters";
