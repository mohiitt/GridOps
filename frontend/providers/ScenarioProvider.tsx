"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ScenarioBundle, ScenarioId, Incident, AuditEvent, AgentTrace, IncidentStatus } from "../types";
import { scenarioBundles } from "../data/scenarios";

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
  analysisStep: number; // Index of current running agent (0-indexed, or -1 if idle)
  agentTraces: AgentTrace[];
  toasts: Toast[];
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
    // Deep clone scenarioBundles so we can mutate state locally per scenario
    return JSON.parse(JSON.stringify(scenarioBundles));
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(-1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const activeBundle = bundles[currentScenarioId];
  const incidents = activeBundle.incidents;
  const auditTrail = activeBundle.auditTrail;
  const agentTraces = activeBundle.agentTraces;

  const addToast = (message: string, type: "success" | "warning" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const switchScenario = (id: ScenarioId) => {
    if (isAnalyzing) {
      addToast("Please wait for analysis to complete before switching scenarios.", "warning");
      return;
    }
    setCurrentScenarioId(id);
    setAnalysisStep(-1);
    addToast(`Switched scenario to: ${bundles[id].label}`, "info");
  };

  const runAIAnalysis = async () => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setAnalysisStep(0);
    addToast("Starting CrewAI Multi-Agent Analysis...", "info");

    // Pre-reset agent traces to pending state for visual feedback
    setBundles((prev) => {
      const clone = { ...prev };
      clone[currentScenarioId].agentTraces = clone[currentScenarioId].agentTraces.map((t) => ({
        ...t,
        status: "pending"
      }));
      return clone;
    });

    const traces = activeBundle.agentTraces;
    const totalSteps = traces.length;

    for (let i = 0; i < totalSteps; i++) {
      setAnalysisStep(i);
      // Update the current trace to 'running'
      setBundles((prev) => {
        const clone = { ...prev };
        clone[currentScenarioId].agentTraces = clone[currentScenarioId].agentTraces.map((t, idx) => {
          if (idx === i) return { ...t, status: "running" };
          return t;
        });
        return clone;
      });

      // Simulated network/model latency
      const stepDuration = traces[i].agentName.includes("Briefing") ? 1400 : 800;
      await new Promise((resolve) => setTimeout(resolve, stepDuration));

      // Update trace to 'complete' (or warning for Safety/Governance)
      setBundles((prev) => {
        const clone = { ...prev };
        clone[currentScenarioId].agentTraces = clone[currentScenarioId].agentTraces.map((t, idx) => {
          if (idx === i) {
            const originalTrace = scenarioBundles[currentScenarioId].agentTraces[idx];
            return { ...t, status: originalTrace.status };
          }
          return t;
        });
        return clone;
      });
    }

    // After all steps, set the incidents to their loaded status
    setBundles((prev) => {
      const clone = { ...prev };
      // Restore the mock incident(s) from template scenarios
      clone[currentScenarioId].incidents = JSON.parse(JSON.stringify(scenarioBundles[currentScenarioId].incidents));
      return clone;
    });

    setIsAnalyzing(false);
    setAnalysisStep(-1);
    
    if (currentScenarioId === "weather_fp") {
      addToast("Analysis complete. Flagged false positive — weather fully explains telemetry deviation.", "success");
    } else if (currentScenarioId === "normal") {
      addToast("Analysis complete. System is operating normally.", "success");
    } else {
      const generatedCount = scenarioBundles[currentScenarioId].incidents.length;
      addToast(`Analysis complete — ${generatedCount} high-priority incident generated.`, "success");
    }
  };

  const approveIncident = (id: string, reason: string = "Recommended action requires taking inverter offline") => {
    setBundles((prev) => {
      const clone = { ...prev };
      const currentIncidents = clone[currentScenarioId].incidents.map((inc) => {
        if (inc.id === id) {
          return { ...inc, status: "approved" as IncidentStatus };
        }
        return inc;
      });

      const newAudit: AuditEvent = {
        id: `AUD-${Date.now()}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        actor: "Operator (Human-in-the-Loop)",
        action: "approved",
        reason
      };

      clone[currentScenarioId].incidents = currentIncidents;
      clone[currentScenarioId].auditTrail = [newAudit, ...clone[currentScenarioId].auditTrail];
      return clone;
    });
    addToast(`Inspection approved for ${id}.`, "success");
  };

  const createWorkOrder = (id: string, assignedTo: string = "Maria Gonzalez") => {
    setBundles((prev) => {
      const clone = { ...prev };
      const currentIncidents = clone[currentScenarioId].incidents.map((inc) => {
        if (inc.id === id) {
          return { ...inc, status: "work_order_created" as IncidentStatus };
        }
        return inc;
      });

      const newAudit: AuditEvent = {
        id: `AUD-${Date.now()}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        actor: "Operator Console",
        action: "workorder_created",
        reason: `Work order WO-2026-04412 created and assigned to ${assignedTo}.`
      };

      clone[currentScenarioId].incidents = currentIncidents;
      clone[currentScenarioId].auditTrail = [newAudit, ...clone[currentScenarioId].auditTrail];
      return clone;
    });
    addToast(`Work order WO-2026-04412 created and assigned to ${assignedTo}.`, "success");
  };

  const markFalsePositive = (id: string, reason: string) => {
    setBundles((prev) => {
      const clone = { ...prev };
      const currentIncidents = clone[currentScenarioId].incidents.map((inc) => {
        if (inc.id === id) {
          return { ...inc, status: "closed" as IncidentStatus };
        }
        return inc;
      });

      const newAudit: AuditEvent = {
        id: `AUD-${Date.now()}`,
        incidentId: id,
        timestamp: new Date().toISOString(),
        actor: "Operator (Human-in-the-Loop)",
        action: "acknowledged",
        reason: `Marked as False Positive. Reason: ${reason}`
      };

      clone[currentScenarioId].incidents = currentIncidents;
      clone[currentScenarioId].auditTrail = [newAudit, ...clone[currentScenarioId].auditTrail];
      return clone;
    });
    addToast(`Incident ${id} marked as false positive.`, "info");
  };

  const rerunEvaluation = async () => {
    setIsEvaluating(true);
    addToast("Re-running ground truth evaluation cases...", "info");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsEvaluating(false);
    addToast("Evaluation complete — 3/3 cases passed (100% accuracy).", "success");
  };

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
        switchScenario,
        runAIAnalysis,
        approveIncident,
        createWorkOrder,
        markFalsePositive,
        addToast,
        removeToast,
        rerunEvaluation,
        isEvaluating
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
