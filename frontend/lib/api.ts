import { Incident, AuditEvent, ScenarioId } from "../types";

const USE_LIVE_API = process.env.NEXT_PUBLIC_USE_LIVE_API === "true";

const API_PORTS = {
  incident: "8000",
  anomaly: "8001",
  ingestion: "8002",
  crew: "8003"
};

const BASE_URLS = {
  incident: `http://localhost:${API_PORTS.incident}/api`,
  crew: `http://localhost:${API_PORTS.crew}`
};

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchIncidents(): Promise<Incident[]> {
  if (USE_LIVE_API) {
    try {
      const res = await fetch(`${BASE_URLS.incident}/incidents`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.error("Failed to fetch live incidents, falling back to fixtures", err);
    }
  }
  await delay(300);
  return []; // Provider will handle fixture matching
}

export async function fetchIncidentDetail(id: string): Promise<Incident | null> {
  if (USE_LIVE_API) {
    try {
      const res = await fetch(`${BASE_URLS.incident}/incidents/${id}`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.error(`Failed to fetch live incident detail for ${id}`, err);
    }
  }
  await delay(200);
  return null;
}

export async function postIncidentDecision(id: string, decision: "approved" | "rejected", actor: string): Promise<any> {
  if (USE_LIVE_API) {
    try {
      const res = await fetch(`${BASE_URLS.incident}/incidents/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, actor })
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.error(`Failed to post decision for incident ${id}`, err);
    }
  }
  await delay(500);
  return { status: "success", simulated: true };
}

export async function fetchAuditTrail(id: string): Promise<AuditEvent[]> {
  if (USE_LIVE_API) {
    try {
      const res = await fetch(`${BASE_URLS.incident}/audit/${id}`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.error(`Failed to fetch audit trail for ${id}`, err);
    }
  }
  await delay(150);
  return [];
}

export async function runLiveAIAnalysis(candidateId: string, payload: any): Promise<any> {
  if (USE_LIVE_API) {
    try {
      const res = await fetch(`${BASE_URLS.crew}/run_incident`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId, ...payload })
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.error("Failed to trigger live CrewAI analysis", err);
      throw err;
    }
  }
  await delay(3000);
  return { status: "simulated" };
}
