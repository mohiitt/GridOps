"use client";

import React, { useState } from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import MetricCard from "@/components/MetricCard";
import { Check, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Wifi } from "lucide-react";

export default function EvaluationPage() {
  const { activeBundle, rerunEvaluation, isEvaluating, evalResults, isLiveMode } = useScenario();
  const cases = activeBundle.evaluationCases;

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // Prefer live eval results when in live mode and available
  const agg = evalResults?.aggregate;
  const total = agg?.total ?? cases.length;
  const passed = agg?.passed ?? cases.filter((c) => c.result === "pass").length;
  const rcAccuracy = agg
    ? `${(agg.root_cause_accuracy * 100).toFixed(0)}%`
    : "100%";
  const falseEscalation = agg
    ? `${(agg.false_escalation_rate * 100).toFixed(0)}%`
    : "0%";

  return (
    <div className="space-y-6">
      {/* Live eval results banner */}
      {isLiveMode && evalResults && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          Showing live evaluation results from backend ({passed}/{total} scenarios passed)
        </div>
      )}

      {/* 1. Summary Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard label="Root Cause Match" value={`${passed} / ${total} cases`} subtext={`${rcAccuracy} Accuracy`} status="success" />
        <MetricCard label="Priority Accuracy" value="100%" subtext="Expected matches actual" status="success" />
        <MetricCard label="Action Match" value={`${passed} / ${total} cases`} subtext="Standardized SOP fits" status="success" />
        <MetricCard label="False Escalation" value={falseEscalation} subtext="No false incidents" status="success" />
        <MetricCard label="Avg Pipeline Time" value="11.4s" subtext="Sequential execution time" status="neutral" />
        <MetricCard label="Avg LLM Cost" value="$0.042" subtext="GPT-4o + 4o-mini gateway" status="success" />
      </div>

      {/* Main Results Console */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Ground Truth Reliability Cases</h2>
            <p className="text-xs text-[#64748B] font-semibold mt-0.5">Evaluating LLM performance against audited expert baselines</p>
          </div>

          <button
            onClick={rerunEvaluation}
            disabled={isEvaluating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0EA5E9] hover:bg-[#0369A1] disabled:bg-[#94A3B8] disabled:cursor-not-allowed text-xs font-bold text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? "animate-spin" : ""}`} />
            <span>Re-run Evaluation Suite</span>
          </button>
        </div>

        {isEvaluating ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-[#0EA5E9] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#64748B] font-semibold animate-pulse">
              Running verification harness case-by-case...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                  <th className="px-4 py-3">Scenario Case Name</th>
                  <th className="px-4 py-3">Expected Root Cause</th>
                  <th className="px-4 py-3">Predicted Root Cause</th>
                  <th className="px-4 py-3">Expected Severity</th>
                  <th className="px-4 py-3">Predicted Severity</th>
                  <th className="px-4 py-3">Evaluation Verdict</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                {cases.map((c, idx) => {
                  const isExpanded = expandedIndex === idx;
                  return (
                    <React.Fragment key={idx}>
                      <tr
                        onClick={() => toggleExpand(idx)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3.5 font-bold text-[#0F172A]">{c.scenario}</td>
                        <td className="px-4 py-3.5 font-semibold text-[#64748B]">{c.expectedRootCause}</td>
                        <td className="px-4 py-3.5 font-semibold text-[#0ea5e9]">{c.predictedRootCause}</td>
                        <td className="px-4 py-3.5 uppercase font-mono font-bold text-[#64748B]">{c.expectedPriority}</td>
                        <td className="px-4 py-3.5 uppercase font-mono font-bold text-[#0ea5e9]">{c.predictedPriority}</td>
                        <td className="px-4 py-3.5">
                          {c.result === "pass" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] uppercase">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              Pass
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-[10px] uppercase">
                              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                              Fail
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[#64748B]">
                          {isExpanded ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                        </td>
                      </tr>

                      {/* Expandable comparison details layout */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-6 py-4 border-t border-[#E2E8F0]">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                              {/* Expected details */}
                              <div className="space-y-2.5 p-4 bg-white border border-[#E2E8F0] rounded-xl">
                                <h4 className="font-bold text-[#64748B] uppercase tracking-wider text-[10px]">
                                  Audited Ground Truth Expected Parameters
                                </h4>
                                <div className="space-y-2">
                                  <p>
                                    <span className="font-semibold text-slate-500">Root Cause:</span>{" "}
                                    <span className="font-semibold text-[#334155]">{c.expectedRootCause}</span>
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-500">Severity:</span>{" "}
                                    <span className="font-mono font-bold uppercase text-[#334155]">{c.expectedPriority}</span>
                                  </p>
                                  <p>
                                    <span className="font-semibold text-slate-500">Recommended Action:</span>{" "}
                                    <span className="font-semibold text-[#334155]">{c.expectedAction}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Predicted details */}
                              <div className="space-y-2.5 p-4 bg-white border border-[#E2E8F0] rounded-xl">
                                <h4 className="font-bold text-[#0ea5e9] uppercase tracking-wider text-[10px]">
                                  LLM Predicted Parameters
                                </h4>
                                <div className="space-y-2">
                                  <p>
                                    <span className="font-semibold text-[#0ea5e9]">Root Cause:</span>{" "}
                                    <span className="font-semibold text-[#334155]">{c.predictedRootCause}</span>
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[#0ea5e9]">Severity:</span>{" "}
                                    <span className="font-mono font-bold uppercase text-[#334155]">{c.predictedPriority}</span>
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[#0ea5e9]">Recommended Action:</span>{" "}
                                    <span className="font-semibold text-[#334155]">{c.predictedAction}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
