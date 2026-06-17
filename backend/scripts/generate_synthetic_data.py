"""
Synthetic Data Generator for GridOps Copilot.

Implements §4, §6, §7, §9, §10, §12 of IMPLEMENTATION_PLAN.md exactly.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from faker import Faker

# Ensure repo root is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.envelope import Envelope
from common.ids import (
    alert_id, audit_id, correlation_id, dispatch_id,
    event_id, record_id, work_order_id,
)
from common.timeutil import time_grid, to_iso

# ─── Constants from plan §0 ───────────────────────────────────────────────────

ANCHOR = "2026-06-16T13:00:00Z"
SITE_ID = "SITE-DS-001"
ENERGY_PRICE = 75.0

SCENARIO_SEEDS = {
    "normal_operation": 42,
    "inverter_cooling_degradation": 142,
    "bess_thermal_risk": 242,
    "weather_false_positive": 342,
}

SCENARIOS = list(SCENARIO_SEEDS.keys())

# ─── §4.3 Asset Inventory ─────────────────────────────────────────────────────

INV_MANUFACTURERS = ["SunGrid Power Systems", "Helios Inverters Inc", "VoltEdge Energy"]
INV_MODELS = ["SG-4000-XT", "HX-4100", "VE-4000P"]
BESS_MANUFACTURERS = ["NorthCell Storage", "AmpReserve Systems"]
BESS_MODELS = ["NC-5000-LFP", "AR-5MWh"]
TX_MANUFACTURERS = ["GridCore Transformers", "PowerLink Mfg"]
TX_MODELS = ["GC-60MVA", "PL-60T"]


def build_assets(seed: int = 42) -> dict:
    """Build assets.json as specified in §4.2 and §4.3."""
    rng = np.random.RandomState(seed)
    fake = Faker()
    fake.seed_instance(seed)
    random.seed(seed)

    assets = []

    # Solar inverters INV-001..INV-120, 4.0 MW each, 15 per transformer TX-001..TX-008
    for i in range(1, 121):
        asset_id_str = f"INV-{i:03d}"
        tx_num = ((i - 1) // 15) + 1
        parent = f"TX-{tx_num:03d}"
        mfr_idx = rng.randint(0, len(INV_MANUFACTURERS))
        mfr = INV_MANUFACTURERS[mfr_idx]
        model = INV_MODELS[mfr_idx]

        if asset_id_str == "INV-042":
            runtime = 19450
        else:
            runtime = int(rng.uniform(8000, 20000))

        install_date = fake.date_between(start_date="-5y", end_date="-2y")
        last_maint = fake.date_between(start_date="-12m", end_date="today")

        assets.append({
            "asset_id": asset_id_str,
            "asset_name": f"Solar Inverter {i:03d}",
            "asset_type": "solar_inverter",
            "site_id": SITE_ID,
            "capacity_mw": 4.0,
            "manufacturer": mfr,
            "model": model,
            "install_date": str(install_date),
            "runtime_hours": runtime,
            "status": "online",
            "parent_asset_id": parent,
            "location_zone": f"Block-{chr(65 + (i-1)//40)} Row-{((i-1)%40)//2+1:02d}",
            "criticality_score": round(float(rng.uniform(0.5, 0.75)), 2),
            "last_maintenance_date": str(last_maint),
        })

    # BESS units BESS-001..BESS-020, 5.0 MW each, round-robin to TX-001..TX-008
    for i in range(1, 21):
        asset_id_str = f"BESS-{i:03d}"
        tx_num = ((i - 1) % 8) + 1
        parent = f"TX-{tx_num:03d}"
        mfr_idx = rng.randint(0, len(BESS_MANUFACTURERS))
        mfr = BESS_MANUFACTURERS[mfr_idx]
        model = BESS_MODELS[mfr_idx]

        if asset_id_str == "BESS-011":
            runtime = 28500
        else:
            runtime = int(rng.uniform(8000, 20000))

        install_date = fake.date_between(start_date="-5y", end_date="-2y")
        last_maint = fake.date_between(start_date="-12m", end_date="today")

        assets.append({
            "asset_id": asset_id_str,
            "asset_name": f"BESS Unit {i:03d}",
            "asset_type": "bess_unit",
            "site_id": SITE_ID,
            "capacity_mw": 5.0,
            "manufacturer": mfr,
            "model": model,
            "install_date": str(install_date),
            "runtime_hours": runtime,
            "status": "online",
            "parent_asset_id": parent,
            "location_zone": f"BESS-Block-{chr(65 + (i-1)//10)}",
            "criticality_score": round(float(rng.uniform(0.7, 0.85)), 2),
            "last_maintenance_date": str(last_maint),
        })

    # Transformers TX-001..TX-008, 60 MW each, parent SUB-001
    for i in range(1, 9):
        asset_id_str = f"TX-{i:03d}"
        mfr_idx = rng.randint(0, len(TX_MANUFACTURERS))
        install_date = fake.date_between(start_date="-5y", end_date="-2y")
        last_maint = fake.date_between(start_date="-12m", end_date="today")
        assets.append({
            "asset_id": asset_id_str,
            "asset_name": f"Transformer {i:03d}",
            "asset_type": "transformer",
            "site_id": SITE_ID,
            "capacity_mw": 60.0,
            "manufacturer": TX_MANUFACTURERS[mfr_idx],
            "model": TX_MODELS[mfr_idx],
            "install_date": str(install_date),
            "runtime_hours": int(rng.uniform(8000, 20000)),
            "status": "online",
            "parent_asset_id": "SUB-001",
            "location_zone": f"Substation-Zone-{i}",
            "criticality_score": round(float(rng.uniform(0.85, 0.95)), 2),
            "last_maintenance_date": str(last_maint),
        })

    # Substation breaker SUB-001, 500 MW, parent GRID-001
    install_date = fake.date_between(start_date="-5y", end_date="-2y")
    assets.append({
        "asset_id": "SUB-001",
        "asset_name": "Substation Breaker 001",
        "asset_type": "substation_breaker",
        "site_id": SITE_ID,
        "capacity_mw": 500.0,
        "manufacturer": "GridCore Transformers",
        "model": "GC-500SUB",
        "install_date": str(install_date),
        "runtime_hours": int(rng.uniform(8000, 20000)),
        "status": "online",
        "parent_asset_id": "GRID-001",
        "location_zone": "Main-Substation",
        "criticality_score": round(float(rng.uniform(0.85, 0.95)), 2),
        "last_maintenance_date": str(fake.date_between(start_date="-12m", end_date="today")),
    })

    # Weather stations WX-001..WX-004
    for i in range(1, 5):
        install_date = fake.date_between(start_date="-5y", end_date="-2y")
        assets.append({
            "asset_id": f"WX-{i:03d}",
            "asset_name": f"Weather Station {i:03d}",
            "asset_type": "weather_station",
            "site_id": SITE_ID,
            "capacity_mw": 0.0,
            "manufacturer": "MeteoSense",
            "model": "MS-400",
            "install_date": str(install_date),
            "runtime_hours": int(rng.uniform(8000, 20000)),
            "status": "online",
            "parent_asset_id": SITE_ID,
            "location_zone": f"Perimeter-{i}",
            "criticality_score": round(float(rng.uniform(0.2, 0.4)), 2),
            "last_maintenance_date": str(fake.date_between(start_date="-12m", end_date="today")),
        })

    # Meters MTR-001..MTR-010
    for i in range(1, 11):
        install_date = fake.date_between(start_date="-5y", end_date="-2y")
        assets.append({
            "asset_id": f"MTR-{i:03d}",
            "asset_name": f"Meter {i:03d}",
            "asset_type": "meter",
            "site_id": SITE_ID,
            "capacity_mw": 0.0,
            "manufacturer": "GridMetrics Inc",
            "model": "GM-100",
            "install_date": str(install_date),
            "runtime_hours": int(rng.uniform(8000, 20000)),
            "status": "online",
            "parent_asset_id": "SUB-001",
            "location_zone": f"Meter-Bay-{i}",
            "criticality_score": round(float(rng.uniform(0.2, 0.4)), 2),
            "last_maintenance_date": str(fake.date_between(start_date="-12m", end_date="today")),
        })

    # Cooling systems COOL-001..COOL-120 (one per inverter)
    for i in range(1, 121):
        install_date = fake.date_between(start_date="-5y", end_date="-2y")
        assets.append({
            "asset_id": f"COOL-{i:03d}",
            "asset_name": f"Cooling System {i:03d}",
            "asset_type": "cooling_system",
            "site_id": SITE_ID,
            "capacity_mw": 0.0,
            "manufacturer": "ThermalPro",
            "model": "TP-FanUnit",
            "install_date": str(install_date),
            "runtime_hours": int(rng.uniform(8000, 20000)),
            "status": "online",
            "parent_asset_id": f"INV-{i:03d}",
            "location_zone": f"Block-{chr(65 + (i-1)//40)} Row-{((i-1)%40)//2+1:02d}",
            "criticality_score": round(float(rng.uniform(0.2, 0.4)), 2),
            "last_maintenance_date": str(fake.date_between(start_date="-12m", end_date="today")),
        })

    # Grid interconnection node GRID-001
    assets.append({
        "asset_id": "GRID-001",
        "asset_name": "Grid Interconnection Node 001",
        "asset_type": "grid_interconnection_node",
        "site_id": SITE_ID,
        "capacity_mw": 500.0,
        "manufacturer": "GridCore Transformers",
        "model": "GC-GIN-500",
        "install_date": "2021-01-01",
        "runtime_hours": int(rng.uniform(8000, 20000)),
        "status": "online",
        "parent_asset_id": SITE_ID,
        "location_zone": "Grid-Interconnect",
        "criticality_score": 0.95,
        "last_maintenance_date": str(fake.date_between(start_date="-12m", end_date="today")),
    })

    return {
        "site": {
            "site_id": SITE_ID,
            "site_name": "Desert Sun Solar + BESS",
            "region": "California Desert",
            "latitude": 34.84,
            "longitude": -116.45,
            "total_capacity_mw": 500,
            "timezone": "America/Los_Angeles",
        },
        "assets": assets,
    }


# ─── §9 Maintenance Records ───────────────────────────────────────────────────

ISSUE_TYPES = [
    "cooling_fan_irregularity", "thermal_alarm", "efficiency_inspection",
    "routine_maintenance", "bess_cooling_inspection", "sensor_calibration", "comms_fault"
]


def build_maintenance_records(seed: int, assets: dict) -> list:
    """Build maintenance_records.json per §9."""
    fake = Faker()
    fake.seed_instance(seed)
    rng = np.random.RandomState(seed)
    random.seed(seed)

    records = []

    # Required seeded records for Scenario B (INV-042)
    records.append({
        "record_id": "MR-INV042-0001",
        "asset_id": "INV-042",
        "work_order_id": "WO-2025-00871",
        "timestamp": "2025-10-12T09:30:00Z",
        "technician": "Daniel Reyes",
        "issue_type": "cooling_fan_irregularity",
        "description": "Cooling fan speed irregularity reported during routine inspection.",
        "resolution": "Fan inspected and thermal sensor recalibrated.",
        "parts_replaced": [],
        "downtime_hours": 2.5,
        "follow_up_required": True,
        "notes": "Recommend fan replacement if temperature issue recurs.",
    })

    # Required seeded records for Scenario C (BESS-011)
    records.append({
        "record_id": "MR-BESS011-0001",
        "asset_id": "BESS-011",
        "work_order_id": "WO-2026-00234",
        "timestamp": "2026-02-20T10:00:00Z",
        "technician": "Priya Nair",
        "issue_type": "bess_cooling_inspection",
        "description": "Scheduled cooling loop inspection during dispatch window.",
        "resolution": "Cooling loop flushed and fluid topped up.",
        "parts_replaced": [],
        "downtime_hours": 1.5,
        "follow_up_required": True,
        "notes": "Cooling loop temperature sensitivity noted under active dispatch. Monitor closely.",
    })
    records.append({
        "record_id": "MR-BESS011-0002",
        "asset_id": "BESS-011",
        "work_order_id": "WO-2026-01120",
        "timestamp": "2026-04-30T14:00:00Z",
        "technician": "Carlos Vega",
        "issue_type": "thermal_alarm",
        "description": "Watch-level thermal alarm triggered during peak discharge.",
        "resolution": "Alarm acknowledged; cooling loop verified functional.",
        "parts_replaced": [],
        "downtime_hours": 0.5,
        "follow_up_required": True,
        "notes": "Prior watch-level thermal events observed. Escalate if temperature exceeds 48C.",
    })

    # Background noise: ~30 routine records across random assets
    asset_ids = [a["asset_id"] for a in assets["assets"] if a["asset_type"] in ("solar_inverter", "bess_unit", "transformer")]
    rng.shuffle(asset_ids)
    for j in range(30):
        aid = asset_ids[j % len(asset_ids)]
        issue = ISSUE_TYPES[rng.randint(0, len(ISSUE_TYPES))]
        fake_date = fake.date_between(start_date="-24m", end_date="-3m")
        records.append({
            "record_id": f"MR-BG-{j+1:04d}",
            "asset_id": aid,
            "work_order_id": work_order_id(2025, 10000 + j),
            "timestamp": f"{fake_date}T{rng.randint(7,17):02d}:00:00Z",
            "technician": fake.name(),
            "issue_type": issue,
            "description": f"Routine inspection: {issue.replace('_', ' ')} check.",
            "resolution": fake.sentence(nb_words=8),
            "parts_replaced": [],
            "downtime_hours": round(float(rng.uniform(0.5, 4.0)), 1),
            "follow_up_required": bool(rng.randint(0, 2)),
            "notes": fake.sentence(nb_words=12),
        })

    return records


# ─── §6 Telemetry Generation ──────────────────────────────────────────────────

def solar_factor(t: datetime) -> float:
    """Diurnal solar shape — clipped sine peaking at ~0.92 midday."""
    hour = t.hour + t.minute / 60.0
    # Sunrise ~6:00, sunset ~20:00 in desert
    if hour < 6.0 or hour > 20.0:
        return 0.0
    angle = math.pi * (hour - 6.0) / 14.0
    return float(np.clip(math.sin(angle) * 0.92, 0.0, 0.92))


def gen_inverter_telemetry(
    asset: dict, grid: list[datetime], scenario: str, seed: int
) -> list[Envelope]:
    """Generate solar inverter telemetry per §6."""
    rng = np.random.RandomState(seed)
    envelopes = []
    asset_id_str = asset["asset_id"]
    capacity_kw = asset["capacity_mw"] * 1000.0
    corr = correlation_id(asset_id_str, "run")

    # Anomaly injection params
    is_focal = (scenario == "inverter_cooling_degradation" and asset_id_str == "INV-042")
    k = int(len(grid) * 0.30)  # anomaly start index at 30%

    skipped_indices: set[int] = set()
    if is_focal:
        # From k+8, drop ~1 in 4 telemetry points (communication timeout)
        for ci in range(k + 8, len(grid)):
            if rng.rand() < 0.25:
                skipped_indices.add(ci)

    for i, t in enumerate(grid):
        if i in skipped_indices:
            continue

        sf = solar_factor(t)
        ambient = 38.5 + rng.normal(0, 0.5)

        # Baseline values (plan §6: nominal 55-65°C at ambient ~38.5°C)
        # Formula: 45 + 0.02*active_power_kw/100 + ambient_offset
        # Calibrated so at power=3650kW, ambient=38.5 → temp≈62°C as in plan example
        base_power = capacity_kw * sf
        base_temp = 45.0 + 0.02 * base_power / 100.0 + (ambient - 22.0)
        base_fan = 2400.0
        base_eff = 98.3
        base_volt_var = 0.5

        # Anomaly terms
        if is_focal and i >= k:
            di = i - k
            temp_ramp = di * 0.9
            fan_drop = di * 45.0
            eff_drop = di * 0.12
            derate = min(0.22, di * 0.006)
            volt_ramp = di * 0.05
        else:
            temp_ramp = 0.0
            fan_drop = 0.0
            eff_drop = 0.0
            derate = 0.0
            volt_ramp = 0.0

        inv_temp = float(np.clip(
            base_temp + temp_ramp + rng.normal(0, 0.3), 40.0, 92.0
        ))
        cabinet_temp = float(inv_temp - 20.0 + rng.normal(0, 0.5))
        fan_rpm = int(np.clip(
            base_fan - fan_drop + rng.normal(0, 180 if (is_focal and i >= k) else 50),
            800, 3000
        ))
        efficiency = float(np.clip(
            base_eff - eff_drop + rng.normal(0, 0.1), 92.0, 99.5
        ))
        power_kw = float(np.clip(
            base_power * (1.0 - derate) + rng.normal(0, 10.0), 0.0, capacity_kw
        ))
        volt_var = float(np.clip(
            base_volt_var + volt_ramp + rng.normal(0, 0.05), 0.0, 5.0
        ))
        mppt_eff = float(np.clip(99.0 - eff_drop * 0.5 + rng.normal(0, 0.1), 95.0, 99.9))
        dc_voltage = float(600.0 + rng.normal(0, 5.0))
        ac_voltage = float(480.0 + rng.normal(0, 2.0))
        dc_current = float(power_kw / dc_voltage) if dc_voltage > 0 else 0.0
        ac_current = float(power_kw / (ac_voltage * 1.732)) if ac_voltage > 0 else 0.0
        react_power = float(power_kw * 0.033 + rng.normal(0, 2.0))

        # Fault code and state
        if inv_temp > 85.0 and is_focal:
            fault_code = "THERMAL_DERATE"
            op_state = "derated"
        else:
            fault_code = None
            op_state = "running"

        payload = {
            "asset_type": "solar_inverter",
            "dc_voltage": round(dc_voltage, 1),
            "ac_voltage": round(ac_voltage, 1),
            "dc_current": round(dc_current, 2),
            "ac_current": round(ac_current, 2),
            "active_power_kw": round(power_kw, 1),
            "reactive_power_kvar": round(react_power, 1),
            "inverter_temperature_c": round(inv_temp, 1),
            "cabinet_temperature_c": round(cabinet_temp, 1),
            "cooling_fan_rpm": fan_rpm,
            "conversion_efficiency_pct": round(efficiency, 2),
            "mppt_efficiency_pct": round(mppt_eff, 2),
            "frequency_hz": 60.0,
            "voltage_variance": round(volt_var, 2),
            "fault_code": fault_code,
            "operating_state": op_state,
        }

        ev = Envelope(
            event_id=event_id("t", asset_id_str, i),
            event_type="telemetry",
            source_system="SCADA",
            site_id=SITE_ID,
            asset_id=asset_id_str,
            timestamp=to_iso(t),
            correlation_id=corr,
            payload=payload,
        )
        envelopes.append(ev)

    return envelopes


def gen_bess_telemetry(
    asset: dict, grid: list[datetime], scenario: str, seed: int
) -> list[Envelope]:
    """Generate BESS telemetry per §6.1 BESS thermal risk."""
    rng = np.random.RandomState(seed)
    envelopes = []
    asset_id_str = asset["asset_id"]
    corr = correlation_id(asset_id_str, "run")

    is_focal = (scenario == "bess_thermal_risk" and asset_id_str == "BESS-011")
    k = int(len(grid) * 0.30)

    soc = 80.0  # starting SoC %

    for i, t in enumerate(grid):
        di = max(0, i - k) if is_focal else 0

        bat_temp = float(np.clip(38.0 + di * 1.1 + rng.normal(0, 0.3), 30.0, 60.0))
        cool_temp = float(np.clip(34.0 + di * 0.7 + rng.normal(0, 0.2), 28.0, 55.0))
        rack_temp = float(bat_temp - 3.0 + rng.normal(0, 0.3))

        if bat_temp > 50.0:
            thermal_level = "critical"
        elif bat_temp > 45.0:
            thermal_level = "warning"
        elif bat_temp > 42.0:
            thermal_level = "watch"
        else:
            thermal_level = "normal"

        discharge_kw = 4200.0 if is_focal else 0.0
        charge_kw = 0.0

        soc_drop = (discharge_kw / (5000.0 * 1.0)) * 100.0 / 12.0  # per 5-min step
        soc = max(10.0, soc - soc_drop + rng.normal(0, 0.2))

        op_state = "discharging" if discharge_kw > 0 else "standby"

        payload = {
            "asset_type": "bess_unit",
            "state_of_charge_pct": round(soc, 1),
            "state_of_health_pct": round(96.5 - di * 0.01, 2),
            "battery_temperature_c": round(bat_temp, 1),
            "rack_temperature_c": round(rack_temp, 1),
            "cooling_loop_temp_c": round(cool_temp, 1),
            "charge_power_kw": charge_kw,
            "discharge_power_kw": round(discharge_kw, 1),
            "cell_voltage_min": round(3.21 + rng.normal(0, 0.01), 3),
            "cell_voltage_max": round(3.34 + rng.normal(0, 0.01), 3),
            "thermal_warning_level": thermal_level,
            "operating_state": op_state,
        }

        ev = Envelope(
            event_id=event_id("t", asset_id_str, i),
            event_type="telemetry",
            source_system="SCADA",
            site_id=SITE_ID,
            asset_id=asset_id_str,
            timestamp=to_iso(t),
            correlation_id=corr,
            payload=payload,
        )
        envelopes.append(ev)

    return envelopes


def gen_weather(
    grid: list[datetime], scenario: str, seed: int
) -> list[Envelope]:
    """Generate weather observations per §10 and §6.1 weather false positive."""
    rng = np.random.RandomState(seed)
    envelopes = []
    asset_id_str = "WX-001"
    corr = correlation_id("WX001", "run")
    is_weather = scenario == "weather_false_positive"
    n = len(grid)

    for i, t in enumerate(grid):
        if is_weather:
            # Cloud cover ramps 5 → 70 linearly
            cloud = float(np.clip(5.0 + 65.0 * i / n, 5.0, 70.0))
            # Irradiance drops proportionally 910 → 380
            irradiance = float(np.clip(910.0 - 530.0 * i / n, 380.0, 910.0))
        else:
            cloud = float(np.clip(5.0 + rng.normal(0, 1.0), 0.0, 15.0))
            irradiance = float(np.clip(910.0 * solar_factor(t) + rng.normal(0, 5.0), 0.0, 1050.0))

        payload = {
            "irradiance_w_m2": round(irradiance, 1),
            "ambient_temperature_c": round(38.5 + rng.normal(0, 0.5), 1),
            "wind_speed_m_s": round(3.2 + rng.normal(0, 0.3), 2),
            "humidity_pct": round(12.0 + rng.normal(0, 1.0), 1),
            "cloud_cover_pct": round(cloud, 1),
            "precipitation_mm": 0.0,
            "air_pressure_hpa": round(1009.0 + rng.normal(0, 0.5), 1),
        }

        ev = Envelope(
            event_id=event_id("w", asset_id_str, i),
            event_type="weather",
            source_system="WeatherAPI",
            site_id=SITE_ID,
            asset_id=asset_id_str,
            timestamp=to_iso(t),
            correlation_id=corr,
            payload=payload,
        )
        envelopes.append(ev)

    return envelopes


def gen_forecast(
    asset: dict,
    telemetry: list[Envelope],
    weather: list[Envelope],
    scenario: str,
) -> list[Envelope]:
    """Generate forecast events per §10."""
    envelopes = []
    corr = correlation_id(asset["asset_id"], "forecast")
    capacity_mw = asset["capacity_mw"]

    for i, (tel_env, wx_env) in enumerate(zip(telemetry, weather)):
        irr = wx_env.payload.get("irradiance_w_m2", 0.0)
        ambient = wx_env.payload.get("ambient_temperature_c", 25.0)
        temp_derate = 1.0 - 0.004 * max(0.0, ambient - 25.0)
        expected_mw = capacity_mw * (irr / 1000.0) * temp_derate
        actual_mw = tel_env.payload.get("active_power_kw", 0.0) / 1000.0
        interval_min = 5
        err_pct = (
            (expected_mw - actual_mw) / expected_mw * 100.0
            if expected_mw > 0.01 else 0.0
        )

        payload = {
            "expected_output_mw": round(expected_mw, 3),
            "actual_output_mw": round(actual_mw, 3),
            "forecast_error_pct": round(err_pct, 2),
            "expected_energy_mwh": round(expected_mw * interval_min / 60.0, 4),
            "actual_energy_mwh": round(actual_mw * interval_min / 60.0, 4),
            "interval_minutes": interval_min,
        }

        ev = Envelope(
            event_id=event_id("f", asset["asset_id"], i),
            event_type="forecast",
            source_system="ForecastEngine",
            site_id=SITE_ID,
            asset_id=asset["asset_id"],
            timestamp=tel_env.timestamp,
            correlation_id=corr,
            payload=payload,
        )
        envelopes.append(ev)

    return envelopes


def gen_dispatch(
    asset: dict, grid: list[datetime], scenario: str
) -> list[Envelope]:
    """Generate dispatch events per §5.3. Only for BESS in bess_thermal_risk."""
    envelopes = []
    if scenario != "bess_thermal_risk" or asset["asset_id"] != "BESS-011":
        return envelopes

    corr = correlation_id(asset["asset_id"], "dispatch")
    t = grid[0]
    payload = {
        "dispatch_id": dispatch_id(1),
        "command": "discharge",
        "requested_power_mw": 4.2,
        "duration_minutes": len(grid) * 5,
        "grid_signal": "peak_demand",
        "active": True,
    }
    ev = Envelope(
        event_id=event_id("d", asset["asset_id"], 0),
        event_type="dispatch",
        source_system="GridOpsAI",
        site_id=SITE_ID,
        asset_id=asset["asset_id"],
        timestamp=to_iso(t),
        correlation_id=corr,
        payload=payload,
    )
    envelopes.append(ev)
    return envelopes


# ─── §7 Alert Derivation ──────────────────────────────────────────────────────

def derive_alerts(
    telemetry: list[Envelope],
    weather: list[Envelope],
    forecast: list[Envelope],
) -> list[Envelope]:
    """Apply alert rules from §7.1 to produce alert events."""
    alerts: list[Envelope] = []
    prev_ts: dict[str, str] = {}   # asset_id → last seen timestamp
    alert_counter: dict[str, int] = {}

    wx_by_ts: dict[str, dict] = {e.timestamp: e.payload for e in weather}
    fc_by_ts: dict[str, dict] = {}
    for e in forecast:
        fc_by_ts[(e.asset_id, e.timestamp)] = e.payload

    # Build list of expected timestamps per asset to detect gaps
    expected_ts_per_asset: dict[str, list[str]] = {}
    for e in telemetry:
        expected_ts_per_asset.setdefault(e.asset_id, []).append(e.timestamp)

    # Compute full expected grid from min/max of telemetry
    if telemetry:
        all_ts = sorted({e.timestamp for e in telemetry})
        if len(all_ts) >= 2:
            from common.timeutil import parse_utc
            t0 = parse_utc(all_ts[0])
            t1 = parse_utc(all_ts[1])
            step = int((t1 - t0).total_seconds() / 60)
            t_end = parse_utc(all_ts[-1])
            full_grid = set()
            cur = t0
            while cur <= t_end:
                full_grid.add(to_iso(cur))
                cur += timedelta(minutes=step)

            for asset_str in expected_ts_per_asset:
                seen = set(expected_ts_per_asset[asset_str])
                for ts in full_grid:
                    if ts not in seen and ts >= all_ts[0] and ts <= all_ts[-1]:
                        # Communication timeout: missing expected point (R7)
                        counter = alert_counter.get(asset_str, 0) + 1
                        alert_counter[asset_str] = counter
                        a_id = alert_id(asset_str, counter)
                        corr = correlation_id(asset_str, "run")
                        alerts.append(Envelope(
                            event_id=event_id("a", asset_str, counter),
                            event_type="alert",
                            source_system="SCADA",
                            site_id=SITE_ID,
                            asset_id=asset_str,
                            timestamp=ts,
                            correlation_id=corr,
                            payload={
                                "alert_id": a_id,
                                "alert_type": "communication_timeout",
                                "asset_id": asset_str,
                                "severity": "medium",
                                "source_system": "SCADA",
                                "timestamp": ts,
                                "message": f"Telemetry point missing at {ts}",
                                "threshold_value": 0.0,
                                "observed_value": 0.0,
                                "metric": "telemetry_presence",
                                "acknowledged": False,
                                "correlated_incident_id": None,
                            }
                        ))

    for e in sorted(telemetry, key=lambda x: (x.asset_id, x.timestamp)):
        p = e.payload
        asset_str = e.asset_id
        ts = e.timestamp
        corr = e.correlation_id
        counter = alert_counter.get(asset_str, 0)

        def emit(alert_type: str, severity: str, metric: str,
                 threshold: float, observed: float, message: str) -> None:
            nonlocal counter
            counter += 1
            alert_counter[asset_str] = counter
            a_id = alert_id(asset_str, counter)
            alerts.append(Envelope(
                event_id=event_id("a", asset_str, counter),
                event_type="alert",
                source_system="SCADA",
                site_id=SITE_ID,
                asset_id=asset_str,
                timestamp=ts,
                correlation_id=corr,
                payload={
                    "alert_id": a_id,
                    "alert_type": alert_type,
                    "asset_id": asset_str,
                    "severity": severity,
                    "source_system": "SCADA",
                    "timestamp": ts,
                    "message": message,
                    "threshold_value": threshold,
                    "observed_value": observed,
                    "metric": metric,
                    "acknowledged": False,
                    "correlated_incident_id": None,
                }
            ))

        asset_type = p.get("asset_type")

        if asset_type == "solar_inverter":
            inv_temp = p.get("inverter_temperature_c", 0.0)
            fan_rpm = p.get("cooling_fan_rpm", 9999)
            eff = p.get("conversion_efficiency_pct", 100.0)
            volt_var = p.get("voltage_variance", 0.0)
            op_state = p.get("operating_state", "running")
            prev_state = prev_ts.get(asset_str + "_op_state", "running")

            # R1 / R2 mutually exclusive — only emit highest severity
            if inv_temp > 85:
                emit("inverter_temperature_high", "high",
                     "inverter_temperature_c", 85.0, inv_temp,
                     f"Inverter temperature {inv_temp}C exceeds high threshold 85C")
            elif inv_temp > 75:
                emit("inverter_temperature_high", "medium",
                     "inverter_temperature_c", 75.0, inv_temp,
                     f"Inverter temperature {inv_temp}C exceeds medium threshold 75C")
            # R3
            if fan_rpm < 1200 and inv_temp > 80:
                emit("cooling_fan_irregular", "high",
                     "cooling_fan_rpm", 1200.0, float(fan_rpm),
                     f"Cooling fan rpm {fan_rpm} with inverter temp {inv_temp}C")
            # R4
            if eff < 96:
                emit("efficiency_drop", "medium",
                     "conversion_efficiency_pct", 96.0, eff,
                     f"Efficiency {eff}% below threshold 96%")
            # R6
            if volt_var > 2.0:
                emit("voltage_instability", "medium",
                     "voltage_variance", 2.0, volt_var,
                     f"Voltage variance {volt_var} exceeds 2.0")
            # R8 — only on state transition to 'derated' to avoid repeated alerts
            if op_state == "derated" and prev_state != "derated":
                emit("performance_degradation", "high",
                     "operating_state", 0.0, 0.0,
                     "Inverter operating state: derated")
            prev_ts[asset_str + "_op_state"] = op_state

            # R5 — need forecast data
            fc = fc_by_ts.get((asset_str, ts))
            wx_list = list(wx_by_ts.values())
            if fc:
                err = fc.get("forecast_error_pct", 0.0)
                # Check if irradiance is stable (use current wx point)
                wx_pay = wx_by_ts.get(ts)
                if wx_pay:
                    irr = wx_pay.get("irradiance_w_m2", 910.0)
                    irr_stable = irr > 800.0  # simplistic
                    if err > 10 and irr_stable:
                        emit("output_below_forecast", "high",
                             "forecast_error_pct", 10.0, err,
                             f"Output {err:.1f}% below forecast with stable irradiance")

        elif asset_type == "bess_unit":
            bat_temp = p.get("battery_temperature_c", 0.0)
            cool_temp = p.get("cooling_loop_temp_c", 0.0)
            thermal_level = p.get("thermal_warning_level", "normal")

            # R9
            if bat_temp > 45 and bat_temp <= 50:
                emit("bess_temperature_high", "high",
                     "battery_temperature_c", 45.0, bat_temp,
                     f"Battery temperature {bat_temp}C exceeds 45C")
            # R10
            if bat_temp > 50:
                emit("bess_temperature_high", "critical",
                     "battery_temperature_c", 50.0, bat_temp,
                     f"Battery temperature {bat_temp}C exceeds critical threshold 50C")
            # R11
            if cool_temp > 38 and thermal_level in ("warning", "critical"):
                emit("bess_cooling_loop_warning", "high",
                     "cooling_loop_temp_c", 38.0, cool_temp,
                     f"Cooling loop temp {cool_temp}C with thermal level {thermal_level}")

        # R12 — weather-explained forecast drop (low severity)
        fc = fc_by_ts.get((asset_str, ts))
        wx_pay = wx_by_ts.get(ts)
        if fc and wx_pay and asset_type == "solar_inverter":
            err = fc.get("forecast_error_pct", 0.0)
            cloud = wx_pay.get("cloud_cover_pct", 0.0)
            if err > 10 and cloud > 20:
                emit("output_below_forecast_weather", "low",
                     "forecast_error_pct", 10.0, err,
                     f"Output {err:.1f}% below forecast, cloud cover {cloud}% rising")

    return alerts


def gen_maintenance_events(
    asset_id_str: str, records: list[dict]
) -> list[Envelope]:
    """Emit maintenance records for a specific asset as envelope stream."""
    envelopes = []
    asset_records = [r for r in records if r["asset_id"] == asset_id_str]
    corr = correlation_id(asset_id_str, "maint")
    for i, rec in enumerate(asset_records):
        ev = Envelope(
            event_id=event_id("m", asset_id_str, i),
            event_type="maintenance",
            source_system="CMMS",
            site_id=SITE_ID,
            asset_id=asset_id_str,
            timestamp=rec["timestamp"],
            correlation_id=corr,
            payload=rec,
        )
        envelopes.append(ev)
    return envelopes


# ─── §12.2 JSONL Writer ───────────────────────────────────────────────────────

def write_jsonl(path: Path, envelopes: list[Envelope]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sorted_envs = sorted(envelopes, key=lambda e: e.timestamp)
    with open(path, "w") as f:
        for env in sorted_envs:
            f.write(env.model_dump_json() + "\n")


# ─── §12.3 run_scenario ───────────────────────────────────────────────────────

def run_scenario(
    scenario: str,
    assets: dict,
    maintenance_records: list[dict],
    duration_hours: float = 6.0,
    interval_minutes: int = 5,
    anchor: str = ANCHOR,
    seed: int | None = None,
) -> None:
    """Generate all six JSONL files for a scenario."""
    if seed is None:
        seed = SCENARIO_SEEDS[scenario]

    print(f"  Generating scenario: {scenario} (seed={seed})")
    grid = time_grid(anchor, duration_hours, interval_minutes)
    out_dir = Path("data/scenarios") / scenario

    # Determine focal assets for this scenario
    all_assets = assets["assets"]

    # Focal assets + 5 background inverters
    bg_rng = np.random.RandomState(seed)
    bg_inv_indices = bg_rng.choice(range(120), size=5, replace=False)
    bg_inverters = [all_assets[i] for i in bg_inv_indices if all_assets[i]["asset_id"] != "INV-042"][:5]

    telemetry_all: list[Envelope] = []
    weather_all: list[Envelope] = []
    forecast_all: list[Envelope] = []
    alert_all: list[Envelope] = []
    maintenance_all: list[Envelope] = []
    dispatch_all: list[Envelope] = []

    # Weather (shared)
    weather_all = gen_weather(grid, scenario, seed)

    # Focal asset telemetry
    if scenario == "inverter_cooling_degradation":
        inv042 = next(a for a in all_assets if a["asset_id"] == "INV-042")
        focal_tel = gen_inverter_telemetry(inv042, grid, scenario, seed)
        telemetry_all.extend(focal_tel)
        forecast_all.extend(gen_forecast(inv042, focal_tel, weather_all, scenario))
        maintenance_all.extend(gen_maintenance_events("INV-042", maintenance_records))

    elif scenario == "bess_thermal_risk":
        bess011 = next(a for a in all_assets if a["asset_id"] == "BESS-011")
        focal_tel = gen_bess_telemetry(bess011, grid, scenario, seed)
        telemetry_all.extend(focal_tel)
        dispatch_all.extend(gen_dispatch(bess011, grid, scenario))
        maintenance_all.extend(gen_maintenance_events("BESS-011", maintenance_records))

    elif scenario in ("normal_operation", "weather_false_positive"):
        # Use INV-042 as reference
        inv042 = next(a for a in all_assets if a["asset_id"] == "INV-042")
        focal_tel = gen_inverter_telemetry(inv042, grid, scenario, seed)
        telemetry_all.extend(focal_tel)
        forecast_all.extend(gen_forecast(inv042, focal_tel, weather_all, scenario))

    # Background inverters
    for bg_asset in bg_inverters:
        bg_tel = gen_inverter_telemetry(bg_asset, grid, "normal_operation", seed + hash(bg_asset["asset_id"]) % 100)
        telemetry_all.extend(bg_tel)
        forecast_all.extend(gen_forecast(bg_asset, bg_tel, weather_all, "normal_operation"))

    # Derive alerts
    alert_all = derive_alerts(telemetry_all, weather_all, forecast_all)

    # Write JSONL files
    write_jsonl(out_dir / "telemetry_events.jsonl", telemetry_all)
    write_jsonl(out_dir / "alert_events.jsonl", alert_all)
    write_jsonl(out_dir / "weather_events.jsonl", weather_all)
    write_jsonl(out_dir / "forecast_events.jsonl", forecast_all)
    write_jsonl(out_dir / "maintenance_events.jsonl", maintenance_all)
    write_jsonl(out_dir / "grid_dispatch_events.jsonl", dispatch_all)

    print(f"    telemetry={len(telemetry_all)}, alerts={len(alert_all)}, "
          f"weather={len(weather_all)}, forecast={len(forecast_all)}, "
          f"maintenance={len(maintenance_all)}, dispatch={len(dispatch_all)}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="GridOps synthetic data generator")
    parser.add_argument("--scenario", choices=SCENARIOS)
    parser.add_argument("--all", action="store_true", help="Generate all scenarios")
    parser.add_argument("--duration-hours", type=float, default=6.0)
    parser.add_argument("--interval-minutes", type=int, default=5)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--anchor", default=ANCHOR)
    args = parser.parse_args()

    if not args.all and not args.scenario:
        parser.error("Specify --scenario or --all")

    # Always generate static data
    print("Building assets.json...")
    assets = build_assets(args.seed)
    Path("data/assets.json").write_text(json.dumps(assets, indent=2, default=str))
    print(f"  {len(assets['assets'])} assets written.")

    print("Building manufacturer_notes.json (static)...")
    notes = json.loads(Path("data/manufacturer_notes.json").read_text())
    print(f"  {len(notes)} notes already present.")

    print("Building maintenance_records.json...")
    records = build_maintenance_records(args.seed, assets)
    Path("data/maintenance_records.json").write_text(json.dumps(records, indent=2, default=str))
    print(f"  {len(records)} records written.")

    print("Building ground_truth.json (static)...")
    gt = json.loads(Path("data/ground_truth.json").read_text())
    print(f"  {len(gt)} ground-truth records present.")

    scenarios_to_run = SCENARIOS if args.all else [args.scenario]
    for scenario in scenarios_to_run:
        run_scenario(
            scenario,
            assets,
            records,
            duration_hours=args.duration_hours,
            interval_minutes=args.interval_minutes,
            anchor=args.anchor,
        )

    print("\nData generation complete.")


if __name__ == "__main__":
    main()
