"use client";

import React, { useState } from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import MetricCard from "@/components/MetricCard";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Terminal,
  Server,
  Network,
  AlertCircle
} from "lucide-react";

export default function ObservabilityPage() {
  const { activeBundle } = useScenario();
  const [activeTab, setActiveTab] = useState<"routing" | "traces" | "health">("routing");

  const traces = activeBundle.trueFoundryTraces;

  // Aggregate gateway stats from traces
  const totalCalls = traces.length > 0 ? traces.length : 18;
  const totalLatencyMs = traces.reduce((acc, t) => acc + t.latencyMs, 0);
  const totalLatencyS = traces.length > 0 ? (totalLatencyMs / 1000).toFixed(1) : "11.4";
  const estCostUsd = traces.reduce((acc, t) => acc + t.costUsd, 0);
  const displayCost = estCostUsd > 0 ? estCostUsd : 0.042;

  // Mock list of service routing configurations
  const routingRules = [
    { caller: "Alert Correlation Agent", requested: "gpt-4o-mini", routed: "gpt-4o-mini", provider: "OpenAI (TrueFoundry Gateway)", calls: "1", avgLatency: "820ms", cost: "$0.004", status: "Healthy" },
    { caller: "Telemetry Analysis Agent", requested: "gpt-4o-mini", routed: "gpt-4o-mini", provider: "OpenAI (TrueFoundry Gateway)", calls: "1", avgLatency: "1640ms", cost: "$0.006", status: "Healthy" },
    { caller: "Maintenance History Agent", requested: "gpt-4o-mini", routed: "gpt-4o-mini", provider: "OpenAI (TrueFoundry Gateway)", calls: "1", avgLatency: "1120ms", cost: "$0.005", status: "Healthy" },
    { caller: "Weather/Forecast Agent", requested: "gpt-4o-mini", routed: "gpt-4o-mini", provider: "OpenAI (TrueFoundry Gateway)", calls: "1", avgLatency: "980ms", cost: "$0.004", status: "Healthy" },
    { caller: "Root Cause Agent", requested: "gpt-4o-mini", routed: "gpt-4o-mini", provider: "OpenAI (TrueFoundry Gateway)", calls: "1", avgLatency: "1530ms", cost: "$0.007", status: "Healthy" },
    { caller: "Operator Briefing Agent", requested: "gpt-4o", routed: "gpt-4o", provider: "OpenAI (TrueFoundry Gateway)", calls: "1", avgLatency: "2100ms", cost: "$0.011", status: "Healthy" },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Gateway Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Model Calls" value={String(totalCalls)} subtext="Active across session" status="success" />
        <MetricCard label="Gateway Latency" value={`${totalLatencyS}s`} subtext="Accumulated run duration" status="neutral" />
        <MetricCard label="Accumulated Cost" value={formatCurrency(displayCost)} subtext="Calculated via input/output tags" status="success" />
        <MetricCard label="Gateway Status" value="Healthy" subtext="0 errors, 100% uptime" status="success" />
        <MetricCard label="Fallback Triggers" value="0" subtext="No failovers activated" status="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Observability views */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
            {/* Tab Navigation header */}
            <div className="border-b border-[#E2E8F0] bg-slate-50 flex items-center px-6">
              <button
                onClick={() => setActiveTab("routing")}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "routing"
                    ? "border-[#0EA5E9] text-[#0369A1]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Model Routing Configuration
              </button>
              <button
                onClick={() => setActiveTab("traces")}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "traces"
                    ? "border-[#0EA5E9] text-[#0369A1]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Trace Execution Timeline (Gantt)
              </button>
              <button
                onClick={() => setActiveTab("health")}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "health"
                    ? "border-[#0EA5E9] text-[#0369A1]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Microservice Status & Resources
              </button>
            </div>

            {/* Tab 1: Model Routing Table */}
            {activeTab === "routing" && (
              <div className="p-6">
                <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                        <th className="px-4 py-3">Agent Name</th>
                        <th className="px-4 py-3">Requested Model</th>
                        <th className="px-4 py-3">Routed Model</th>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">Avg Latency</th>
                        <th className="px-4 py-3">Avg Cost</th>
                        <th className="px-4 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                      {routingRules.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 font-semibold text-[#0F172A]">{rule.caller}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-500">{rule.requested}</td>
                          <td className="px-4 py-3.5 font-mono text-[#0EA5E9] font-bold">{rule.routed}</td>
                          <td className="px-4 py-3.5 font-semibold text-[#64748B]">{rule.provider}</td>
                          <td className="px-4 py-3.5 font-mono font-bold">{rule.avgLatency}</td>
                          <td className="px-4 py-3.5 font-mono font-bold text-emerald-600">{rule.cost}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-emerald-600">{rule.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Gantt Chart Execution Timeline */}
            {activeTab === "traces" && (
              <div className="p-6 space-y-6">
                <p className="text-xs text-[#64748B] leading-relaxed">
                  The timeline below shows sequential LLM latency call distributions tracked across the CrewAI workflow.
                </p>

                {traces.length === 0 ? (
                  <div className="border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B] py-16 bg-[#F8FAFC]">
                    No trace data available for the active scenario. Run AI Analysis to generate traces.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {traces.map((trace, idx) => {
                      // Calculate mock offsets for horizontal bar representation
                      const maxDuration = traces.reduce((acc, t) => acc + t.latencyMs, 0);
                      let startOffset = 0;
                      for (let i = 0; i < idx; i++) {
                        startOffset += traces[i].latencyMs;
                      }

                      const startPct = (startOffset / maxDuration) * 100;
                      const widthPct = (trace.latencyMs / maxDuration) * 100;

                      return (
                        <div key={trace.id} className="grid grid-cols-12 items-center gap-4 text-xs">
                          {/* Label */}
                          <div className="col-span-4 font-bold text-[#0F172A] truncate">
                            {trace.caller}
                          </div>

                          {/* Gantt Bar Area */}
                          <div className="col-span-6 relative bg-slate-100 h-6 rounded-lg overflow-hidden border border-[#E2E8F0]">
                            <div
                              style={{
                                left: `${startPct}%`,
                                width: `${widthPct}%`
                              }}
                              className={`absolute top-0 bottom-0 rounded transition-all duration-500 hover:brightness-95 flex items-center justify-end px-2 text-[9px] font-mono font-bold text-white shadow-sm bg-[#0EA5E9]`}
                              title={`${trace.caller}: ${trace.latencyMs}ms (${trace.model})`}
                            >
                              <span>{trace.latencyMs}ms</span>
                            </div>
                          </div>

                          {/* Cost */}
                          <div className="col-span-2 text-right font-mono font-bold text-[#334155]">
                            {formatCurrency(trace.costUsd)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Anomaly service microservice health card */}
            {activeTab === "health" && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-bold text-[#0F172A]">renewable-anomaly-service</h4>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase">Healthy / Active</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#E2E8F0] pt-3">
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">P95 Latency</span>
                      <span className="font-mono font-bold text-[#0F172A]">220ms</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">Uptime</span>
                      <span className="font-mono font-bold text-[#0F172A]">99.99%</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">Replicas</span>
                      <span className="font-mono font-bold text-[#0F172A]">3 / 3 active</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">CPU Allocation</span>
                      <span className="font-mono font-bold text-emerald-600">14.2% limit</span>
                    </div>
                  </div>
                </div>

                <div className="border border-[#E2E8F0] rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Network className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-xs font-bold text-[#0F172A]">crew-ai-orchestrator</h4>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase">Healthy / Standby</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#E2E8F0] pt-3">
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">Avg Workflow</span>
                      <span className="font-mono font-bold text-[#0F172A]">11.4s run time</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">Memory Used</span>
                      <span className="font-mono font-bold text-[#0F172A]">184 MB</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">Active Instances</span>
                      <span className="font-mono font-bold text-[#0F172A]">1 / 1 replica</span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">Failure Rates</span>
                      <span className="font-mono font-bold text-emerald-600">0.00%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gateway audit logs logs console */}
          <div className="bg-slate-900 border border-slate-950 rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#0EA5E9]" />
                <span>AI Gateway Telemetry Logs</span>
              </h3>
              <span className="text-[10px] font-mono text-[#64748B]">Real-time logs stdout</span>
            </div>

            <div className="font-mono text-[10.5px] text-[#CBD5E1] space-y-2 max-h-64 overflow-y-auto pr-1 leading-relaxed">
              {traces.length === 0 ? (
                <p className="text-[#64748B] italic">Waiting for gateway request traces...</p>
              ) : (
                traces.map((trace) => (
                  <div key={trace.id} className="border-b border-slate-800 pb-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <span className="text-emerald-400 font-semibold">[{formatDateTime(trace.timestamp)}]</span>{" "}
                      <span className="text-sky-300 font-bold">{trace.caller}</span>{" "}
                      <span className="text-slate-400">called</span>{" "}
                      <span className="text-amber-400 font-bold">{trace.model}</span>
                    </div>
                    <div className="text-[9.5px] text-[#94A3B8] font-semibold flex items-center gap-2 sm:self-end">
                      <span>Status: {trace.status.toUpperCase()}</span>
                      <span>Latency: {trace.latencyMs}ms</span>
                      <span>Cost: {formatCurrency(trace.costUsd)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column: Fallbacks & policies details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Failover & Fallback Policies
            </h3>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
                <span>Dynamic Failover Active</span>
              </div>
              <p className="text-[11px] text-[#B45309] leading-relaxed">
                Rules: If primary gateway model request latency exceeds <strong>5.0 seconds</strong> or encounters a 5xx API code error, the gateway routes instantly to the fallback model pool.
              </p>
            </div>

            <hr className="border-[#E2E8F0]" />

            <div className="space-y-3.5 text-xs text-[#334155]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#64748B]">Primary Model Route</span>
                <span className="font-mono bg-slate-100 text-[#0F172A] px-2 py-0.5 rounded font-bold">gpt-4o-mini</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#64748B]">Fallback Model Route</span>
                <span className="font-mono bg-slate-100 text-[#0F172A] px-2 py-0.5 rounded font-bold">claude-3-haiku</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#64748B]">Gateway Provider</span>
                <span className="font-semibold text-[#0EA5E9]">TrueFoundry Gateway</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#64748B]">Observability Sync</span>
                <span className="text-emerald-600 font-bold">1-sec latency polling</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
