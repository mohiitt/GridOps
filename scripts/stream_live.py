"""
stream_live.py — Continuous live event generator for GridOps demo.

Generates physics-based sensor events in real time using NumPy.
No pre-recorded JSONL — data is created fresh every run.

Story arc (fully automatic):
  Phase 1  NORMAL     →  INV-042 runs healthy (temp 58-62°C, efficiency 97.5%)
  Phase 2  DEGRADING  →  Cooling fan fault begins, temperature climbs
  Phase 3  CRITICAL   →  Temp >75°C alerts fire, candidate emitted, crew analysis starts

Usage:
    python scripts/stream_live.py
    python scripts/stream_live.py --phase1-real-mins 1 --speed 30
    python scripts/stream_live.py --ingestion-url http://localhost:8002

Key parameters:
  --speed              Sim minutes per real second (default 20; 1s real = 20 min sim)
  --phase1-real-mins   Real minutes in normal phase before degradation starts (default 2)
  --sim-interval       Sim minutes between telemetry points (default 5)
  --ingestion-url      Ingestion service URL
  --seed               RNG seed (default 42)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import requests

# ── Asset constants ────────────────────────────────────────────────────────────

ASSET_ID = "INV-042"
SITE_ID = "SITE-DS-001"
WX_ASSET_ID = "WX-001"
CAPACITY_MW = 3.0
NOMINAL_IRRADIANCE = 910.0  # W/m²

# Anchor time matches plan §0
ANCHOR_DT = datetime(2026, 6, 16, 13, 0, 0, tzinfo=timezone.utc)

# Alert thresholds (same as scoring.py rule table)
THRESH_TEMP_MEDIUM = 75.0   # R1
THRESH_TEMP_HIGH = 85.0     # R2
THRESH_FAN_FAIL_RPM = 1200  # R3 (fan < 1200 AND temp > 80)
THRESH_FAN_TEMP = 80.0
THRESH_EFF_LOW = 96.0       # R4


# ── Live state machine ─────────────────────────────────────────────────────────

class LiveState:
    def __init__(self, seed: int = 42, sim_interval_mins: int = 5) -> None:
        self.rng: np.random.Generator = np.random.default_rng(seed)
        self.step: int = 0
        self.phase: str = "normal"        # normal | degrading | critical
        self.cooling_eff: float = 1.0     # 1.0 = healthy, 0.0 = failed
        self.derate_state: str = "ok"     # ok | derated
        self.alerts_sent: set[str] = set()
        self.sim_interval_mins: int = sim_interval_mins

    @property
    def sim_dt(self) -> datetime:
        return ANCHOR_DT + timedelta(minutes=self.step * self.sim_interval_mins)

    @property
    def timestamp(self) -> str:
        return self.sim_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    @property
    def hours_elapsed(self) -> float:
        return self.step * self.sim_interval_mins / 60.0


# ── Physics engine ─────────────────────────────────────────────────────────────

def _irradiance(state: LiveState) -> float:
    """Diurnal irradiance: peaks at simulation start (13:00 local = solar noon)."""
    h = state.hours_elapsed
    raw = NOMINAL_IRRADIANCE * max(0.0, float(np.cos(np.pi * h / 6.0)))
    return float(np.clip(raw + state.rng.normal(0, 18), 0, 1100))


def _ambient(state: LiveState) -> float:
    """Desert afternoon ambient temperature, slowly declining."""
    h = state.hours_elapsed
    return float(34.0 + 2.0 * np.cos(np.pi * h / 8.0) + state.rng.normal(0, 0.5))


def compute_telemetry(state: LiveState) -> dict[str, Any]:
    """Generate one telemetry point for INV-042 based on current degradation state."""
    irr = _irradiance(state)
    amb = _ambient(state)

    # Temperature: base + degradation heat + noise
    base_temp = 58.0 + (amb - 32.0) * 0.15           # ambient contribution
    temp_rise = (1.0 - state.cooling_eff) * 35.0      # degradation heat
    temp = base_temp + temp_rise + state.rng.normal(0, 0.4)

    # Fan RPM drops with cooling_eff
    fan_rpm = 1800.0 * state.cooling_eff + state.rng.normal(0, 40)

    # Efficiency drops at high temp
    eff = 97.5 - max(0.0, (temp - 70.0) * 0.25) + state.rng.normal(0, 0.15)

    # AC power (irradiance-adjusted, derated if state says so)
    derate_factor = 0.80 if state.derate_state == "derated" else 0.97
    irr_ratio = irr / NOMINAL_IRRADIANCE
    ac_power = CAPACITY_MW * irr_ratio * derate_factor + state.rng.normal(0, 0.04)

    # Enter derated state once efficiency drops below threshold
    if eff < 96.0 and state.derate_state == "ok":
        state.derate_state = "derated"

    return {
        "inverter_temperature_c": round(float(temp), 1),
        "ac_power_output_mw": round(float(max(0.0, ac_power)), 3),
        "dc_input_voltage_v": round(float(750.0 + state.rng.normal(0, 4)), 1),
        "efficiency_pct": round(float(np.clip(eff, 82.0, 99.9)), 2),
        "cooling_fan_rpm": round(float(max(0.0, fan_rpm))),
        "ambient_temp_c": round(float(amb), 1),
        "irradiance_w_m2": round(float(irr), 1),
        "operating_state": state.derate_state,
    }


def compute_weather(state: LiveState) -> dict[str, Any]:
    irr = _irradiance(state)
    amb = _ambient(state)
    return {
        "irradiance_w_m2": round(float(irr), 1),
        "ambient_temp_c": round(float(amb), 1),
        "wind_speed_ms": round(float(max(0, 3.5 + state.rng.normal(0, 0.8))), 1),
        "cloud_cover_pct": round(float(np.clip(state.rng.normal(5, 3), 0, 100)), 1),
        "humidity_pct": round(float(np.clip(state.rng.normal(20, 3), 0, 100)), 1),
    }


def compute_forecast(state: LiveState) -> dict[str, Any]:
    irr = _irradiance(state)
    expected = round(float(CAPACITY_MW * (irr / NOMINAL_IRRADIANCE) * 0.97), 3)
    return {
        "expected_output_mw": expected,
        "confidence_pct": 92.0,
        "irradiance_forecast_w_m2": round(float(irr), 1),
        "forecast_horizon_h": 6,
    }


# ── Alert derivation ───────────────────────────────────────────────────────────

def derive_alerts(state: LiveState, tel: dict[str, Any]) -> list[dict[str, Any]]:
    """Check thresholds and emit alerts (each alert type fires only once)."""
    alerts: list[dict[str, Any]] = []
    temp = tel["inverter_temperature_c"]
    fan = tel["cooling_fan_rpm"]
    eff = tel["efficiency_pct"]

    def _make(alert_type: str, severity: str, message: str, threshold: float, observed: float) -> dict:
        return {
            "alert_id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "triggered_by": "rule_engine",
            "threshold_value": threshold,
            "observed_value": round(observed, 2),
        }

    if temp > THRESH_TEMP_MEDIUM and "temp_medium" not in state.alerts_sent:
        state.alerts_sent.add("temp_medium")
        alerts.append(_make(
            "inverter_temperature_high", "medium",
            f"INV-042 temperature {temp:.1f}°C exceeds 75°C threshold",
            THRESH_TEMP_MEDIUM, temp,
        ))

    if temp > THRESH_TEMP_HIGH and "temp_high" not in state.alerts_sent:
        state.alerts_sent.add("temp_high")
        alerts.append(_make(
            "inverter_temperature_high", "high",
            f"CRITICAL: INV-042 temperature {temp:.1f}°C exceeds 85°C limit",
            THRESH_TEMP_HIGH, temp,
        ))

    if fan < THRESH_FAN_FAIL_RPM and temp > THRESH_FAN_TEMP and "fan_fail" not in state.alerts_sent:
        state.alerts_sent.add("fan_fail")
        alerts.append(_make(
            "cooling_fan_failure", "high",
            f"INV-042 cooling fan {int(fan)} RPM — well below 1200 RPM minimum",
            THRESH_FAN_FAIL_RPM, fan,
        ))

    if eff < THRESH_EFF_LOW and "eff_low" not in state.alerts_sent:
        state.alerts_sent.add("eff_low")
        alerts.append(_make(
            "performance_degradation", "medium",
            f"INV-042 efficiency {eff:.1f}% below 96% operational threshold",
            THRESH_EFF_LOW, eff,
        ))

    return alerts


# ── Envelope builders ──────────────────────────────────────────────────────────

def _eid() -> str:
    return f"EVT-{uuid.uuid4().hex[:12].upper()}"


def make_telemetry_envelope(state: LiveState, tel: dict) -> dict:
    eid = _eid()
    return {
        "event_id": eid,
        "event_type": "telemetry",
        "source_system": "SCADA",
        "asset_id": ASSET_ID,
        "site_id": SITE_ID,
        "timestamp": state.timestamp,
        "correlation_id": eid,
        "schema_version": "1.0",
        "payload": tel,
    }


def make_alert_envelope(state: LiveState, alert: dict) -> dict:
    eid = _eid()
    return {
        "event_id": eid,
        "event_type": "alert",
        "source_system": "SCADA",
        "asset_id": ASSET_ID,
        "site_id": SITE_ID,
        "timestamp": state.timestamp,
        "correlation_id": eid,
        "schema_version": "1.0",
        "payload": {**alert, "asset_id": ASSET_ID, "site_id": SITE_ID},
    }


def make_weather_envelope(state: LiveState, wx: dict) -> dict:
    eid = _eid()
    return {
        "event_id": eid,
        "event_type": "weather",
        "source_system": "WeatherAPI",
        "asset_id": WX_ASSET_ID,
        "site_id": SITE_ID,
        "timestamp": state.timestamp,
        "correlation_id": eid,
        "schema_version": "1.0",
        "payload": wx,
    }


def make_forecast_envelope(state: LiveState, fc: dict) -> dict:
    eid = _eid()
    return {
        "event_id": eid,
        "event_type": "forecast",
        "source_system": "ForecastEngine",
        "asset_id": ASSET_ID,
        "site_id": SITE_ID,
        "timestamp": state.timestamp,
        "correlation_id": eid,
        "schema_version": "1.0",
        "payload": fc,
    }


# ── Step generator ─────────────────────────────────────────────────────────────

def generate_step_events(state: LiveState) -> list[dict]:
    """Generate all events for one time step."""
    events: list[dict] = []

    tel = compute_telemetry(state)
    events.append(make_telemetry_envelope(state, tel))

    # Weather every 3 steps (15 sim-minutes)
    if state.step % 3 == 0:
        wx = compute_weather(state)
        events.append(make_weather_envelope(state, wx))

    # Forecast every 6 steps (30 sim-minutes)
    if state.step % 6 == 0:
        fc = compute_forecast(state)
        events.append(make_forecast_envelope(state, fc))

    # Alerts (threshold-checked, each fires once)
    for alert in derive_alerts(state, tel):
        events.append(make_alert_envelope(state, alert))

    return events


# ── Pretty print ───────────────────────────────────────────────────────────────

TYPE_COLORS = {
    "telemetry":  "\033[34m",   # blue
    "alert":      "\033[31m",   # red
    "weather":    "\033[90m",   # gray
    "forecast":   "\033[35m",   # purple
}
RESET = "\033[0m"
BOLD = "\033[1m"


def print_event(event: dict, phase: str) -> None:
    etype = event["event_type"]
    color = TYPE_COLORS.get(etype, "")
    payload = event.get("payload", {})
    ts_short = event["timestamp"][11:16]  # HH:MM

    if etype == "telemetry":
        temp = payload.get("inverter_temperature_c", "?")
        fan = payload.get("cooling_fan_rpm", "?")
        eff = payload.get("efficiency_pct", "?")
        pwr = payload.get("ac_power_output_mw", "?")
        flag = " 🔥" if (isinstance(temp, float) and temp > 75) else ""
        line = f"  {temp:.1f}°C  fan={int(fan)} RPM  eff={eff:.1f}%  pwr={pwr:.2f} MW{flag}"
    elif etype == "alert":
        sev = payload.get("severity", "?").upper()
        atype = payload.get("alert_type", "?")
        line = f"  [{sev}] {atype}"
    elif etype == "weather":
        irr = payload.get("irradiance_w_m2", "?")
        line = f"  irr={irr} W/m²"
    elif etype == "forecast":
        exp = payload.get("expected_output_mw", "?")
        line = f"  expected={exp} MW"
    else:
        line = ""

    phase_tag = f"[{phase.upper():8s}]"
    print(f"{color}{ts_short} {phase_tag} {etype:10s} {ASSET_ID}{line}{RESET}")


# ── Main loop ──────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="GridOps live event generator — runs until Ctrl-C",
    )
    parser.add_argument(
        "--speed", type=float, default=20.0,
        help="Sim-minutes per real second (default 20; 1s real = 20 min sim)",
    )
    parser.add_argument(
        "--phase1-real-mins", type=float, default=2.0,
        help="Real minutes of normal operation before degradation starts (default 2)",
    )
    parser.add_argument(
        "--sim-interval", type=int, default=5,
        help="Sim minutes between telemetry points (default 5)",
    )
    parser.add_argument(
        "--ingestion-url", default="http://localhost:8002",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print events without sending to ingestion service",
    )
    parser.add_argument(
        "--max-runtime-secs", type=float, default=0,
        help="Auto-stop after this many real seconds (0 = run forever)",
    )
    args = parser.parse_args()

    real_interval_s = args.sim_interval / args.speed
    phase1_steps = max(1, int((args.phase1_real_mins * 60) / real_interval_s))

    state = LiveState(seed=args.seed, sim_interval_mins=args.sim_interval)

    print(f"\n{BOLD}GridOps Live Event Generator{RESET}")
    print(f"  Speed:         {args.speed}x ({args.sim_interval} sim-min = {real_interval_s:.2f}s real)")
    print(f"  Phase 1:       {args.phase1_real_mins} real-min of normal operation ({phase1_steps} steps)")
    print(f"  Sink:          {'[DRY RUN]' if args.dry_run else args.ingestion_url}")
    print(f"  Press Ctrl-C to stop\n")

    session = requests.Session() if not args.dry_run else None

    # Register scenario context with ingestion service
    if not args.dry_run:
        try:
            session.post(
                f"{args.ingestion_url}/set_context",
                json={
                    "scenario": "inverter_cooling_degradation",
                    "scenario_id": "SCN-B",
                    "site_id": SITE_ID,
                },
                timeout=5,
            )
            print(f"  ✓ Context set: inverter_cooling_degradation (SCN-B)\n")
        except Exception as exc:
            print(f"  [WARN] Could not set context: {exc}\n")

    run_start = time.time()

    try:
        while True:
            # Auto-exit if max runtime reached
            if args.max_runtime_secs > 0 and (time.time() - run_start) >= args.max_runtime_secs:
                print(f"\n{BOLD}Auto-stopped{RESET} after {args.max_runtime_secs:.0f}s "
                      f"({state.step} steps, {state.step * args.sim_interval} sim-minutes).")
                break

            step_start = time.time()

            # ── Phase transitions ────────────────────────────────────────────
            if state.phase == "normal" and state.step >= phase1_steps:
                state.phase = "degrading"
                print(
                    f"\n{BOLD}\033[33m"
                    f"[{state.timestamp}] ⚠  DEGRADATION ONSET — cooling subsystem fault detected"
                    f"{RESET}\n"
                )

            # Advance cooling_eff during degradation
            if state.phase in ("degrading", "critical"):
                state.cooling_eff = max(0.15, state.cooling_eff - 0.015)
                # Transition to critical when temp would exceed high threshold
                if state.cooling_eff < 0.45:
                    state.phase = "critical"

            # ── Generate events ──────────────────────────────────────────────
            events = generate_step_events(state)

            for event in events:
                print_event(event, state.phase)
                if session is not None:
                    try:
                        session.post(
                            f"{args.ingestion_url}/ingest",
                            json=event,
                            timeout=10,
                        )
                    except Exception as exc:
                        print(f"  \033[31m[WARN] POST failed: {exc}{RESET}", file=sys.stderr)

            state.step += 1

            # ── Sleep to real-time interval ──────────────────────────────────
            elapsed = time.time() - step_start
            sleep_time = max(0.0, real_interval_s - elapsed)
            if sleep_time > 0:
                time.sleep(sleep_time)

    except KeyboardInterrupt:
        print(f"\n\n{BOLD}Stopped.{RESET} Streamed {state.step} steps "
              f"({state.step * args.sim_interval} sim-minutes).")
    finally:
        if session:
            session.close()


if __name__ == "__main__":
    main()
