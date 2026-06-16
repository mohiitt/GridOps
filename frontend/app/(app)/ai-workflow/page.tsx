"use client";

import React, { useState, useEffect } from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import { AgentTrace } from "@/types";
import {
  Circle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  Terminal,
  Info
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function AiWorkflowPage() {
  const { agentTraces, isAnalyzing, analysisStep } = useScenario();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Get active selected agent trace
  const selectedAgent = agentTraces.find((t) => t.id === selectedAgentId);

  // Auto-select running agent or first agent if finished
  useEffect(() => {
    if (analysisStep >= 0 && agentTraces[analysisStep]) {
      setSelectedAgentId(agentTraces[analysisStep].id);
    } else if (agentTraces.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agentTraces[0].id);
    }
  }, [analysisStep, agentTraces, selectedAgentId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Circle className="w-5 h-5 text-slate-300 stroke-[1.5]" />;
      case "running":
        return <Loader2 className="w-5 h-5 text-amber-500 animate-spin stroke-[2]" />;
      case "complete":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[2]" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-500 stroke-[2]" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500 stroke-[2]" />;
      default:
        return null;
    }
  };

  const getNodeBorder = (status: string, isSelected: boolean) => {
    if (isSelected) return "border-[#0EA5E9] ring-2 ring-[#0EA5E9]/20";
    switch (status) {
      case "running":
        return "border-amber-300 bg-amber-50/10";
      case "complete":
        return "border-emerald-200 hover:border-emerald-300";
      case "warning":
        return "border-amber-200 hover:border-amber-300";
      case "failed":
        return "border-red-200 hover:border-red-300";
      default:
        return "border-[#E2E8F0] opacity-60";
    }
  };

  // Calculate workflow totals
  const totals = agentTraces.reduce(
    (acc, t) => {
      if (t.status !== "pending") {
        acc.latency += t.latencyMs;
        acc.cost += t.costUsd;
      }
      return acc;
    },
    { latency: 0, cost: 0 }
  );

  return (
    <div className="space-y-6">
      {/* 1. Totals Header Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-50 text-[#0EA5E9] border border-sky-100">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">CrewAI Multi-Agent Pipeline</h2>
            <p className="text-xs text-[#64748B] font-semibold">9 Agents executing tasks in sequence</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs divide-x divide-[#E2E8F0]">
          <div className="px-4">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">Total Latency</span>
            <span className="font-mono font-bold text-[#0F172A]">
              {(totals.latency / 1000).toFixed(2)}s
            </span>
          </div>
          <div className="px-4">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">Estimated Cost</span>
            <span className="font-mono font-bold text-[#0F172A]">
              {formatCurrency(totals.cost)}
            </span>
          </div>
          <div className="px-4">
            <span className="text-[10px] font-bold text-[#64748B] block uppercase tracking-wider">Avg Latency/Agent</span>
            <span className="font-mono font-bold text-[#0F172A]">
              {agentTraces.length ? (totals.latency / agentTraces.length / 1000).toFixed(2) : "0"}s
            </span>
          </div>
        </div>
      </div>

      {/* Main Graph Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Pipeline Graph Grid */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Agent Workflow Pipeline
            </h3>

            <div className="flex flex-col gap-3">
              {agentTraces.map((trace, idx) => {
                const isSelected = trace.id === selectedAgentId;
                
                return (
                  <div key={trace.id} className="relative flex flex-col items-center">
                    {/* Node Card */}
                    <div
                      onClick={() => setSelectedAgentId(trace.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-sm ${getNodeBorder(
                        trace.status,
                        isSelected
                      )}`}
                    >
                      <div className="flex items-center gap-3.5 truncate">
                        <div className="flex-shrink-0">{getStatusIcon(trace.status)}</div>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                            <span>{trace.agentName}</span>
                            <span className="font-mono text-[9px] bg-slate-100 text-[#64748B] px-1.5 py-0.5 rounded uppercase font-semibold">
                              {trace.model}
                            </span>
                          </h4>
                          <p className="text-[10px] text-[#64748B] font-semibold mt-0.5 truncate">
                            Role: {trace.role}
                          </p>
                        </div>
                      </div>

                      {/* Small node stats */}
                      {trace.status !== "pending" && (
                        <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-[#334155] flex-shrink-0">
                          <span>{trace.latencyMs}ms</span>
                          <span>{formatCurrency(trace.costUsd)}</span>
                        </div>
                      )}
                    </div>

                    {/* Connector Arrow */}
                    {idx < agentTraces.length - 1 && (
                      <div className="h-4 flex items-center justify-center">
                        <div className="w-0.5 bg-[#E2E8F0] h-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Selected Node Detail Drawer/Panel */}
        <div className="lg:col-span-5 lg:sticky lg:top-20">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-[#0EA5E9]" />
                <span>Agent Execution Details</span>
              </h3>
            </div>

            {selectedAgent ? (
              <div className="space-y-4 text-xs">
                {/* Agent Header */}
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A]">{selectedAgent.agentName}</h4>
                  <p className="text-xs text-[#64748B] font-semibold mt-0.5">Role: {selectedAgent.role}</p>
                </div>

                {/* Model, Latency, Cost */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 border border-[#E2E8F0] p-2.5 rounded-xl">
                  <div>
                    <span className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wide block">Model</span>
                    <span className="font-mono font-bold text-[#0F172A]">{selectedAgent.model}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wide block">Latency</span>
                    <span className="font-mono font-bold text-[#0F172A]">{selectedAgent.latencyMs}ms</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold text-[#64748B] uppercase tracking-wide block">Cost</span>
                    <span className="font-mono font-bold text-[#0F172A]">{formatCurrency(selectedAgent.costUsd)}</span>
                  </div>
                </div>

                <hr className="border-[#E2E8F0]" />

                {/* Inputs Summaries */}
                <div className="space-y-2">
                  <h5 className="font-bold text-[#334155] uppercase tracking-wider text-[10px]">
                    Input Context / Parameters
                  </h5>
                  <div className="bg-slate-900 text-[#CBD5E1] p-3 rounded-lg font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-950">
                    <span className="text-sky-400"># Input Summary:</span>
                    <p className="mt-1">{selectedAgent.inputSummary}</p>
                  </div>
                </div>

                {/* Outputs Summaries */}
                <div className="space-y-2">
                  <h5 className="font-bold text-[#334155] uppercase tracking-wider text-[10px]">
                    Output Response / Verdict
                  </h5>
                  <div className="bg-slate-900 text-[#CBD5E1] p-3 rounded-lg font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-950">
                    <span className="text-emerald-400"># Agent Reasoning Output:</span>
                    <p className="mt-1">{selectedAgent.outputSummary}</p>
                    {selectedAgent.confidence !== undefined && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[9px] text-[#94A3B8]">
                        <span>Confidence Verdict:</span>
                        <span className="text-emerald-400 font-bold">
                          {formatPercent(selectedAgent.confidence)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Tip */}
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-2 text-[#1D4ED8]">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    This step is executed as a part of the CrewAI sequence, utilizing specialized context tools. Output keys are validation-gated before piping to downstream agents.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-[#64748B] italic">
                Click on any agent node on the left graph to inspect its parameters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
