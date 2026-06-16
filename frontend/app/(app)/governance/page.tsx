"use client";

import React from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import {
  ShieldCheck,
  Check,
  X,
  Lock,
  Unlock
} from "lucide-react";

export default function GovernancePage() {
  const {
    activeBundle,
    incidents,
    auditTrail,
    approveIncident,
    markFalsePositive
  } = useScenario();

  const rules = activeBundle.governanceRules;
  const pendingIncidents = incidents.filter((inc) => inc.status === "awaiting_review" && inc.approvalRequired);

  const restrictedActions = [
    "Take energy grid assets offline",
    "Modify solar inverter active power output setpoints",
    "Isolate battery energy storage modules autonomously",
    "Change high-voltage substation grid interconnection parameters"
  ];

  const allowedActions = [
    "Generate operator diagnostic reports",
    "Draft maintenance work order blueprints",
    "Flag SCADA alerts as correlated clusters",
    "Dispatch warnings to active site technicians"
  ];

  return (
    <div className="space-y-6">
      {/* Human-in-the-loop header explanation banner */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-5 flex gap-4 text-[#1D4ED8] items-start">
        <ShieldCheck className="w-6 h-6 text-[#0EA5E9] flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs leading-relaxed">
          <h3 className="font-bold text-[#0F172A] text-sm">Human-in-the-Loop Operational Governance</h3>
          <p className="text-[#334155]">
            GridOps Copilot is designed exclusively for decision support. The AI agent swarm analyses root causes and recommends actions, but it is blocked from executing physical operations on solar/BESS assets autonomously. All physical dispatch actions require human approval.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (65%) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Approval Rules */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A]">
              Active Governance Validation Rules
            </h3>
            <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                    <th className="px-4 py-3">Rule Name</th>
                    <th className="px-4 py-3">Condition Trigger</th>
                    <th className="px-4 py-3">Enforced Action</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5 font-bold text-[#0F172A]">{rule.name}</td>
                      <td className="px-4 py-3.5 font-mono text-[10px] text-slate-500">{rule.condition}</td>
                      <td className="px-4 py-3.5 font-semibold text-[#64748B]">{rule.action}</td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {rule.triggered ? (
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-[10px] uppercase">
                            Triggered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-bold text-[10px] uppercase">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Pending Approvals Queue */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A]">
              Pending Actions Requiring Human Review
            </h3>

            {pendingIncidents.length === 0 ? (
              <div className="border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B] py-10 bg-[#F8FAFC]">
                No operational actions currently awaiting verification.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="border border-[#E2E8F0] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 hover:bg-slate-50 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0EA5E9]">{inc.id}</span>
                        <StatusBadge severity={inc.severity} />
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A]">{inc.title}</h4>
                      <p className="text-xs text-[#64748B] font-semibold">
                        Recommended Action: <strong className="text-[#334155]">{inc.recommendedAction}</strong>
                      </p>
                    </div>

                    <div className="flex gap-2 self-start md:self-center">
                      <button
                        onClick={() => approveIncident(inc.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors focus:outline-none"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const r = prompt("Reason for rejection:");
                          if (r) markFalsePositive(inc.id, r);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject (FP)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (35%) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Allowed vs Restricted Lists */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-5">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Control Boundaries
            </h3>

            {/* Restricted (Red) */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-red-700 text-xs font-bold">
                <Lock className="w-4 h-4 text-red-500" />
                <span>Restricted (AI Blocked)</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-[#64748B] space-y-2 leading-relaxed font-semibold">
                {restrictedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>

            <hr className="border-[#E2E8F0]" />

            {/* Allowed (Green) */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                <Unlock className="w-4 h-4 text-emerald-500" />
                <span>Allowed (AI Recommended)</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-[#64748B] space-y-2 leading-relaxed font-semibold">
                {allowedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Immutable audit logs logs */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Governance Decision Logs
            </h3>
            
            {auditTrail.length === 0 ? (
              <p className="text-xs text-[#64748B] italic">No audit trail items recorded.</p>
            ) : (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {auditTrail.map((audit) => (
                  <div key={audit.id} className="text-xs border-l-2 border-[#CBD5E1] pl-3 py-0.5 space-y-1">
                    <div className="flex items-center justify-between text-[#64748B] text-[10px] font-mono">
                      <span>{formatDateTime(audit.timestamp)}</span>
                      <span className="font-bold uppercase">{audit.action}</span>
                    </div>
                    <p className="text-[#334155] leading-relaxed">
                      <strong className="text-[#0F172A]">{audit.actor}:</strong>{" "}
                      {audit.reason || "Operational request processed"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
