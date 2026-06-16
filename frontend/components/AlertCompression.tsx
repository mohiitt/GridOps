"use client";

import React, { useEffect, useState } from "react";
import { useScenario } from "../providers/ScenarioProvider";
import StatusBadge from "./StatusBadge";
import { ArrowRight, Sparkles } from "lucide-react";

export default function AlertCompression() {
  const { activeBundle, isAnalyzing } = useScenario();
  const [animate, setAnimate] = useState(false);

  const incident = activeBundle.incidents[0];
  const alerts = activeBundle.alerts;

  useEffect(() => {
    // Retrigger animation whenever scenario changes or analysis runs
    setAnimate(false);
    const timer = setTimeout(() => {
      setAnimate(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [activeBundle.scenarioId, isAnalyzing]);

  if (activeBundle.scenarioId === "normal") {
    return (
      <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-2xl p-6 flex flex-col items-center justify-center text-center h-56">
        <Sparkles className="w-8 h-8 text-[#94A3B8] mb-3 stroke-[1.5]" />
        <h4 className="text-sm font-semibold text-[#334155] mb-1">Calm State</h4>
        <p className="text-xs text-[#64748B] max-w-sm">
          No critical telemetry alarms detected. Alert stream is quiet and operating within normal parameters.
        </p>
      </div>
    );
  }

  const compressionRatio = incident ? `${activeBundle.kpis.alertsCorrelated?.value || "12 → 1"}` : "Filtered";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          Alert Compression Engine
        </h3>
        <span className="text-xs font-mono font-semibold bg-[#EFF6FF] text-[#1D4ED8] px-2.5 py-0.5 rounded-full">
          Ratio: {compressionRatio}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Raw Alerts Column */}
        <div className="md:col-span-5 space-y-2 max-h-52 overflow-y-auto pr-1">
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
            SCADA Raw Alert Stream ({alerts.length} fires)
          </p>
          <div className="flex flex-col gap-1.5">
            {alerts.map((alert, idx) => (
              <div
                key={alert.id}
                style={{
                  transitionDelay: `${idx * 40}ms`,
                  transform: animate ? "translateX(0)" : "translateX(-20px)",
                  opacity: animate ? 1 : 0
                }}
                className={`transition-all duration-300 flex items-center justify-between p-2 rounded-lg border bg-slate-50 text-[11px] font-mono`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    alert.severity === "critical"
                      ? "bg-red-500"
                      : alert.severity === "high"
                      ? "bg-orange-500"
                      : alert.severity === "medium"
                      ? "bg-amber-500"
                      : "bg-blue-500"
                  }`} />
                  <span className="font-semibold truncate">{alert.alertType}</span>
                </div>
                <span className="text-[10px] text-[#64748B] ml-2 flex-shrink-0">
                  {alert.source}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Compression Animator Graphic */}
        <div className="md:col-span-2 flex flex-col items-center justify-center p-2">
          <div className="relative w-full flex items-center justify-center">
            {/* Animated dot indicator */}
            <div className={`absolute w-3 h-3 bg-[#0EA5E9] rounded-full filter blur-[1px] ${
              animate && !isAnalyzing ? "animate-ping-slow" : ""
            }`} />
            <div className="p-2.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE]">
              <ArrowRight className="w-5 h-5 text-[#0EA5E9]" />
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[#64748B] mt-2 text-center leading-tight">
            AI Clustering
          </span>
        </div>

        {/* Output Actionable Incident */}
        <div className="md:col-span-5 h-full flex flex-col justify-center">
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
            Actionable Incident Output
          </p>
          {incident ? (
            <div
              style={{
                transform: animate ? "scale(1)" : "scale(0.95)",
                opacity: animate ? 1 : 0
              }}
              className="transition-all duration-500 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-2.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge severity={incident.severity} />
                <span className="font-mono text-xs font-bold text-[#64748B]">{incident.id}</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#0F172A] leading-snug line-clamp-2">
                  {incident.title}
                </h4>
                <p className="text-[10px] text-[#64748B] font-semibold mt-1">
                  Asset: {incident.assetName}
                </p>
              </div>
              <div className="flex items-center justify-between text-[10px] font-medium pt-1.5 border-t border-[#E2E8F0]">
                <span className="text-[#64748B]">Confidence</span>
                <span className="font-bold font-mono text-[#0F172A]">
                  {(incident.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-[#E2E8F0] rounded-xl p-4 text-center text-xs text-[#64748B] py-8 bg-[#F8FAFC]">
              No incident generated.
            </div>
          )}
        </div>
      </div>
      
      {/* Keyframe additions in Tailwind */}
      <style jsx global>{`
        @keyframes pingSlow {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .animate-ping-slow {
          animation: pingSlow 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
