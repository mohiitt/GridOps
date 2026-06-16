"use client";

import React from "react";
import StatusBadge from "../../../components/StatusBadge";
import { Boxes, Zap } from "lucide-react";

export default function AssetsPage() {
  const assets = [
    { id: "INV-042", name: "Solar Inverter 042", type: "Solar Inverter", manufacturer: "SunGrid Power Systems", model: "SG-4000-XT", installDate: "2021-03-14", runtimeHours: 19450, capacity: "4.0 MW", status: "warning" },
    { id: "BESS-011", name: "BESS Unit 011", type: "BESS Unit", manufacturer: "NorthCell Storage", model: "NC-5000-LFP", installDate: "2022-07-19", runtimeHours: 28500, capacity: "5.0 MW", status: "critical" },
    { id: "TX-003", name: "Transformer 003", type: "Transformer", manufacturer: "GridCore Transformers", model: "GC-60MVA", installDate: "2020-05-11", runtimeHours: 42100, capacity: "60.0 MW", status: "healthy" },
    { id: "SUB-001", name: "Substation Breaker 001", type: "Substation Breaker", manufacturer: "PowerLink Mfg", model: "PL-500", installDate: "2019-11-03", runtimeHours: 51000, capacity: "500.0 MW", status: "healthy" },
    { id: "WX-001", name: "Weather Station 001", type: "Weather Station", manufacturer: "Vaisala", model: "AWS-310", installDate: "2021-02-28", runtimeHours: 18200, capacity: "N/A", status: "healthy" },
    { id: "INV-001", name: "Solar Inverter 001", type: "Solar Inverter", manufacturer: "SunGrid Power Systems", model: "SG-4000-XT", installDate: "2021-03-14", runtimeHours: 16200, capacity: "4.0 MW", status: "healthy" },
    { id: "BESS-001", name: "BESS Unit 001", type: "BESS Unit", manufacturer: "NorthCell Storage", model: "NC-5000-LFP", installDate: "2022-07-19", runtimeHours: 17400, capacity: "5.0 MW", status: "healthy" }
  ];

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Boxes className="w-5 h-5 text-[#0EA5E9]" />
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">Asset Inventory Catalog</h2>
          <p className="text-xs text-[#64748B] font-semibold mt-0.5">Desert Sun Solar + BESS — 500 MW Site Asset Ledger</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
              <th className="px-4 py-3">Asset ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Manufacturer / Model</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Runtime Hours</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3.5 font-mono font-bold text-[#0EA5E9]">{asset.id}</td>
                <td className="px-4 py-3.5 font-bold text-[#0F172A]">{asset.name}</td>
                <td className="px-4 py-3.5 font-semibold text-[#64748B]">{asset.type}</td>
                <td className="px-4 py-3.5 font-medium">{asset.manufacturer} ({asset.model})</td>
                <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{asset.capacity}</td>
                <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{asset.runtimeHours.toLocaleString()}h</td>
                <td className="px-4 py-3 text-right">
                  <StatusBadge severity={asset.status === "healthy" ? "low" : (asset.status === "warning" ? "high" : "critical")} label={asset.status.toUpperCase()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
