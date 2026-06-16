"use client";

import React, { useState } from "react";
import { useScenario } from "../providers/ScenarioProvider";
import { ShieldAlert, ShieldCheck, Check, Plus, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "../lib/format";

type ActionPanelProps = {
  incidentId: string;
};

export default function ActionPanel({ incidentId }: ActionPanelProps) {
  const {
    incidents,
    auditTrail,
    approveIncident,
    createWorkOrder,
    markFalsePositive
  } = useScenario();

  const [isFalsePositiveModalOpen, setIsFalsePositiveModalOpen] = useState(false);
  const [falsePositiveReason, setFalsePositiveReason] = useState("");

  const incident = incidents.find((inc) => inc.id === incidentId);

  if (!incident) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm text-sm text-[#64748B]">
        No active incident selected.
      </div>
    );
  }

  const { recommendedAction, approvalRequired, approver, status } = incident;

  // Filter audit trail for this incident
  const incidentAudits = auditTrail.filter((a) => a.incidentId === incidentId);

  const handleFalsePositiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!falsePositiveReason.trim()) return;
    markFalsePositive(incidentId, falsePositiveReason);
    setIsFalsePositiveModalOpen(false);
    setFalsePositiveReason("");
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.08)] p-6 space-y-6">
      {/* Recommended Action */}
      <div>
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
          Recommended Action
        </h3>
        <p className="text-base font-bold text-[#0F172A] leading-snug">
          {recommendedAction}
        </p>
      </div>

      {/* Governance Banner */}
      {approvalRequired && (
        <div
          className={`flex gap-3 p-4 rounded-xl border ${
            status === "awaiting_review"
              ? "bg-[#FFF7ED] border-[#FED7AA] text-[#C2410C]"
              : "bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]"
          }`}
        >
          {status === "awaiting_review" ? (
            <>
              <ShieldAlert className="w-5 h-5 flex-shrink-0 stroke-[2]" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Human Approval Required</p>
                <p className="leading-relaxed">
                  Taking {incident.assetName} offline requires authorization from a {approver}.
                </p>
              </div>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5 flex-shrink-0 stroke-[2]" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Authorized & Approved</p>
                <p className="leading-relaxed">
                  Governance rules fulfilled. Action ready for dispatch.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Stacked Actions */}
      <div className="flex flex-col gap-2.5">
        {status === "awaiting_review" && (
          <button
            onClick={() => approveIncident(incidentId)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0EA5E9] hover:bg-[#0369A1] text-white font-semibold rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Approve Action
          </button>
        )}

        {status === "approved" && (
          <button
            onClick={() => createWorkOrder(incidentId)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Create Work Order
          </button>
        )}

        {status === "work_order_created" && (
          <div className="w-full py-2.5 text-center bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] font-semibold rounded-xl text-sm inline-flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 stroke-[2.5]" />
            Work Order Dispatched
          </div>
        )}

        {status === "closed" && (
          <div className="w-full py-2.5 text-center bg-slate-100 border border-slate-200 text-slate-500 font-semibold rounded-xl text-sm">
            Incident Resolved (Closed)
          </div>
        )}

        {status !== "closed" && status !== "work_order_created" && (
          <>
            <button
              onClick={() => {
                alert(`Escalation request sent for ${incidentId}. Engineer notified.`);
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#CBD5E1] text-[#334155] hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <AlertCircle className="w-4 h-4 text-[#64748B]" />
              Escalate to Engineer
            </button>

            <button
              onClick={() => setIsFalsePositiveModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              Mark as False Positive
            </button>
          </>
        )}
      </div>

      <hr className="border-[#E2E8F0]" />

      {/* Mini Audit Log */}
      <div>
        <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
          Governance Audit Trail
        </h4>
        {incidentAudits.length === 0 ? (
          <p className="text-xs text-[#64748B] italic">No audit trail recorded yet.</p>
        ) : (
          <div className="space-y-3 max-h-36 overflow-y-auto pr-1">
            {incidentAudits.map((audit) => (
              <div key={audit.id} className="text-xs border-l-2 border-[#CBD5E1] pl-3 py-0.5">
                <div className="flex items-center justify-between text-[#64748B] font-mono text-[10px] mb-1">
                  <span>{formatDateTime(audit.timestamp)}</span>
                  <span className="font-semibold">{audit.action.toUpperCase()}</span>
                </div>
                <p className="text-[#334155] leading-relaxed">
                  <span className="font-semibold text-[#0F172A]">{audit.actor}:</span>{" "}
                  {audit.reason || "Action performed"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-[#E2E8F0]" />

      {/* Observability Shortcuts */}
      <div className="flex flex-col gap-2 text-xs font-semibold text-[#0EA5E9]">
        <Link
          href={`/ai-workflow?incident=${incidentId}`}
          className="hover:underline inline-flex items-center gap-1"
        >
          View AI CrewAI Agent Trace →
        </Link>
        <Link
          href={`/observability?incident=${incidentId}`}
          className="hover:underline inline-flex items-center gap-1"
        >
          View TrueFoundry Gateway Trace →
        </Link>
      </div>

      {/* False Positive Modal */}
      {isFalsePositiveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl relative">
            <h3 className="text-base font-bold text-[#0F172A] mb-4">
              Mark as False Positive
            </h3>
            <form onSubmit={handleFalsePositiveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                  Justification / Feedback Reason
                </label>
                <textarea
                  required
                  rows={4}
                  value={falsePositiveReason}
                  onChange={(e) => setFalsePositiveReason(e.target.value)}
                  placeholder="Explain why this incident is false... e.g. sensor drift or scheduled test"
                  className="w-full text-sm border border-[#CBD5E1] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] text-[#0F172A]"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFalsePositiveModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 border border-[#CBD5E1] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  Confirm False Positive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
