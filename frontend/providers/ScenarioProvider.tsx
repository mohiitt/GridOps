"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  ScenarioBundle,
  ScenarioId,
  Incident,
  AuditEvent,
  AgentTrace,
  IncidentStatus,
  Evidence,
  TrueFoundryTrace,
} from "../types";
import { scenarioBundles } from "../data/scenarios";
import {
  USE_LIVE_API,
  streamScenario,
  pollForIncident,
  postIncidentDecision,
  fetchAuditTrail,
  fetchEvidence,
  fetchAgentTraces,
  fetchTrueFoundryTraces,
  fetchEvalResults,
  scenarioIdToBackendName,
  scenarioIdToScnId,
  type EvalResults,
} from "../lib/api";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "warning" | "error" | "info";
}

interface ScenarioContextProps {
  currentScenarioId: ScenarioId;
  activeBundle: ScenarioBundle;
  incidents: Incident[];
  auditTrail: AuditEvent[];
  isAnalyzing: boolean;
  analysisStep: number;
  agentTraces: AgentTrace[];
  toasts: Toast[];
  evalResults: EvalResults | null;
  isLiveMode: boolean;
  switchScenario: (id: ScenarioId) => void;
  runAIAnalysis: () => Promise<void>;
  approveIncident: (id: string, reason?: string) => void;
  createWorkOrder: (id: string, assignedTo?: string) => void;
  markFalsePositive: (id: string, reason: string) => void;
  addToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  removeToast: (id: string) => void;
  rerunEvaluation: () => Promise<void>;
  isEvaluating: boolean;
}

const ScenarioContext = createContext<ScenarioContextProps | undefined>(undefined);

export const ScenarioProvider = ({ children }: { children: ReactNode }) => {
  const [currentScenarioId, setCurrentScenarioId] = useState<ScenarioId>("inverter_cooling");
  const [bundles, setBundles] = useState<Record<ScenarioId, ScenarioBundle>>(() =>
    JSON.parse(JSON.stringify(scenarioBundles)),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(-1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResults | null>(null);

  const activeBundle = bundles[currentScenarioId];
  const incidents = activeBundle.incidents;
  const auditTrail = activeBundle.auditTrail;
  const agentTraces = activeBundle.agentTraces;

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const addToast = (
    message: string,
    type: "success" | "warning" | "error" | "info" = "success",
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Switch scenario ────────────────────────────────────────────────────────

  const switchScenario = (id: ScenarioId) => {
    if (isAnalyzing) {
      addToast("Please wait for analysis to complete before switching scenarios.", "warning");
      return;
    }
    setCurrentScenarioId(id);
    setAnalysisStep(-1);
    addToast(`Switched scenario to: ${bundles[id].label}`, "info");
  };

  // ── Run AI Analysis ────────────────────────────────────────────────────────

  const runAIAnalysis = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisStep(0);

    if (USE_LIVE_API) {
      await _runLiveAnalysis();
    } else {
      await _runFixtureAnalysis();
    }

    setIsAnalyzing(false);
    setAnalysisStep(-1);
  };

  /** Fixture mode: pure animation, no backend calls (original behaviour). */
  const _runFixtureAnalysis = async () => {
    addToast("Starting CrewAI Multi-Agent Analysis...", "info");

    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        agentTraces: clone[currentScenarioId].agentTraces.map((t) => ({
          ...t,
          status: "pending" as const,
        })),
      };
      return clone;
    });

    const traces = activeBundle.agentTraces;
    for (let i = 0; i < traces.length; i++) {
      setAnalysisStep(i);
      setBundles((prev) => {
        const clone = { ...prev };
        clone[currentScenarioId] = {
          ...clone[currentScenarioId],
          agentTraces: clone[currentScenarioId].agentTraces.map((t, idx) =>
            idx === i ? { ...t, status: "running" as const } : t,
          ),
        };
        return clone;
      });

      const stepDuration = traces[i].agentName.includes("Briefing") ? 1400 : 800;
      await new Promise((resolve) => setTimeout(resolve, stepDuration));

      setBundles((prev) => {
        const clone = { ...prev };
        clone[currentScenarioId] = {
          ...clone[currentScenarioId],
          agentTraces: clone[currentScenarioId].agentTraces.map((t, idx) => {
            if (idx === i) {
              const orig = scenarioBundles[currentScenarioId].agentTraces[idx];
              return { ...t, status: orig.status };
            }
            return t;
          }),
        };
        return clone;
      });
    }

    // Restore fixture incidents
    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        incidents: JSON.parse(JSON.stringify(scenarioBundles[currentScenarioId].incidents)),
      };
      return clone;
    });

    if (currentScenarioId === "weather_fp") {
      addToast("Analysis complete. Flagged false positive — weather fully explains deviation.", "success");
    } else if (currentScenarioId === "normal") {
      addToast("Analysis complete. System is operating normally.", "success");
    } else {
      const n = scenarioBundles[currentScenarioId].incidents.length;
      addToast(`Analysis complete — ${n} high-priority incident generated.`, "success");
    }
  };

  /** Live mode: stream events → crew → poll for real incident. */
  const _runLiveAnalysis = async () => {
    addToast("Streaming events to backend…", "info");

    // Reset traces to running animation while crew works
    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        agentTraces: clone[currentScenarioId].agentTraces.map((t, i) => ({
          ...t,
          status: i === 0 ? ("running" as const) : ("pending" as const),
        })),
      };
      return clone;
    });

    // 1. Trigger backend scenario run
    const backendName = scenarioIdToBackendName(currentScenarioId);
    const scnId = scenarioIdToScnId(currentScenarioId);

    let eventCount = 0;
    try {
      const runResp = await streamScenario(backendName);
      eventCount = runResp.event_count;
      addToast(`Streaming ${eventCount} events… CrewAI agents running.`, "info");
    } catch (err) {
      console.error("streamScenario failed:", err);
      addToast("Could not reach backend. Check services are running.", "error");
      // Fall back to fixture animation
      await _runFixtureAnalysis();
      return;
    }

    // 2. Animate agent steps while polling
    _animateAgentSteps();

    // 3. For non-incident scenarios (normal, weather_fp) don't poll
    const isIncidentScenario = currentScenarioId !== "normal" && currentScenarioId !== "weather_fp";

    if (!isIncidentScenario) {
      // Wait for streaming to finish (~eventCount * 5ms)
      await new Promise((r) => setTimeout(r, Math.min(eventCount * 5 + 3000, 15_000)));
      _finaliseAgentTraces();
      addToast(
        currentScenarioId === "weather_fp"
          ? "Analysis complete. No incident — weather explains output deviation."
          : "Analysis complete. System is operating normally.",
        "success",
      );
      return;
    }

    // 4. Poll for incident report (up to 3 min)
    addToast("Polling for incident report (up to 3 min)…", "info");
    let incident: Incident | null = null;
    try {
      incident = await pollForIncident(scnId, 180_000);
    } catch (err) {
      console.error("pollForIncident failed:", err);
    }

    _finaliseAgentTraces();

    if (!incident) {
      addToast(
        "Crew still running — check backend logs. Showing fixture data.",
        "warning",
      );
      // Fall back to fixture incident so the UI is not empty
      setBundles((prev) => {
        const clone = { ...prev };
        clone[currentScenarioId] = {
          ...clone[currentScenarioId],
          incidents: JSON.parse(JSON.stringify(scenarioBundles[currentScenarioId].incidents)),
        };
        return clone;
      });
      return;
    }

    // 5. Fetch evidence + traces from backend and merge into bundle
    const [evidence, agentTr, tfyTr] = await Promise.all([
      fetchEvidence(incident.id).catch(() => [] as Evidence[]),
      fetchAgentTraces(incident.id).catch(() => [] as AgentTrace[]),
      fetchTrueFoundryTraces(incident.id).catch(() => [] as TrueFoundryTrace[]),
    ]);

    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        incidents: [incident!],
        evidence: evidence.length
          ? evidence
          : clone[currentScenarioId].evidence,
        agentTraces: agentTr.length
          ? agentTr
          : clone[currentScenarioId].agentTraces,
        trueFoundryTraces: tfyTr.length
          ? tfyTr
          : clone[currentScenarioId].trueFoundryTraces,
      };
      return clone;
    });

    addToast(
      `Analysis complete — incident ${incident.id} generated for ${incident.assetId}.`,
      "success",
    );
  };

  /** Animate 9 agent steps sequentially (background, non-blocking for polling). */
  const _animateAgentSteps = () => {
    const traces = scenarioBundles[currentScenarioId].agentTraces;
    let i = 0;
    const step = () => {
      if (i >= traces.length) return;
      const idx = i++;
      setAnalysisStep(idx);
      setBundles((prev) => {
        const clone = { ...prev };
        clone[currentScenarioId] = {
          ...clone[currentScenarioId],
          agentTraces: clone[currentScenarioId].agentTraces.map((t, j) =>
            j === idx ? { ...t, status: "running" as const } : t,
          ),
        };
        return clone;
      });
      const ms = traces[idx].agentName.includes("Briefing") ? 9000 : 6000;
      setTimeout(step, ms);
    };
    step();
  };

  /** Mark all agent traces complete using fixture statuses. */
  const _finaliseAgentTraces = () => {
    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        agentTraces: scenarioBundles[currentScenarioId].agentTraces.map((t) => ({
          ...t,
          status: t.status === "pending" ? ("complete" as const) : t.status,
        })),
      };
      return clone;
    });
  };

  // ── Approve incident ───────────────────────────────────────────────────────

  const approveIncident = async (
    id: string,
    reason = "Recommended action requires taking inverter offline",
  ) => {
    if (USE_LIVE_API) {
      try {
        const result = await postIncidentDecision(id, "approved", "Operator");
        // Refresh audit trail from backend
        const trail = await fetchAuditTrail(id).catch(() => [] as AuditEvent[]);
        setBundles((prev) => {
          const clone = { ...prev };
          const updatedStatus: IncidentStatus =
            result.work_order ? "work_order_created" : "approved";
          clone[currentScenarioId] = {
            ...clone[currentScenarioId],
            incidents: clone[currentScenarioId].incidents.map((inc) =>
              inc.id === id ? { ...inc, status: updatedStatus } : inc,
            ),
            auditTrail: trail.length ? trail : clone[currentScenarioId].auditTrail,
          };
          return clone;
        });
        if (result.work_order) {
          const wo = result.work_order as Record<string, unknown>;
          addToast(`Work order ${wo.work_order_id} created.`, "success");
        } else {
          addToast(`Incident ${id} approved.`, "success");
        }
        return;
      } catch (err) {
        console.error("approveIncident live failed:", err);
        addToast("Backend approval failed — applying locally.", "warning");
      }
    }

    // Fixture fallback
    setBundles((prev) => {
      const clone = { ...prev };
      const newAudit: AuditEvent = {
        id: `AUD-${Date.now()}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        actor: "Operator (Human-in-the-Loop)",
        action: "approved",
        reason,
      };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        incidents: clone[currentScenarioId].incidents.map((inc) =>
          inc.id === id ? { ...inc, status: "approved" as IncidentStatus } : inc,
        ),
        auditTrail: [newAudit, ...clone[currentScenarioId].auditTrail],
      };
      return clone;
    });
    addToast(`Inspection approved for ${id}.`, "success");
  };

  // ── Create work order ──────────────────────────────────────────────────────

  const createWorkOrder = (id: string, assignedTo = "Maria Gonzalez") => {
    // Work order creation is triggered by approve in live mode.
    // In fixture mode, apply locally.
    setBundles((prev) => {
      const clone = { ...prev };
      const newAudit: AuditEvent = {
        id: `AUD-${Date.now()}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        actor: "Operator Console",
        action: "workorder_created",
        reason: `Work order WO-2026-04412 created and assigned to ${assignedTo}.`,
      };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        incidents: clone[currentScenarioId].incidents.map((inc) =>
          inc.id === id ? { ...inc, status: "work_order_created" as IncidentStatus } : inc,
        ),
        auditTrail: [newAudit, ...clone[currentScenarioId].auditTrail],
      };
      return clone;
    });
    addToast(`Work order WO-2026-04412 created and assigned to ${assignedTo}.`, "success");
  };

  // ── Mark false positive ────────────────────────────────────────────────────

  const markFalsePositive = async (id: string, reason: string) => {
    if (USE_LIVE_API) {
      try {
        await postIncidentDecision(id, "rejected", "Operator");
        const trail = await fetchAuditTrail(id).catch(() => [] as AuditEvent[]);
        setBundles((prev) => {
          const clone = { ...prev };
          clone[currentScenarioId] = {
            ...clone[currentScenarioId],
            incidents: clone[currentScenarioId].incidents.map((inc) =>
              inc.id === id ? { ...inc, status: "closed" as IncidentStatus } : inc,
            ),
            auditTrail: trail.length ? trail : clone[currentScenarioId].auditTrail,
          };
          return clone;
        });
        addToast(`Incident ${id} marked as false positive.`, "info");
        return;
      } catch (err) {
        console.error("markFalsePositive live failed:", err);
      }
    }

    setBundles((prev) => {
      const clone = { ...prev };
      const newAudit: AuditEvent = {
        id: `AUD-${Date.now()}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        actor: "Operator (Human-in-the-Loop)",
        action: "acknowledged",
        reason: `Marked as False Positive. Reason: ${reason}`,
      };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        incidents: clone[currentScenarioId].incidents.map((inc) =>
          inc.id === id ? { ...inc, status: "closed" as IncidentStatus } : inc,
        ),
        auditTrail: [newAudit, ...clone[currentScenarioId].auditTrail],
      };
      return clone;
    });
    addToast(`Incident ${id} marked as false positive.`, "info");
  };

  // ── Re-run evaluation ──────────────────────────────────────────────────────

  const rerunEvaluation = async () => {
    setIsEvaluating(true);
    addToast("Fetching evaluation results from backend…", "info");

    if (USE_LIVE_API) {
      try {
        const results = await fetchEvalResults();
        if (results) {
          setEvalResults(results);
          const { passed, total } = results.aggregate;
          addToast(`Evaluation complete — ${passed}/${total} scenarios passed.`, "success");
          setIsEvaluating(false);
          return;
        }
      } catch (err) {
        console.error("fetchEvalResults failed:", err);
      }
      addToast(
        "No eval results found. Run: make run-all-scenarios && make eval",
        "warning",
      );
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      addToast("Evaluation complete — 3/3 cases passed (100% accuracy).", "success");
    }

    setIsEvaluating(false);
  };

  // ── Return ─────────────────────────────────────────────────────────────────

  return (
    <ScenarioContext.Provider
      value={{
        currentScenarioId,
        activeBundle,
        incidents,
        auditTrail,
        isAnalyzing,
        analysisStep,
        agentTraces,
        toasts,
        evalResults,
        isLiveMode: USE_LIVE_API,
        switchScenario,
        runAIAnalysis,
        approveIncident,
        createWorkOrder,
        markFalsePositive,
        addToast,
        removeToast,
        rerunEvaluation,
        isEvaluating,
      }}
    >
      {children}
    </ScenarioContext.Provider>
  );
};

export const useScenario = () => {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error("useScenario must be used within a ScenarioProvider");
  }
  return context;
};
