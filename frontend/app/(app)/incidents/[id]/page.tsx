"use client";

import React, { use } from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import StatusBadge from "@/components/StatusBadge";
import EvidenceCard from "@/components/EvidenceCard";
import TelemetryChart from "@/components/TelemetryChart";
import ActionPanel from "@/components/ActionPanel";
import { formatDateTime, formatEnergy, formatCurrency, formatPercent } from "@/lib/format";
import { ArrowLeft, Clock, FileText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageParams = {
  id: string;
};

export default function IncidentDetailPage({ params }: { params: Promise<PageParams> }) {
  // Resolve params promise
  const resolvedParams = use(params);
  const incidentId = resolvedParams.id;

  const { activeBundle, incidents, isAnalyzing } = useScenario();

  // Look up incident in current scenario bundle
  const incident = incidents.find((inc) => inc.id === incidentId);

  if (!incident) {
    // If we're analyzing, show a loading state
    if (isAnalyzing) {
      return (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-[#0EA5E9] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#64748B] font-semibold">
            Loading incident trace report...
          </p>
        </div>
      );
    }
    return notFound();
  }

  // Get alerts and evidence for this incident
  const incidentAlerts = activeBundle.alerts.filter((a) => a.groupedIntoIncidentId === incidentId || a.assetId === incident.assetId);
  const incidentEvidence = activeBundle.evidence.filter((e) => e.incidentId === incidentId);
  const incidentTelemetry = activeBundle.telemetry.filter((t) => t.incidentId === incidentId || t.id.includes(incident.assetId));

  // Get status pill details
  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "awaiting_review":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "approved":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "work_order_created":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "closed":
        return "bg-slate-100 text-slate-800 border-slate-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new":
        return "New Trigger";
      case "analyzing":
        return "AI Analyzing";
      case "awaiting_review":
        return "Awaiting Approval";
      case "approved":
        return "Authorized / Approved";
      case "work_order_created":
        return "Work Order Created";
      case "closed":
        return "Closed (False Positive)";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link
          href="/command-center"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Command Center</span>
        </Link>
        <span className="text-xs text-[#64748B] font-medium font-mono">
          Scenario: {activeBundle.label}
        </span>
      </div>

      {/* 7.2 Hero Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge severity={incident.severity} />
            <span className="font-mono text-xs font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {incident.id}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadgeStyle(incident.status)}`}>
              {getStatusLabel(incident.status)}
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] leading-snug">
            {incident.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#64748B] font-semibold">
            <span>Asset: <strong className="text-[#0F172A]">{incident.assetName}</strong></span>
            <span>·</span>
            <span>Site: <strong className="text-[#0F172A]">{incident.site}</strong></span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Created: {formatDateTime(incident.createdAt)}</span>
            </span>
          </div>
        </div>

        {/* Compact Right KPIs */}
        <div className="flex items-center gap-6 divide-x divide-[#E2E8F0] bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 md:self-center">
          <div className="text-center px-4">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
              Energy Risk
            </span>
            <span className="font-mono text-sm font-extrabold text-red-600">
              {formatEnergy(incident.energyImpactMWhPerDay)}
            </span>
          </div>
          <div className="text-center px-4">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
              Revenue Loss
            </span>
            <span className="font-mono text-sm font-extrabold text-red-600">
              {formatCurrency(incident.revenueImpactPerDay)}/day
            </span>
          </div>
          <div className="text-center px-4">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
              Confidence
            </span>
            <span className="font-mono text-sm font-extrabold text-[#0EA5E9]">
              {formatPercent(incident.confidence)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Details + Right Sticky Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (65%) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Root Cause Narrative */}
          <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
              <FileText className="w-4 h-4 text-[#0EA5E9]" />
              <h3 className="text-sm font-bold text-[#0F172A]">
                AI Briefing & Diagnosis Summary
              </h3>
            </div>
            <p className="text-sm text-[#334155] leading-relaxed">
              {incident.rootCauseNarrative}
            </p>
          </section>

          {/* 2. Telemetry Charts */}
          {incidentTelemetry.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Telemetry Diagnostics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incidentTelemetry.map((chart) => (
                  <TelemetryChart
                    key={chart.id}
                    title={chart.title}
                    metric={chart.metric}
                    unit={chart.unit}
                    threshold={chart.threshold}
                    series={chart.series}
                    comparisonSeries={chart.comparisonSeries}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3. Evidence Timeline */}
          {incidentAlerts.length > 0 && (
            <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A]">
                Causal Sequence Timeline
              </h3>
              <div className="relative border-l border-[#E2E8F0] pl-6 ml-3 space-y-5">
                {incidentAlerts.map((alert) => (
                  <div key={alert.id} className="relative">
                    {/* Circle marker */}
                    <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-2 border-white bg-[#E2E8F0] flex items-center justify-center">
                      <div className={`w-2 h-2 rounded-full ${
                        alert.severity === "critical"
                          ? "bg-red-500"
                          : alert.severity === "high"
                          ? "bg-orange-500"
                          : "bg-amber-500"
                      }`} />
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#64748B]">
                          {new Date(alert.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "UTC",
                            hour12: false
                          })} UTC
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                          alert.severity === "critical"
                            ? "bg-red-50 border border-red-200 text-red-700"
                            : alert.severity === "high"
                            ? "bg-orange-50 border border-orange-200 text-orange-700"
                            : "bg-amber-50 border border-amber-200 text-amber-700"
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="font-semibold text-[#0F172A]">{alert.message}</p>
                      <p className="text-[10px] text-[#64748B]">Source: SCADA / {alert.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. Supporting Evidence Cards */}
          {incidentEvidence.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Sourced Evidence Documents
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incidentEvidence.map((evidence) => (
                  <EvidenceCard key={evidence.id} evidence={evidence} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (35%) - Sticky Action Panel */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 z-10">
          <ActionPanel incidentId={incident.id} />
        </div>
      </div>
    </div>
  );
}
