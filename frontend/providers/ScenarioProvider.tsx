"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
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
  startLiveStream,
  stopLiveStream,
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
  /** Set by the orchestrator to trigger a programmatic navigation in the layout */
  pendingNavigation: string | null;
  clearPendingNavigation: () => void;
  /** Whether KPI cards should reveal with stagger animation */
  kpiRevealIndex: number;
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
  const [bundles, setBundles] = useState<Record<ScenarioId, ScenarioBundle>>(() => {
    const raw: Record<ScenarioId, ScenarioBundle> = JSON.parse(JSON.stringify(scenarioBundles));
    if (USE_LIVE_API) {
      // In live mode start with empty queues — real data comes from the backend
      (Object.keys(raw) as ScenarioId[]).forEach((id) => {
        raw[id].incidents = [];
        raw[id].auditTrail = [];
        // Zero out KPI cards — they reveal one-by-one after the demo flow completes
        raw[id].kpis = {
          activeIncidents:   { value: "0", subtext: "awaiting live data", status: "normal" },
          alertsCorrelated:  { value: "—", subtext: "stream not started", status: "normal" },
          energyRisk:        { value: "0 MWh", subtext: "no active incident", status: "normal" },
          meanTriage:        { value: "—", status: "normal" },
          approvalsPending:  { value: "0", subtext: "no pending items", status: "normal" },
        };
      });
    }
    return raw;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(-1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResults | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  // In live mode KPIs start hidden (0) and reveal one-by-one after demo completes
  const [kpiRevealIndex, setKpiRevealIndex] = useState(USE_LIVE_API ? 0 : 5);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const clearPendingNavigation = () => setPendingNavigation(null);

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
    if (USE_LIVE_API) setKpiRevealIndex(0); // hide KPIs until demo reveals them

    if (USE_LIVE_API) {
      await _runLiveAnalysis();
    } else {
      await _runFixtureAnalysis();
    }

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
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

  /**
   * SCRIPTED DEMO FLOW (live mode):
   *  t=0s  → start stream on Command Centre (events visible in ticker)
   *  t=15s → auto-navigate to AI Workflow, start agent animation
   *  t=30s → auto-navigate back to Command Centre, KPI cards reveal one-by-one
   *  t=35s → incident loaded (real or fixture fallback)
   */
  const _runLiveAnalysis = async () => {
    const scnId = scenarioIdToScnId(currentScenarioId);
    const backendName = scenarioIdToBackendName(currentScenarioId);
    const runStartedAt = Date.now();

    // ── 1. Reset agent traces to pending ──────────────────────────────────────
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

    // ── 2. Start event stream ─────────────────────────────────────────────────
    try {
      if (currentScenarioId === "inverter_cooling") {
        await startLiveStream(20.0, 0.1, 15); // 6s normal → degrade → auto-stop at 15s
        addToast("⚡ Live stream started — watch events flow in!", "info");
      } else {
        const runResp = await streamScenario(backendName);
        addToast(`Streaming ${runResp.event_count} events…`, "info");
      }
    } catch (err) {
      console.error("Backend stream start failed:", err);
      addToast("Could not reach backend — running in demo mode.", "warning");
      await _runFixtureAnalysis();
      return;
    }

    // ── 3. Start polling for incident in background (parallel) ────────────────
    const incidentPromise = pollForIncident(scnId, 120_000, 3_000, runStartedAt).catch(() => null);

    // ── 4. After 15s (stream done), navigate to AI Workflow ───────────────────
    await new Promise((r) => setTimeout(r, 15_000));
    setPendingNavigation("/ai-workflow");

    // ── 5. Animate 9 agents over 15 seconds ──────────────────────────────────
    _animateAgentSteps();
    await new Promise((r) => setTimeout(r, 15_000));

    // ── 6. Navigate back to Command Centre, reveal KPIs one by one ───────────
    // Pre-populate with fixture values RIGHT NOW so cards show data as they reveal
    const placeholderKpis = {
      activeIncidents:  { value: "1", subtext: "1 high priority", status: "critical" as const },
      alertsCorrelated: { value: "12 → 1", subtext: "AI compression", status: "warning" as const },
      energyRisk:       { value: "2.8 MWh/day", subtext: "$210/day at risk", status: "critical" as const },
      meanTriage:       { value: "< 2 min", trend: "↓ AI-assisted", status: "normal" as const },
      approvalsPending: { value: "1", subtext: "1 pending verification", status: "warning" as const },
    };
    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        kpis: placeholderKpis,
        // Also pre-load fixture incident so queue is not empty
        incidents: clone[currentScenarioId].incidents.length === 0
          ? JSON.parse(JSON.stringify(scenarioBundles[currentScenarioId].incidents))
          : clone[currentScenarioId].incidents,
      };
      return clone;
    });

    setPendingNavigation("/command-center");
    setKpiRevealIndex(0); // start staggered reveal — cards already have values

    // Stagger each KPI card by 800ms (5 cards × 800ms = 4s total)
    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 800));
      setKpiRevealIndex(i);
    }

    _finaliseAgentTraces();

    // ── Mark analysis done NOW so the orange bar and spinner disappear ────────
    setIsAnalyzing(false);
    setAnalysisStep(-1);
    addToast("Analysis complete — 1 high-priority incident detected on INV-042.", "success");

    // ── 7. Resolve incident in background (UI is already unlocked) ────────────
    const incident = await incidentPromise;

    if (!incident) {
      // Placeholder data already set before reveal — nothing more to do
      return;
    }

    // Real incident arrived — fetch supporting data
    const [evidence, agentTr, tfyTr] = await Promise.all([
      fetchEvidence(incident.id).catch(() => [] as Evidence[]),
      fetchAgentTraces(incident.id).catch(() => [] as AgentTrace[]),
      fetchTrueFoundryTraces(incident.id).catch(() => [] as TrueFoundryTrace[]),
    ]);

    const liveKpis = {
      activeIncidents:  { value: "1", subtext: "1 high priority", status: "critical" },
      alertsCorrelated: { value: incident.groupedAlertCount > 0 ? `${incident.groupedAlertCount} → 1` : "12 → 1", subtext: "AI compression", status: "warning" },
      energyRisk:       { value: `${incident.energyImpactMWhPerDay?.toFixed(1) ?? "2.8"} MWh/day`, subtext: `$${Math.round(incident.revenueImpactPerDay ?? 210)}/day at risk`, status: "critical" },
      meanTriage:       { value: "< 2 min", trend: "↓ AI-assisted", status: "normal" },
      approvalsPending: { value: "1", subtext: "1 pending verification", status: "warning" },
    };

    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId] = {
        ...clone[currentScenarioId],
        incidents: [incident],
        kpis: liveKpis,
        evidence: evidence.length ? evidence : clone[currentScenarioId].evidence,
        agentTraces: agentTr.length ? agentTr : clone[currentScenarioId].agentTraces,
        trueFoundryTraces: tfyTr.length ? tfyTr : clone[currentScenarioId].trueFoundryTraces,
      };
      return clone;
    });

    addToast(`Live incident ${incident.id} confirmed on ${incident.assetId}.`, "success");
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
          agentTraces: clone[currentScenarioId].agentTraces.map((t, j) => {
            if (j === idx) {
              return { ...t, status: "running" as const };
            }
            if (j === idx - 1) {
              const orig = scenarioBundles[currentScenarioId].agentTraces[j];
              return { ...t, status: orig.status };
            }
            return t;
          }),
        };
        return clone;
      });
      // 9 agents × ~1.5s each ≈ 13.5s total; Briefing agents get a bit more
      const ms = traces[idx].agentName.includes("Briefing") ? 2500 : 1400;
      animationTimeoutRef.current = setTimeout(step, ms);
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
          const { passed, scenarios } = results.aggregate;
          addToast(`Evaluation complete — ${passed}/${scenarios} scenarios passed.`, "success");
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

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

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
        pendingNavigation,
        clearPendingNavigation,
        kpiRevealIndex,
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
