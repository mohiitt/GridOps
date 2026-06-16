"use client";

import React from "react";
import { Wrench, CheckCircle } from "lucide-react";
import { formatDateTime } from "../../../lib/format";

export default function MaintenanceLogsPage() {
  const records = [
    { id: "MR-INV042-0001", assetId: "INV-042", workOrderId: "WO-2025-00871", date: "2025-10-12T09:30:00Z", tech: "Daniel Reyes", issue: "Cooling Fan Irregularity", resolution: "Fan inspected and sensor recalibrated. Suggest replacing fan if temp spikes again.", status: "Completed" },
    { id: "MR-BESS011-0001", assetId: "BESS-011", workOrderId: "WO-2026-00122", date: "2026-02-20T10:00:00Z", tech: "Sarah Jenkins", issue: "BESS Cooling Loop", resolution: "Refilled cooling fluids, verified fan pressure threshold limits.", status: "Completed" },
    { id: "MR-BESS011-0002", assetId: "BESS-011", workOrderId: "WO-2026-00344", date: "2026-04-30T16:15:00Z", tech: "Daniel Reyes", issue: "Thermal Watch Warning", resolution: "Cell logs inspected. Heat levels normalized. Recommended runtime watches.", status: "Completed" },
    { id: "MR-INV001-0001", assetId: "INV-001", workOrderId: "WO-2024-00121", date: "2024-05-18T08:00:00Z", tech: "Maria Gonzalez", issue: "Routine Annual Calibration", resolution: "Cleaned cabinet vents and recalibrated DC voltage monitors.", status: "Completed" }
  ];

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Wrench className="w-5 h-5 text-[#0EA5E9]" />
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">CMMS Maintenance Records</h2>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">Historical maintenance work logs and technician diagnostics</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
              <th className="px-4 py-3">Record ID</th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Work Order ID</th>
              <th className="px-4 py-3">Technician</th>
              <th className="px-4 py-3">Issue Reported</th>
              <th className="px-4 py-3">Resolution Summary</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
            {records.map((rec) => (
              <tr key={rec.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3.5 font-mono font-bold text-[#0EA5E9]">{rec.id}</td>
                <td className="px-4 py-3.5 font-mono text-slate-700">{rec.assetId}</td>
                <td className="px-4 py-3.5 font-semibold text-[#334155]">{rec.workOrderId}</td>
                <td className="px-4 py-3.5 font-semibold text-[#0F172A]">{rec.tech}</td>
                <td className="px-4 py-3.5 font-semibold text-[#64748B]">{rec.issue}</td>
                <td className="px-4 py-3.5 leading-relaxed max-w-xs truncate">{rec.resolution}</td>
                <td className="px-4 py-3.5 font-semibold text-[#64748B]">{formatDateTime(rec.date)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] uppercase">
                    <CheckCircle className="w-3 h-3 stroke-[2.5]" />
                    {rec.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
