"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useScenario } from "@/providers/ScenarioProvider";
import {
  LayoutDashboard,
  AlertTriangle,
  Boxes,
  Activity,
  Wrench,
  Workflow,
  Gauge,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Clock,
  MapPin,
  Flame,
  LayoutGrid
} from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    currentScenarioId,
    switchScenario,
    runAIAnalysis,
    isAnalyzing,
    analysisStep,
    agentTraces
  } = useScenario();

  const navItems = [
    { label: "Command Center", icon: LayoutDashboard, href: "/command-center" },
    { label: "Incidents", icon: AlertTriangle, href: "/incidents" },
    { label: "Assets", icon: Boxes, href: "/assets" },
    { label: "Telemetry", icon: Activity, href: "/telemetry" },
    { label: "Maintenance", icon: Wrench, href: "/maintenance" },
    { label: "AI Workflow", icon: Workflow, href: "/ai-workflow" },
    { label: "Observability", icon: Gauge, href: "/observability" },
    { label: "Governance", icon: ShieldCheck, href: "/governance" },
    { label: "Evaluation", icon: CheckCircle2, href: "/evaluation" }
  ];

  // Map route path to human readable page title
  const getPageTitle = () => {
    if (pathname.includes("/command-center")) return "Command Center";
    if (pathname.includes("/incidents/")) return "Incident Detail";
    if (pathname.includes("/incidents")) return "Incidents Database";
    if (pathname.includes("/assets")) return "Asset Inventory";
    if (pathname.includes("/telemetry")) return "Telemetry Explorer";
    if (pathname.includes("/maintenance")) return "Maintenance Log";
    if (pathname.includes("/ai-workflow")) return "CrewAI Workflow Trace";
    if (pathname.includes("/observability")) return "TrueFoundry Observability";
    if (pathname.includes("/governance")) return "Governance & Audit";
    if (pathname.includes("/evaluation")) return "Reliability Evaluation";
    return "Operations Dashboard";
  };

  const getRunningAgentName = () => {
    if (analysisStep >= 0 && agentTraces[analysisStep]) {
      return agentTraces[analysisStep].agentName;
    }
    return "Agent Pipeline Running...";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* 5.1 Left Sidebar */}
      <aside className="w-60 border-r border-[#E2E8F0] bg-white flex flex-col flex-shrink-0">
        {/* Brand Lockup */}
        <div className="h-16 border-b border-[#E2E8F0] flex items-center px-6 gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#0EA5E9]/10 text-[#0369A1]">
            <Flame className="w-5 h-5 fill-[#0EA5E9] stroke-[#0EA5E9]" />
          </div>
          <span className="font-bold text-[#0F172A] tracking-tight text-sm uppercase">
            GridOps Copilot
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all relative ${
                  isActive
                    ? "bg-[#F1F5F9] text-[#0369A1]"
                    : "text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 rounded bg-[#0EA5E9]" />
                )}
                <Icon className={`w-4 h-4 ${isActive ? "text-[#0EA5E9]" : "text-[#94A3B8]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              GridOps AI Online
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] font-medium mt-1">
            Desert Sun Facility
          </p>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 5.2 Top Header */}
        <header className="h-16 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30 shadow-sm">
          {/* Page Title & Facility Info */}
          <div className="flex items-center gap-6">
            <h1 className="text-base font-bold text-[#0F172A] tracking-tight">
              {getPageTitle()}
            </h1>
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-[#334155] font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Desert Sun Solar + BESS (500 MW)</span>
            </div>
          </div>

          {/* Action Selectors and Trigger */}
          <div className="flex items-center gap-3">
            {/* Scenario Selector Segmented Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider hidden lg:inline">
                Scenario:
              </span>
              <select
                value={currentScenarioId}
                onChange={(e) => switchScenario(e.target.value as any)}
                disabled={isAnalyzing}
                className="text-xs font-semibold bg-white border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
              >
                <option value="normal">Normal Operation</option>
                <option value="inverter_cooling">Inverter Cooling Degradation</option>
                <option value="bess_thermal">BESS Thermal Risk</option>
                <option value="weather_fp">Weather False Positive</option>
              </select>
            </div>

            {/* Time range selector */}
            <div className="hidden sm:flex items-center gap-1 bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-[#64748B]">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold text-[#0F172A]">Last 6 Hours</span>
            </div>

            {/* AI Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-slate-50 text-[10px] font-mono" aria-live="polite">
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
                  <span className="text-amber-600 font-bold">ANALYZING...</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[#334155] font-semibold">AI IDLE</span>
                </>
              )}
            </div>

            {/* Run AI Analysis trigger */}
            <button
              onClick={runAIAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0EA5E9] text-white hover:bg-[#0369A1] disabled:bg-[#94A3B8] disabled:cursor-not-allowed text-xs font-bold rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run AI</span>
            </button>
          </div>
        </header>

        {/* Analyzing Overlay Status Bar */}
        {isAnalyzing && (
          <div className="bg-amber-500 text-white text-xs font-semibold py-2 px-6 flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>AI Orchestration active: </span>
            <span className="font-mono bg-amber-600 px-2 py-0.5 rounded text-[11px] font-bold">
              {getRunningAgentName()}
            </span>
          </div>
        )}

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
