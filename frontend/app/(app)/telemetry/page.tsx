"use client";

import React, { useState } from "react";
import { useScenario } from "../../../providers/ScenarioProvider";
import TelemetryChart from "../../../components/TelemetryChart";
import { Activity } from "lucide-react";

export default function TelemetryExplorerPage() {
  const { activeBundle } = useScenario();
  const telemetryList = activeBundle.telemetry;

  const [selectedMetric, setSelectedMetric] = useState<string>(
    telemetryList.length > 0 ? telemetryList[0].id : ""
  );

  const activeChart = telemetryList.find((t) => t.id === selectedMetric) || telemetryList[0];

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-[#0EA5E9]" />
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Telemetry Explorer</h2>
            <p className="text-xs text-[#64748B] font-semibold mt-0.5">Plot active measurements and safety limits across site channels</p>
          </div>
        </div>

        {telemetryList.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#64748B] uppercase tracking-wide">Select Stream:</span>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 font-semibold text-[#0F172A] focus:outline-none"
            >
              {telemetryList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.unit})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeChart ? (
        <div className="max-w-4xl mx-auto w-full">
          <TelemetryChart
            title={activeChart.title}
            metric={activeChart.metric}
            unit={activeChart.unit}
            threshold={activeChart.threshold}
            series={activeChart.series}
            comparisonSeries={activeChart.comparisonSeries}
          />
        </div>
      ) : (
        <div className="border border-dashed border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B] py-16 bg-[#F8FAFC]">
          No active telemetry channels matching selected scenario.
        </div>
      )}
    </div>
  );
}
