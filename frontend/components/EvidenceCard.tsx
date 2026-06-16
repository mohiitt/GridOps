"use client";

import React from "react";
import { Evidence } from "../types";
import { Wrench, FileText, CloudSun, Cpu, ClipboardList, LucideIcon } from "lucide-react";
import { formatDateTime } from "../lib/format";

type EvidenceCardProps = {
  evidence: Evidence;
};

const sourceInfo: Record<
  string,
  { label: string; icon: LucideIcon; colorClass: string }
> = {
  maintenance_history: {
    label: "Maintenance History",
    icon: Wrench,
    colorClass: "text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]",
  },
  manufacturer_bulletin: {
    label: "Manufacturer Bulletin",
    icon: FileText,
    colorClass: "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]",
  },
  weather_context: {
    label: "Weather Context",
    icon: CloudSun,
    colorClass: "text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]",
  },
  asset_spec: {
    label: "Asset Specification",
    icon: Cpu,
    colorClass: "text-purple-700 bg-purple-50 border-purple-200",
  },
  operating_procedure: {
    label: "Standard Procedure",
    icon: ClipboardList,
    colorClass: "text-slate-700 bg-slate-50 border-slate-200",
  },
};

export default function EvidenceCard({ evidence }: EvidenceCardProps) {
  const { sourceType, title, summary, relevanceScore, timestamp } = evidence;
  const source = sourceInfo[sourceType] || {
    label: "Information",
    icon: FileText,
    colorClass: "text-slate-700 bg-slate-50 border-slate-200",
  };
  const Icon = source.icon;

  const relevancePct = Math.round(relevanceScore * 100);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)] hover:border-[#CBD5E1] transition-all duration-200">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${source.colorClass}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{source.label}</span>
        </span>
        {timestamp && (
          <span className="text-xs text-[#64748B]">{formatDateTime(timestamp)}</span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-[#0F172A] mb-2">{title}</h4>
      <p className="text-xs text-[#334155] leading-relaxed mb-4">{summary}</p>
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-1.5">
          <span>Relevance Score</span>
          <span className="font-mono tabular-nums text-[#0F172A]">{relevancePct}%</span>
        </div>
        <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#0EA5E9] h-full rounded-full transition-all duration-500"
            style={{ width: `${relevancePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
