"use client";

import React, { useState, useEffect } from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import AlertCompression from "@/components/AlertCompression";
import { formatCurrency, formatEnergy, formatPercent } from "@/lib/format";
import { ShieldAlert, ArrowRight, Eye, ShieldCheck, Cpu } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LiveEventFeed from "@/components/LiveEventFeed";

export default function CommandCenterPage() {
  const router = useRouter();
  const { activeBundle, incidents, isAnalyzing } = useScenario();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Auto-select first incident when scenario loads
  useEffect(() => {
    if (incidents.length > 0) {
      setSelectedIncidentId(incidents[0].id);
    } else {
      setSelectedIncidentId(null);
    }
  }, [incidents]);

  const selectedIncident = incidents.find((inc) => inc.id === selectedIncidentId);

  // Status map to KPI borders
  const kpiData = activeBundle.kpis;

  const handleRowClick = (id: string) => {
    setSelectedIncidentId(id);
  };

  const handleRowDoubleClick = (id: string) => {
    router.push(`/incidents/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Active Incidents"
          value={kpiData.activeIncidents?.value || "0"}
          subtext={kpiData.activeIncidents?.subtext}
          status={kpiData.activeIncidents?.status as any}
        />
        <MetricCard
          label="Alerts Correlated"
          value={kpiData.alertsCorrelated?.value || "0"}
          subtext={kpiData.alertsCorrelated?.subtext}
          status={kpiData.alertsCorrelated?.status as any}
        />
        <MetricCard
          label="Energy at Risk"
          value={kpiData.energyRisk?.value || "0"}
          subtext={kpiData.energyRisk?.subtext}
          status={kpiData.energyRisk?.status as any}
        />
        <MetricCard
          label="Mean Triage Time"
          value={kpiData.meanTriage?.value || "1.9 min"}
          trend={kpiData.meanTriage?.trend}
          status={kpiData.meanTriage?.status as any}
        />
        <MetricCard
          label="Approvals Pending"
          value={kpiData.approvalsPending?.value || "0"}
          subtext={kpiData.approvalsPending?.subtext}
          status={kpiData.approvalsPending?.status as any}
        />
      </div>

      {/* Live Event Feed — full width between KPIs and incident queue */}
      <LiveEventFeed />

      {/* Main Grid: Left List + Right Brief */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Priority Queue */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0F172A] tracking-tight">
                Incident Priority Queue
              </h2>
              <span className="text-xs text-[#64748B] font-semibold">
                Sorted by severity and risk impact
              </span>
            </div>

            {isAnalyzing && incidents.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-4 border-[#0EA5E9] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#64748B] font-semibold animate-pulse">
                  Agent swarm correlation engine active...
                </p>
              </div>
            ) : incidents.length === 0 ? (
              <div className="border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B] py-16 bg-[#F8FAFC]">
                <Cpu className="w-8 h-8 mx-auto text-[#CBD5E1] mb-2" />
                <p className="font-semibold text-[#334155] mb-1">No Active Incidents</p>
                <p>Telemetry values are normal. Select another scenario or run AI analysis.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                      <th className="px-4 py-3">Severity</th>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Root Cause</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Impact</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {incidents.map((inc) => {
                      const isSelected = inc.id === selectedIncidentId;
                      return (
                        <tr
                          key={inc.id}
                          onClick={() => handleRowClick(inc.id)}
                          onDoubleClick={() => handleRowDoubleClick(inc.id)}
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isSelected ? "bg-sky-50/30" : ""
                          }`}
                        >
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <StatusBadge severity={inc.severity} />
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-[#0EA5E9] whitespace-nowrap">
                            {inc.id}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-[#0F172A]">
                            {inc.assetName}
                          </td>
                          <td className="px-4 py-3.5 text-[#334155] max-w-xs truncate font-medium">
                            {inc.rootCause}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-sky-500 h-full"
                                  style={{ width: `${inc.confidence * 100}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] font-bold text-[#334155]">
                                {formatPercent(inc.confidence)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-red-600 whitespace-nowrap">
                            {formatEnergy(inc.energyImpactMWhPerDay)}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex gap-2">
                              {inc.approvalRequired && inc.status === "awaiting_review" && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-[10px] uppercase">
                                  <ShieldAlert className="w-3 h-3" />
                                  Approval
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/incidents/${inc.id}`);
                                }}
                                className="p-1 text-[#64748B] hover:text-[#0EA5E9] transition-colors rounded hover:bg-slate-100"
                                title="Open incident details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alert Compression Visualization */}
          <AlertCompression />
        </div>

        {/* Right Column: Selected Incident Brief */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Selected Incident Brief
            </h2>

            {selectedIncident ? (
              <div className="space-y-4">
                {/* ID & Severity */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#0EA5E9] text-sm">
                    {selectedIncident.id}
                  </span>
                  <StatusBadge severity={selectedIncident.severity} />
                </div>

                {/* Title and Asset */}
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] leading-snug">
                    {selectedIncident.title}
                  </h3>
                  <p className="text-xs text-[#64748B] font-semibold mt-1">
                    Asset: {selectedIncident.assetName}
                  </p>
                </div>

                <hr className="border-[#E2E8F0]" />

                {/* Brief Narrative */}
                <div>
                  <h4 className="text-xs font-bold text-[#334155] mb-1">
                    Operator Briefing
                  </h4>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {selectedIncident.rootCauseNarrative}
                  </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-[#E2E8F0] rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">
                      Energy Risk
                    </span>
                    <span className="font-mono font-bold text-red-600">
                      {selectedIncident.energyImpactMWhPerDay} MWh/day
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px] font-semibold uppercase tracking-wide">
                      Revenue Loss
                    </span>
                    <span className="font-mono font-bold text-red-600">
                      {formatCurrency(selectedIncident.revenueImpactPerDay)}/day
                    </span>
                  </div>
                </div>

                {/* Recommended Action Summary */}
                <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-[#0369A1] block">
                    Recommended Action:
                  </span>
                  <p className="text-[#0284C7] leading-relaxed font-semibold">
                    {selectedIncident.recommendedAction}
                  </p>
                </div>

                {/* Governance Flag */}
                {selectedIncident.approvalRequired && (
                  <div className="flex gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium leading-relaxed">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Approval Gated</span>
                      <span>Requires human permission verification prior to execution.</span>
                    </div>
                  </div>
                )}

                {/* Action CTA list */}
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={`/incidents/${selectedIncident.id}`}
                    className="w-full inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-[#0EA5E9] text-white hover:bg-[#0369A1] font-semibold rounded-xl text-xs transition-colors focus:outline-none"
                  >
                    <span>Investigate Incident Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-semibold text-[#0EA5E9] pt-1">
                    <Link
                      href={`/ai-workflow?incident=${selectedIncident.id}`}
                      className="py-1.5 border border-[#CBD5E1] rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      AI Agent Traces
                    </Link>
                    <Link
                      href={`/observability?incident=${selectedIncident.id}`}
                      className="py-1.5 border border-[#CBD5E1] rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Gateway Observability
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-xs text-[#64748B] italic">
                Select an incident from the queue to view its summary briefing.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
