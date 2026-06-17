"use client";

/**
 * LiveEventFeed — real-time SSE ticker for the Command Center.
 *
 * Live mode:   subscribes to GET /events/stream on the ingestion service.
 *              Shows each event as it arrives with colour-coded type badges.
 * Fixture mode: renders a static placeholder (no connection attempt).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Play, Square, Wifi, WifiOff, Radio } from "lucide-react";

const USE_LIVE_API = process.env.NEXT_PUBLIC_USE_LIVE_API === "true";
const INGESTION_URL =
  process.env.NEXT_PUBLIC_INGESTION_API_URL ?? "http://localhost:8002";

// ── Live stream control helpers ────────────────────────────────────────────────

async function apiStartStream(speed = 20, phase1Mins = 2): Promise<{ pid?: number }> {
  const res = await fetch(
    `${INGESTION_URL}/live-stream/start?speed=${speed}&phase1_real_mins=${phase1Mins}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
  );
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return res.json();
}

async function apiStopStream(): Promise<void> {
  await fetch(`${INGESTION_URL}/live-stream/stop`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).catch(() => {});
}

async function apiStreamStatus(): Promise<string> {
  try {
    const res = await fetch(`${INGESTION_URL}/live-stream/status`);
    const data = await res.json();
    return data.status ?? "unknown";
  } catch {
    return "unknown";
  }
}

const MAX_EVENTS = 60;

// ── Types ──────────────────────────────────────────────────────────────────────

type EventType = "telemetry" | "alert" | "weather" | "forecast" | "maintenance" | string;

interface LiveEvent {
  id: string;
  type: EventType;
  asset: string;
  ts: string;        // sim timestamp ISO
  wall_ms: number;   // real epoch ms (for ordering)
  // type-specific fields
  temp?: number | null;
  power?: number | null;
  fan?: number | null;
  severity?: string;
  alert_type?: string;
  msg?: string;
  irr?: number | null;
  amb?: number | null;
  expected_mw?: number | null;
  candidate_id?: string;
}

// ── Badge styling ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  telemetry:   "bg-sky-50 border-sky-200 text-sky-700",
  alert:       "bg-red-50 border-red-300 text-red-700",
  weather:     "bg-slate-100 border-slate-300 text-slate-600",
  forecast:    "bg-violet-50 border-violet-200 text-violet-700",
  maintenance: "bg-amber-50 border-amber-200 text-amber-700",
};

const SEV_STYLES: Record<string, string> = {
  high:     "bg-red-100 text-red-700 border-red-300",
  medium:   "bg-amber-100 text-amber-700 border-amber-300",
  critical: "bg-red-200 text-red-800 border-red-400",
  low:      "bg-sky-100 text-sky-700 border-sky-200",
};

function typeStyle(type: EventType): string {
  return TYPE_STYLES[type] ?? "bg-slate-50 border-slate-200 text-slate-500";
}

function formatSimTs(iso: string): string {
  // Show only HH:MM:SS from the ISO timestamp
  const t = iso.slice(11, 19);
  return t || iso.slice(0, 8);
}

function formatMetric(event: LiveEvent): string {
  switch (event.type) {
    case "telemetry":
      return [
        event.temp != null ? `T=${event.temp}°C` : null,
        event.power != null ? `${event.power} MW` : null,
        event.fan != null ? `fan=${event.fan}rpm` : null,
      ]
        .filter(Boolean)
        .join("  ");

    case "alert":
      return event.alert_type?.replace(/_/g, " ") ?? event.msg ?? "";

    case "weather":
      return [
        event.irr != null ? `☀ ${event.irr} W/m²` : null,
        event.amb != null ? `${event.amb}°C` : null,
      ]
        .filter(Boolean)
        .join("  ");

    case "forecast":
      return event.expected_mw != null ? `forecast ${event.expected_mw} MW` : "";

    default:
      return "";
  }
}

// ── Fixture placeholder events ────────────────────────────────────────────────

const FIXTURE_EVENTS: LiveEvent[] = [
  { id: "f1", type: "telemetry",  asset: "INV-042", ts: "2026-06-16T13:00:00Z", wall_ms: 0, temp: 59.3, power: 2.82, fan: 1793 },
  { id: "f2", type: "weather",    asset: "WX-001",  ts: "2026-06-16T13:00:00Z", wall_ms: 1, irr: 908.4, amb: 33.8 },
  { id: "f3", type: "forecast",   asset: "INV-042", ts: "2026-06-16T13:00:00Z", wall_ms: 2, expected_mw: 2.89 },
  { id: "f4", type: "telemetry",  asset: "INV-042", ts: "2026-06-16T13:05:00Z", wall_ms: 3, temp: 59.8, power: 2.80, fan: 1787 },
  { id: "f5", type: "telemetry",  asset: "INV-042", ts: "2026-06-16T13:10:00Z", wall_ms: 4, temp: 60.2, power: 2.78, fan: 1776 },
  { id: "f6", type: "telemetry",  asset: "INV-042", ts: "2026-06-16T13:15:00Z", wall_ms: 5, temp: 62.1, power: 2.75, fan: 1742 },
  { id: "f7", type: "alert",      asset: "INV-042", ts: "2026-06-16T14:35:00Z", wall_ms: 6, severity: "medium", alert_type: "inverter_temperature_high", msg: "Temperature 75.4°C exceeds 75°C threshold" },
  { id: "f8", type: "alert",      asset: "INV-042", ts: "2026-06-16T15:10:00Z", wall_ms: 7, severity: "high",   alert_type: "cooling_fan_failure",       msg: "Cooling fan 1083 RPM below minimum" },
];

// ── Component ──────────────────────────────────────────────────────────────────

type ConnectionStatus = "idle" | "connecting" | "live" | "error";

export default function LiveEventFeed() {
  const [events, setEvents] = useState<LiveEvent[]>(
    USE_LIVE_API ? [] : FIXTURE_EVENTS,
  );
  const [status, setStatus] = useState<ConnectionStatus>(
    USE_LIVE_API ? "idle" : "idle",
  );
  const [totalReceived, setTotalReceived] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamLabel, setStreamLabel] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start live stream: call backend and then poll its status
  const handleStart = useCallback(async () => {
    setStreamLabel("Starting…");
    setIsStreaming(true);
    setEvents([]);
    try {
      await apiStartStream(20, 0.25); // phase1 = 15 seconds, then degrades; auto-stops at 70s
      setStreamLabel("Streaming ⚡ — degradation in ~15s");
      // Poll stream status every 5s to detect when it stops
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const st = await apiStreamStatus();
        if (st !== "running") {
          setIsStreaming(false);
          setStreamLabel(null);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5_000);
    } catch (err) {
      console.error("startLiveStream failed:", err);
      setStreamLabel("Failed — is the backend running?");
      setIsStreaming(false);
      setTimeout(() => setStreamLabel(null), 4_000);
    }
  }, []);

  const handleStop = useCallback(async () => {
    await apiStopStream();
    setIsStreaming(false);
    setStreamLabel(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // Sync streaming state on mount
  useEffect(() => {
    if (!USE_LIVE_API) return;
    apiStreamStatus().then((st) => {
      if (st === "running") {
        setIsStreaming(true);
        setStreamLabel("Streaming ⚡");
      }
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-start SSE in live mode
  useEffect(() => {
    if (!USE_LIVE_API) return;

    setStatus("connecting");
    const es = new EventSource(`${INGESTION_URL}/events/stream`);

    es.onopen = () => setStatus("live");

    es.onmessage = (e) => {
      try {
        const event: LiveEvent = JSON.parse(e.data);
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        setTotalReceived((n) => n + 1);
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      setStatus("error");
      es.close();
      // Retry after 5s
      setTimeout(() => {
        setStatus("idle");
      }, 5000);
    };

    return () => {
      es.close();
      setStatus("idle");
    };
  }, []);

  // Auto-scroll to top (newest events appear at top)
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events]);

  // ── Status dot ───────────────────────────────────────────────────────────────

  const statusDot =
    status === "live" ? (
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-emerald-600 font-bold">LIVE</span>
        <span className="text-slate-400 font-normal">· {totalReceived} events</span>
      </span>
    ) : status === "connecting" ? (
      <span className="flex items-center gap-1.5 text-amber-500">
        <Radio className="w-3 h-3 animate-pulse" />
        <span className="font-bold">CONNECTING…</span>
      </span>
    ) : status === "error" ? (
      <span className="flex items-center gap-1.5 text-red-500">
        <WifiOff className="w-3 h-3" />
        <span className="font-bold">DISCONNECTED · retrying…</span>
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-slate-400">
        <WifiOff className="w-3 h-3" />
        <span className="font-semibold">
          {USE_LIVE_API ? "Idle" : "Fixture Data"}
        </span>
      </span>
    );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0EA5E9]" />
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wide">
            Live Event Stream
          </span>
          {!USE_LIVE_API && (
            <span className="text-[10px] font-semibold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-md">
              FIXTURE
            </span>
          )}
          {/* Stream status label */}
          {streamLabel && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md animate-pulse">
              {streamLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono">{statusDot}</div>
          {/* Start / Stop button — live mode only */}
          {USE_LIVE_API && (
            isStreaming ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors"
              >
                <Play className="w-3 h-3 fill-white" />
                Start Live Stream
              </button>
            )
          )}
        </div>
      </div>

      {/* Event list */}
      <div
        ref={listRef}
        className="h-44 overflow-y-auto divide-y divide-[#F1F5F9] scroll-smooth"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-xs text-slate-400 font-semibold">
            {status === "connecting" || isStreaming ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                Waiting for events…
              </div>
            ) : USE_LIVE_API ? (
              <>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  Click <strong className="text-emerald-600">Start Live Stream</strong> to begin
                </div>
                <div className="text-[10px] text-slate-300 font-normal">
                  INV-042 starts normal → degrades after 15s → auto-stops after 70s
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Fixture data — enable live mode to stream real events
              </div>
            )}
          </div>
        ) : (
          events.map((event) => {
            const isAlert = event.type === "alert";
            const sevStyle =
              isAlert && event.severity ? SEV_STYLES[event.severity] : null;

            return (
              <div
                key={`${event.id}-${event.wall_ms}`}
                className={`flex items-center gap-3 px-4 py-2 text-xs transition-colors ${
                  isAlert && event.severity === "high"
                    ? "bg-red-50/40"
                    : isAlert && event.severity === "critical"
                    ? "bg-red-100/60"
                    : "hover:bg-slate-50/60"
                }`}
              >
                {/* Sim timestamp */}
                <span className="font-mono text-[10px] text-slate-400 flex-shrink-0 w-12">
                  {formatSimTs(event.ts)}
                </span>

                {/* Event type badge */}
                <span
                  className={`flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${typeStyle(event.type)}`}
                >
                  {event.type.slice(0, 4)}
                </span>

                {/* Asset */}
                <span className="font-mono font-bold text-[#0F172A] flex-shrink-0 w-16 text-[10px]">
                  {event.asset}
                </span>

                {/* Severity badge for alerts */}
                {isAlert && sevStyle && (
                  <span
                    className={`flex-shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${sevStyle}`}
                  >
                    {event.severity}
                  </span>
                )}

                {/* Metric value */}
                <span className="text-[#334155] font-medium truncate flex-1">
                  {formatMetric(event)}
                </span>

                {/* Candidate indicator */}
                {event.candidate_id && (
                  <span className="flex-shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    ⚡ CANDIDATE
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {USE_LIVE_API && events.length > 0 && (
        <div className="px-4 py-2 border-t border-[#F1F5F9] bg-slate-50 flex items-center gap-4 text-[10px] text-slate-500 font-semibold">
          <span>
            Alerts:{" "}
            <span className="text-red-600">
              {events.filter((e) => e.type === "alert").length}
            </span>
          </span>
          <span>
            Telemetry:{" "}
            <span className="text-sky-600">
              {events.filter((e) => e.type === "telemetry").length}
            </span>
          </span>
          <span className="ml-auto font-mono">
            showing {events.length} / {totalReceived} total
          </span>
        </div>
      )}
    </div>
  );
}
