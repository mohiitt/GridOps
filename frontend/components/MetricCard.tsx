"use client";

import React from "react";

type MetricCardProps = {
  label: string;
  value: string;
  subtext?: string;
  trend?: string;
  status?: "critical" | "warning" | "success" | "neutral";
};

export default function MetricCard({ label, value, subtext, trend, status }: MetricCardProps) {
  const statusColors = {
    critical: "bg-red-500",
    warning: "bg-amber-500",
    success: "bg-emerald-500",
    neutral: "bg-slate-400",
  };

  return (
    <div className="relative bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden transition-all duration-200 hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
      {status && (
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusColors[status]}`} />
      )}
      <div className={`${status ? "pl-2.5" : ""}`}>
        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-2xl font-bold font-mono tabular-nums text-[#0F172A] leading-tight mb-1">
          {value}
        </h3>
        <div className="flex items-center justify-between mt-1 text-xs">
          {subtext && <span className="text-[#64748B]">{subtext}</span>}
          {trend && (
            <span
              className={`font-semibold ${
                trend.includes("↓") || trend.includes("-")
                  ? "text-emerald-600"
                  : trend.includes("↑") || trend.includes("+")
                  ? "text-amber-600"
                  : "text-[#64748B]"
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
