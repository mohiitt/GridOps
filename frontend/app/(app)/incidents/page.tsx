"use client";

import React, { useState } from "react";
import { useScenario } from "@/providers/ScenarioProvider";
import StatusBadge from "@/components/StatusBadge";
import { Search, Eye, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDateTime, formatEnergy } from "@/lib/format";

export default function IncidentsDatabasePage() {
  const router = useRouter();
  const { incidents } = useScenario();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.assetName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || inc.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new":
        return "New Trigger";
      case "analyzing":
        return "Analyzing";
      case "awaiting_review":
        return "Awaiting Approval";
      case "approved":
        return "Approved";
      case "work_order_created":
        return "Work Order Created";
      case "closed":
        return "Closed";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, asset, or title..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent text-[#0F172A]"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <Filter className="w-3.5 h-3.5" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 font-semibold text-[#0F172A]"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Only</option>
                <option value="high">High Only</option>
                <option value="medium">Medium Only</option>
                <option value="low">Low Only</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 font-semibold text-[#0F172A]"
              >
                <option value="all">All Statuses</option>
                <option value="awaiting_review">Awaiting Approval</option>
                <option value="approved">Approved</option>
                <option value="work_order_created">Work Order Created</option>
                <option value="closed">Closed (FP)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Incident Database Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            Incident Triage History Database
          </h2>
          <span className="text-xs text-[#64748B] font-mono">
            Showing {filteredIncidents.length} of {incidents.length} logs
          </span>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B] py-16 bg-[#F8FAFC]">
            No records matched your search query. Try clearing filters.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                  <th className="px-4 py-3">Incident ID</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Brief Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Energy Impact</th>
                  <th className="px-4 py-3">Detection Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredIncidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => router.push(`/incidents/${inc.id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-[#0EA5E9] whitespace-nowrap">
                      {inc.id}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#0F172A] whitespace-nowrap">
                      {inc.assetName}
                    </td>
                    <td className="px-4 py-3.5 text-[#334155] font-semibold max-w-sm truncate">
                      {inc.title}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        inc.status === "awaiting_review"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : inc.status === "approved"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : inc.status === "work_order_created"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>
                        {getStatusLabel(inc.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-red-600 whitespace-nowrap">
                      {formatEnergy(inc.energyImpactMWhPerDay)}
                    </td>
                    <td className="px-4 py-3.5 text-[#64748B] font-semibold whitespace-nowrap">
                      {formatDateTime(inc.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/incidents/${inc.id}`);
                        }}
                        className="p-1 text-[#64748B] hover:text-[#0EA5E9] transition-colors rounded hover:bg-slate-100"
                      >
                        <Eye className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
