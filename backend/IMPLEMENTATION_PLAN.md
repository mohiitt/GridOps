# GridOps Copilot — Backend, Data, Agents & Event-Streaming Implementation Plan

**Tagline:** From renewable-energy alert noise to actionable incident intelligence.

**Hackathon:** TrueFoundry × CrewAI — *From Prototype to Production: Real-World AI Agents*

This document is the single source of truth for building the GridOps Copilot backend. It contains concrete schemas, exact folder structures, exact Kafka topics, exact JSON examples, exact agent definitions, and a build timeline. A coding agent can implement directly from this without further decisions.

> Frontend design is intentionally excluded. Only API response shapes are specified so the frontend can consume them.

---

## 0. Decisions (Locked)

These decisions are final. Do not re-open them during the build.

| Decision | Choice |
| --- | --- |
| Event transport for demo | **JSONL simulation (Mode 1)**. Kafka/Redpanda is optional and only attempted after the eval passes. |
| Anomaly scoring | **Rule-based first** (deterministic). IsolationForest is an optional add-on, not a dependency. |
| LLM routing | **All LLM calls go through TrueFoundry AI Gateway** (OpenAI-compatible base URL). |
| Default LLM | `openai/gpt-4o-mini` via the gateway for agent reasoning. `gpt-4o` only for the Operator Briefing Agent. |
| Determinism | Global seed `GRIDOPS_SEED=42`. All randomness derives from per-scenario seeds. |
| Site | Single site `SITE-DS-001` ("Desert Sun Solar + BESS", California desert). |
| Time base | All timestamps UTC, ISO-8601 with `Z` suffix. Scenario anchor time = `2026-06-16T13:00:00Z`. |
| Energy price | `$75/MWh` flat (`ENERGY_PRICE_PER_MWH=75`). Used for business impact. |
| API framework | **FastAPI** + Uvicorn for all services. |
| Schema validation | **Pydantic v2** for all event/envelope/report models. |
| Python | **3.11**. |
| Package manager | `pip` + `requirements.txt`. |

**Is Kafka worth it for the hackathon?** No. Implement JSONL simulation (Mode 1) as the primary path because it is reproducible, debuggable, and demo-safe. The producer/consumer scripts are written so the same event envelope flows through either mode. Only stand up Redpanda if all core deliverables pass with >30 minutes to spare.

---

## 1. Project Summary

GridOps Copilot is an AI operations copilot for renewable-energy operators managing a 500 MW solar + BESS portfolio. It ingests high-volume, disconnected signals (SCADA alerts, telemetry, maintenance records, weather, forecast, grid dispatch) and produces a single explainable incident per asset cluster:

```text
Many raw alerts + telemetry + maintenance + weather/forecast
        ↓ (anomaly scoring + correlation + CrewAI multi-agent reasoning)
One explainable incident:
  root cause · evidence · priority · business impact · recommended action · governance status
```

The pipeline:

```text
Synthetic Data Generator
        ↓ (JSONL event streams, Kafka-shaped)
Event Ingestion Service  ──► in-memory asset state
        ↓
Anomaly Scoring Service (TrueFoundry-deployable, rule-based)
        ↓
Incident Correlation Service ──► incident candidates
        ↓
CrewAI Workflow Service (9 agents) ──► TrueFoundry AI Gateway ──► LLM
        ↓
Incident Report API ──► frontend
        ↓
Governance/Audit store + Evaluation harness
```

---

## 2. Core Demo Scenario

A 500 MW solar + BESS facility experiences inverter cooling degradation on `INV-042`. Raw systems emit disconnected alerts (temperature high, efficiency drop, output below forecast, voltage instability, communication timeout, cooling fan irregular, performance degradation). GridOps Copilot correlates these into one incident:

```text
Incident: Cooling subsystem degradation on Solar Inverter INV-042.
Evidence:
  - Temperature increased before output dropped.
  - Efficiency dropped below normal operating range.
  - Actual output below weather-adjusted forecast.
  - Weather does not explain the loss.
  - Similar cooling fan issue 8 months ago.
  - Asset runtime above fan-risk threshold (>18,000 h).
Business impact: ~2.8 MWh/day lost ≈ $210/day.
Recommended action: Inspect cooling fan within 24 hours.
Governance: Human approval required before taking inverter offline.
```

---

## 3. Repository Structure (Exact)

```text
gridops-copilot/
├── README.md
├── requirements.txt
├── .env.example
├── docker-compose.yml
├── Makefile
├── config/
│   └── settings.py
├── data/
│   ├── assets.json
│   ├── manufacturer_notes.json
│   ├── maintenance_records.json
│   ├── ground_truth.json
│   └── scenarios/
│       ├── normal_operation/
│       │   ├── telemetry_events.jsonl
│       │   ├── alert_events.jsonl
│       │   ├── weather_events.jsonl
│       │   ├── forecast_events.jsonl
│       │   ├── maintenance_events.jsonl
│       │   └── grid_dispatch_events.jsonl
│       ├── inverter_cooling_degradation/
│       │   └── (same six files)
│       ├── bess_thermal_risk/
│       │   └── (same six files)
│       └── weather_false_positive/
│           └── (same six files)
├── common/
│   ├── __init__.py
│   ├── envelope.py          # Kafka envelope + Pydantic models
│   ├── schemas.py           # payload schemas for every topic
│   ├── ids.py               # deterministic id generators
│   └── timeutil.py
├── scripts/
│   ├── generate_synthetic_data.py
│   ├── produce_events.py
│   └── consume_events.py
├── services/
│   ├── anomaly_service/
│   │   ├── main.py
│   │   ├── scoring.py
│   │   ├── features.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── ingestion_service/
│   │   ├── main.py
│   │   ├── event_router.py
│   │   ├── state_store.py
│   │   └── correlation.py
│   └── incident_api/
│       ├── main.py
│       ├── schemas.py
│       └── store.py
├── agents/
│   ├── crew.py
│   ├── agents.yaml
│   ├── tasks.yaml
│   ├── tools.py
│   └── llm.py               # TrueFoundry gateway client
├── evaluation/
│   ├── run_eval.py
│   └── metrics.py
├── deployment/
│   ├── truefoundry.yaml
│   ├── tfy_anomaly_service.py
│   └── kafka_topics.md
└── docs/
    ├── architecture.md
    ├── data_contracts.md
    └── demo_script.md
```

---

## 4. Synthetic Data Design

### 4.1 Principles

- **Faker** is used ONLY for cosmetic/identity fields: manufacturer names, technician names, work-order owners, location labels, document IDs, and the *phrasing* of maintenance notes.
- **NumPy + deterministic scenario rules** generate ALL domain telemetry values (temperatures, power, efficiency, irradiance, SoC, etc.).
- Every scenario seeds Faker, NumPy, and `random` from `GRIDOPS_SEED + scenario_offset` for byte-stable reproducibility.

Scenario seed offsets:

| Scenario | seed |
| --- | --- |
| normal_operation | 42 |
| inverter_cooling_degradation | 142 |
| bess_thermal_risk | 242 |
| weather_false_positive | 342 |
| asset inventory + maintenance + notes | 42 |

### 4.2 Asset Inventory Schema (`data/assets.json`)

Top-level object:

```json
{
  "site": {
    "site_id": "SITE-DS-001",
    "site_name": "Desert Sun Solar + BESS",
    "region": "California Desert",
    "latitude": 34.84,
    "longitude": -116.45,
    "total_capacity_mw": 500,
    "timezone": "America/Los_Angeles"
  },
  "assets": [ /* array of Asset objects */ ]
}
```

Each `Asset` object:

```json
{
  "asset_id": "INV-042",
  "asset_name": "Solar Inverter 042",
  "asset_type": "solar_inverter",
  "site_id": "SITE-DS-001",
  "capacity_mw": 4.0,
  "manufacturer": "SunGrid Power Systems",
  "model": "SG-4000-XT",
  "install_date": "2021-03-14",
  "runtime_hours": 19450,
  "status": "online",
  "parent_asset_id": "TX-003",
  "location_zone": "Block-C Row-07",
  "criticality_score": 0.72,
  "last_maintenance_date": "2025-10-12"
}
```

`asset_type` enum: `solar_inverter | bess_unit | transformer | substation_breaker | weather_station | meter | cooling_system | grid_interconnection_node`.

`status` enum: `online | offline | degraded | maintenance | standby`.

### 4.3 Asset Counts (Exact Inventory)

| asset_type | id range | count | capacity_mw each | parent |
| --- | --- | --- | --- | --- |
| solar_inverter | INV-001..INV-120 | 120 | 4.0 | mapped to TX-001..TX-008 (15 inverters per transformer) |
| bess_unit | BESS-001..BESS-020 | 20 | 5.0 | TX-001..TX-008 (round-robin) |
| transformer | TX-001..TX-008 | 8 | 60.0 | SUB-001 |
| substation_breaker | SUB-001 | 1 | 500.0 | grid_interconnection_node GRID-001 |
| weather_station | WX-001..WX-004 | 4 | 0.0 | SITE-DS-001 |
| meter | MTR-001..MTR-010 | 10 | 0.0 | SUB-001 |
| cooling_system | COOL-001..COOL-120 | 120 | 0.0 | matching INV (cooling subsystem of each inverter) |
| grid_interconnection_node | GRID-001 | 1 | 500.0 | SITE-DS-001 |

Generation rules:
- `runtime_hours`: `int(np.random.uniform(8000, 20000))`. Override `INV-042` to `19450` and `BESS-011` to a high value (`28500`) so they cross risk thresholds.
- `criticality_score`: transformers/substation = `0.85–0.95`, BESS = `0.7–0.85`, inverters = `0.5–0.75`, weather/meter = `0.2–0.4`.
- `manufacturer`/`model`: pick from a fixed list (below) seeded per asset_type so they stay realistic.
- `install_date`: Faker date between `-5y` and `-2y`. `last_maintenance_date`: Faker date within `-12m`.

Fixed manufacturer pools:
- inverters: `["SunGrid Power Systems", "Helios Inverters Inc", "VoltEdge Energy"]`, models `["SG-4000-XT","HX-4100","VE-4000P"]`
- BESS: `["NorthCell Storage", "AmpReserve Systems"]`, models `["NC-5000-LFP","AR-5MWh"]`
- transformers: `["GridCore Transformers", "PowerLink Mfg"]`, models `["GC-60MVA","PL-60T"]`

### 4.4 Manufacturer Notes (`data/manufacturer_notes.json`)

Static domain knowledge used by the Maintenance History Agent.

```json
[
  {
    "note_id": "MN-INV-001",
    "asset_type": "solar_inverter",
    "manufacturer": "SunGrid Power Systems",
    "model": "SG-4000-XT",
    "title": "Cooling fan degradation risk",
    "body": "Cooling fan bearings show elevated failure probability after 18,000 runtime hours. Inspect fan and recalibrate thermal sensors if inverter_temperature_c exceeds 80C under nominal load.",
    "risk_threshold_runtime_hours": 18000,
    "related_symptom": "thermal_derating"
  },
  {
    "note_id": "MN-BESS-001",
    "asset_type": "bess_unit",
    "manufacturer": "NorthCell Storage",
    "model": "NC-5000-LFP",
    "title": "Thermal management loop sensitivity",
    "body": "During active dispatch, cooling loop temperature above 38C combined with cell temperature above 45C indicates thermal management degradation. Escalate immediately if battery_temperature_c exceeds 50C.",
    "risk_threshold_temp_c": 50,
    "related_symptom": "thermal_runaway_risk"
  }
]
```

---

## 5. Kafka Event Design

### 5.1 Topics (Exact)

```text
gridops.asset.telemetry
gridops.scada.alerts
gridops.weather.observations
gridops.production.forecast
gridops.maintenance.records
gridops.workorders
gridops.grid.dispatch
gridops.incident.candidates
gridops.ai.incident_reports
gridops.governance.audit
```

### 5.2 Common Envelope (every message)

```json
{
  "event_id": "evt_8f2c1a90",
  "event_type": "telemetry",
  "source_system": "SCADA",
  "site_id": "SITE-DS-001",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T14:05:00Z",
  "schema_version": "1.0",
  "correlation_id": "corr_inv042_2026061614",
  "payload": {}
}
```

Enums:
- `event_type`: `telemetry | alert | weather | forecast | maintenance | workorder | dispatch | incident | audit`
- `source_system`: `SCADA | CMMS | WeatherAPI | ForecastEngine | GridOpsAI | OperatorConsole`

Pydantic model (`common/envelope.py`):

```python
from pydantic import BaseModel, Field
from typing import Any, Literal

EventType = Literal["telemetry","alert","weather","forecast","maintenance",
                    "workorder","dispatch","incident","audit"]
SourceSystem = Literal["SCADA","CMMS","WeatherAPI","ForecastEngine","GridOpsAI","OperatorConsole"]

class Envelope(BaseModel):
    event_id: str
    event_type: EventType
    source_system: SourceSystem
    site_id: str = "SITE-DS-001"
    asset_id: str | None = None
    timestamp: str            # ISO-8601 Z
    schema_version: str = "1.0"
    correlation_id: str
    payload: dict[str, Any]
```

### 5.3 Topic-by-Topic Specification

#### `gridops.asset.telemetry`
- **Purpose:** periodic asset measurements.
- **Key:** `asset_id`.
- **Frequency:** every `interval-minutes` (default 5 min) per active asset. In demo, only the scenario's focal assets + a small sample of background assets are emitted.
- **Producer:** reads `telemetry_events.jsonl`, publishes in timestamp order.
- **Consumer:** ingestion service updates per-asset rolling window (last 24 points).
- **Payload (solar inverter):**

```json
{
  "event_id": "evt_t_inv042_0007",
  "event_type": "telemetry",
  "source_system": "SCADA",
  "site_id": "SITE-DS-001",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T14:05:00Z",
  "schema_version": "1.0",
  "correlation_id": "corr_inv042_run",
  "payload": {
    "asset_type": "solar_inverter",
    "dc_voltage": 612.4,
    "ac_voltage": 480.2,
    "dc_current": 6.1,
    "ac_current": 4.8,
    "active_power_kw": 3650.0,
    "reactive_power_kvar": 120.0,
    "inverter_temperature_c": 62.1,
    "cabinet_temperature_c": 41.3,
    "cooling_fan_rpm": 2400,
    "conversion_efficiency_pct": 98.1,
    "mppt_efficiency_pct": 99.0,
    "frequency_hz": 60.0,
    "voltage_variance": 0.6,
    "fault_code": null,
    "operating_state": "running"
  }
}
```

High-temperature variant payload (anomaly):

```json
{
  "payload": {
    "asset_type": "solar_inverter",
    "active_power_kw": 2980.0,
    "inverter_temperature_c": 87.4,
    "cabinet_temperature_c": 55.2,
    "cooling_fan_rpm": 1100,
    "conversion_efficiency_pct": 94.2,
    "mppt_efficiency_pct": 97.1,
    "voltage_variance": 2.4,
    "fault_code": "THERMAL_DERATE",
    "operating_state": "derated"
  }
}
```

BESS telemetry payload:

```json
{
  "payload": {
    "asset_type": "bess_unit",
    "state_of_charge_pct": 64.0,
    "state_of_health_pct": 96.5,
    "battery_temperature_c": 47.8,
    "rack_temperature_c": 44.1,
    "cooling_loop_temp_c": 39.5,
    "charge_power_kw": 0.0,
    "discharge_power_kw": 4200.0,
    "cell_voltage_min": 3.21,
    "cell_voltage_max": 3.34,
    "thermal_warning_level": "warning",
    "operating_state": "discharging"
  }
}
```

Transformer telemetry payload:

```json
{
  "payload": {
    "asset_type": "transformer",
    "oil_temperature_c": 68.0,
    "winding_temperature_c": 79.0,
    "load_pct": 72.0,
    "vibration_mm_s": 1.2,
    "dissolved_gas_index": 0.18,
    "tap_position": 3,
    "operating_state": "running"
  }
}
```

Field enums: `operating_state` ∈ `running | derated | standby | charging | discharging | fault | offline`. `thermal_warning_level` ∈ `normal | watch | warning | critical`.

#### `gridops.scada.alerts`
- **Purpose:** discrete threshold/condition alerts.
- **Key:** `asset_id`.
- **Frequency:** event-driven (only when a rule fires).
- **Producer:** reads `alert_events.jsonl`.
- **Consumer:** correlation service buffers alerts per asset within a sliding 60-min window.
- **Payload:**

```json
{
  "event_id": "evt_a_inv042_0003",
  "event_type": "alert",
  "source_system": "SCADA",
  "site_id": "SITE-DS-001",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T14:20:00Z",
  "schema_version": "1.0",
  "correlation_id": "corr_inv042_run",
  "payload": {
    "alert_id": "ALT-INV042-0003",
    "alert_type": "inverter_temperature_high",
    "severity": "high",
    "message": "Inverter temperature 87.4C exceeds high threshold 85C",
    "threshold_value": 85.0,
    "observed_value": 87.4,
    "metric": "inverter_temperature_c",
    "acknowledged": false,
    "correlated_incident_id": null
  }
}
```

`severity` ∈ `info | low | medium | high | critical`. `alert_type` controlled vocabulary (see §8).

#### `gridops.weather.observations`
- **Purpose:** site weather (per weather station, but demo uses WX-001 as the reference).
- **Key:** `asset_id` (weather station) — `site_id` used for site-level joins.
- **Frequency:** every interval-minutes.
- **Payload:**

```json
{
  "event_type": "weather",
  "source_system": "WeatherAPI",
  "asset_id": "WX-001",
  "timestamp": "2026-06-16T14:05:00Z",
  "payload": {
    "irradiance_w_m2": 910.0,
    "ambient_temperature_c": 38.5,
    "wind_speed_m_s": 3.2,
    "humidity_pct": 12.0,
    "cloud_cover_pct": 5.0,
    "precipitation_mm": 0.0,
    "air_pressure_hpa": 1009.0
  }
}
```

#### `gridops.production.forecast`
- **Purpose:** expected vs actual production (site-level + per focal asset).
- **Key:** `site_id` or `asset_id`.
- **Frequency:** every interval-minutes.
- **Payload:**

```json
{
  "event_type": "forecast",
  "source_system": "ForecastEngine",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T14:05:00Z",
  "payload": {
    "expected_output_mw": 3.62,
    "actual_output_mw": 2.98,
    "forecast_error_pct": 17.7,
    "expected_energy_mwh": 0.302,
    "actual_energy_mwh": 0.248,
    "interval_minutes": 5
  }
}
```

#### `gridops.maintenance.records`
- **Purpose:** historical CMMS maintenance records (replayed at scenario start as context, timestamp in the past).
- **Key:** `asset_id`.
- **Frequency:** static; emitted once at start of stream.
- **Payload:** see §9 record schema under `payload`.

#### `gridops.workorders`
- **Purpose:** simulated work-order creation when an incident is approved.
- **Key:** `asset_id`.
- **Frequency:** event-driven (post-governance).
- **Payload:**

```json
{
  "event_type": "workorder",
  "source_system": "CMMS",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T15:10:00Z",
  "payload": {
    "work_order_id": "WO-2026-04412",
    "incident_id": "INC-INV042-20260616",
    "status": "created",
    "priority": "high",
    "assigned_to": "Maria Gonzalez",
    "task": "Inspect cooling fan within 24 hours",
    "created_by": "GridOpsAI",
    "approval_ref": "AUD-0007"
  }
}
```

#### `gridops.grid.dispatch`
- **Purpose:** grid dispatch requests (relevant to BESS scenario).
- **Key:** `asset_id` or `site_id`.
- **Payload:**

```json
{
  "event_type": "dispatch",
  "source_system": "GridOpsAI",
  "asset_id": "BESS-011",
  "timestamp": "2026-06-16T14:00:00Z",
  "payload": {
    "dispatch_id": "DSP-0001",
    "command": "discharge",
    "requested_power_mw": 4.2,
    "duration_minutes": 60,
    "grid_signal": "peak_demand",
    "active": true
  }
}
```

#### `gridops.incident.candidates`
- **Purpose:** correlated alert clusters produced by the correlation service, input to CrewAI.
- **Key:** `asset_id`.
- **Producer:** Incident Correlation Service.
- **Consumer:** CrewAI Workflow Service.
- **Payload:**

```json
{
  "event_type": "incident",
  "source_system": "GridOpsAI",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T14:35:00Z",
  "payload": {
    "candidate_id": "CAND-INV042-0001",
    "asset_id": "INV-042",
    "window_start": "2026-06-16T13:00:00Z",
    "window_end": "2026-06-16T14:35:00Z",
    "grouped_alert_ids": ["ALT-INV042-0001","ALT-INV042-0002","ALT-INV042-0003"],
    "alert_count": 9,
    "max_severity": "high",
    "anomaly_score": 0.87,
    "symptom": "thermal_derating",
    "trigger": "anomaly_score>=0.6 and alert_count>=3"
  }
}
```

#### `gridops.ai.incident_reports`
- **Purpose:** final CrewAI incident reports.
- **Key:** `asset_id`.
- **Payload:** full incident report (see §13.6 / §14 final schema).

#### `gridops.governance.audit`
- **Purpose:** immutable audit log of governance decisions and human actions.
- **Key:** `incident_id`.
- **Payload:**

```json
{
  "event_type": "audit",
  "source_system": "OperatorConsole",
  "asset_id": "INV-042",
  "timestamp": "2026-06-16T15:05:00Z",
  "payload": {
    "audit_id": "AUD-0007",
    "incident_id": "INC-INV042-20260616",
    "action": "approval_requested",
    "actor": "GridOpsAI",
    "decision": null,
    "reason": "Recommended action requires taking inverter offline",
    "requires_human": true
  }
}
```

`action` ∈ `approval_requested | approved | rejected | escalated | workorder_created | acknowledged`.

---

## 6. Telemetry Generation Logic

All series generated with NumPy on a per-interval time grid: `t_0 = anchor`, step = `interval_minutes`, count = `duration_hours*60/interval_minutes`.

General model per metric:

```text
value(t) = baseline(t) + trend(t) + anomaly(t) + noise(t)
```

- `baseline(t)`: solar-day diurnal shape for power; flat-ish for temperatures.
- `trend(t)`: linear/ramp injected for degradation scenarios.
- `anomaly(t)`: scenario-specific step or ramp after `anomaly_start_index`.
- `noise(t)`: `np.random.normal(0, sigma)` with small sigma per metric.

Baselines (nominal inverter at ~91% of capacity midday):
- `active_power_kw`: `capacity_mw*1000 * solar_factor(t)`, `solar_factor` = clipped sine over the day peaking ~0.92.
- `inverter_temperature_c`: `45 + 0.02*active_power_kw/100 + ambient_offset`, nominal 55–65 °C.
- `cooling_fan_rpm`: `2400 ± 100` nominal.
- `conversion_efficiency_pct`: `98.3 ± 0.3`.
- `voltage_variance`: `0.5 ± 0.2`.

### 6.1 Scenario injection rules

**Inverter cooling degradation (INV-042):** Let `k = anomaly_start_index` (≈ 30% into the window).
- `inverter_temperature_c`: add ramp `+ (i-k)*0.9 °C` for `i>=k`, capped at 92 °C.
- `cooling_fan_rpm`: subtract ramp + inject instability `2400 - (i-k)*45 + np.random.normal(0,180)`, floor 800.
- `conversion_efficiency_pct`: subtract `(i-k)*0.12`, floor 92.
- `active_power_kw`: multiply by derate factor `1 - min(0.22,(i-k)*0.006)`.
- `voltage_variance`: add `(i-k)*0.05`.
- `fault_code`: `null` until temp>85 → `THERMAL_DERATE`.
- `operating_state`: `running` → `derated` when temp>85.
- **Communication timeout**: from index `k+8`, drop ~1 in 4 telemetry points (omit row) and emit a `communication_timeout` alert.

**BESS thermal risk (BESS-011):**
- `battery_temperature_c`: baseline `38`, ramp `+ (i-k)*1.1`, crosses 45 then 50.
- `cooling_loop_temp_c`: baseline `34`, ramp `+ (i-k)*0.7`.
- `state_of_charge_pct`: abnormal — discharging under dispatch, drops faster than nominal; add jitter.
- `thermal_warning_level`: `normal`→`watch`(>42)→`warning`(>45)→`critical`(>50).
- Requires an active `gridops.grid.dispatch` discharge event overlapping the window.

**Normal operation:** no anomaly term; small noise only; `forecast_error_pct` stays within ±5%.

**Weather-driven false positive:** site-wide. `cloud_cover_pct` ramps `5 → 70`, `irradiance_w_m2` drops proportionally (`910 → 380`), multiple inverters' `active_power_kw` drop together, but `inverter_temperature_c`, `cooling_fan_rpm`, `voltage_variance` stay nominal. `forecast_error_pct` rises but is explained by irradiance drop (weather-adjusted forecast tracks actual).

### 6.2 Correlated behavior

Temperature rises **before** output drops (offset anomaly start of power by +2 intervals after temperature). This ordering is what the Telemetry Analysis Agent detects as causal evidence.

---

## 7. Alert Generation Logic

Alerts are derived by evaluating rules against each telemetry point during generation (so JSONL alert stream is consistent with telemetry).

Severity levels: `info | low | medium | high | critical`.

### 7.1 Alert rule table (exact)

| rule_id | condition | alert_type | severity |
| --- | --- | --- | --- |
| R1 | `inverter_temperature_c > 75` | `inverter_temperature_high` | medium |
| R2 | `inverter_temperature_c > 85` | `inverter_temperature_high` | high |
| R3 | `cooling_fan_rpm < 1200 and inverter_temperature_c > 80` | `cooling_fan_irregular` | high |
| R4 | `conversion_efficiency_pct < 96` | `efficiency_drop` | medium |
| R5 | `forecast_error_pct > 10 and irradiance stable (|Δ irradiance|<5%)` | `output_below_forecast` | high |
| R6 | `voltage_variance > 2.0` | `voltage_instability` | medium |
| R7 | telemetry gap (missing expected point) | `communication_timeout` | medium |
| R8 | `operating_state == 'derated'` | `performance_degradation` | high |
| R9 | `battery_temperature_c > 45` | `bess_temperature_high` | high |
| R10 | `battery_temperature_c > 50` | `bess_temperature_high` | critical |
| R11 | `cooling_loop_temp_c > 38 and thermal_warning_level in ('warning','critical')` | `bess_cooling_loop_warning` | high |
| R12 | `forecast_error_pct > 10 and cloud_cover_pct rising` | `output_below_forecast_weather` | low |

Rule R12 deliberately tags weather-explained drops as **low** so Scenario D does not escalate.

### 7.2 Alert payload (exact)

```json
{
  "alert_id": "ALT-INV042-0003",
  "alert_type": "cooling_fan_irregular",
  "asset_id": "INV-042",
  "severity": "high",
  "source_system": "SCADA",
  "timestamp": "2026-06-16T14:25:00Z",
  "message": "Cooling fan rpm 1080 with inverter temp 86.2C",
  "threshold_value": 1200,
  "observed_value": 1080,
  "metric": "cooling_fan_rpm",
  "acknowledged": false,
  "correlated_incident_id": null
}
```

Expected grouped-alert counts per scenario: Normal = 0–1 (info), Inverter = 9–12, BESS = 8–12, Weather = 3–6 (all low/info → no incident).

---

## 8. Alert Type Vocabulary (Controlled)

```text
inverter_temperature_high
cooling_fan_irregular
efficiency_drop
output_below_forecast
output_below_forecast_weather
voltage_instability
communication_timeout
performance_degradation
bess_temperature_high
bess_cooling_loop_warning
transformer_thermal
```

---

## 9. Maintenance & Work Order Data

### 9.1 Maintenance record schema (`data/maintenance_records.json` + `maintenance_events.jsonl` payload)

```json
{
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
  "follow_up_required": true,
  "notes": "Recommend fan replacement if temperature issue recurs."
}
```

`issue_type` controlled vocabulary: `cooling_fan_irregularity | thermal_alarm | efficiency_inspection | routine_maintenance | bess_cooling_inspection | sensor_calibration | comms_fault`.

### 9.2 Required seeded records

- **Scenario B (INV-042):** the record above, timestamped ~8 months before anchor (`2025-10-12`). This is the "similar issue 8 months ago" evidence.
- **Scenario C (BESS-011):** two prior records:
  - `MR-BESS011-0001` (`2026-02-20`) `issue_type=bess_cooling_inspection`, notes warn about cooling loop sensitivity under dispatch.
  - `MR-BESS011-0002` (`2026-04-30`) `issue_type=thermal_alarm`, notes prior watch-level thermal events.
- Background noise: ~30 routine_maintenance records across random assets (Faker-generated technician/notes) for realism.

Faker usage: `technician` = `fake.name()`, `notes` phrasing assembled from a controlled template + `fake.sentence()`. `issue_type` is NEVER faked.

---

## 10. Weather & Forecast Generation

- Weather stream from `WX-001` (reference). Other WX assets optional.
- Nominal desert day: high irradiance (~910 W/m² midday), low humidity (10–15%), low cloud cover (<10%), ambient 35–40 °C.
- Forecast engine computes `expected_output_mw` from irradiance using a linear PV model: `expected_output_mw = capacity_mw * (irradiance/1000) * temp_derate(ambient)`, `temp_derate = 1 - 0.004*max(0, ambient-25)`.
- `actual_output_mw` = sum of telemetry `active_power_kw`/1000 for the asset(s).
- `forecast_error_pct = (expected-actual)/expected*100`.
- **Weather-adjusted forecast** (key for distinguishing equipment fault vs weather): recompute expected using *observed* irradiance. If actual still tracks weather-adjusted expected → weather explains it (Scenario D). If actual is below weather-adjusted expected → equipment fault (Scenario B).

---

## 11. Ground-Truth Labels (`data/ground_truth.json`)

```json
[
  {
    "scenario_id": "SCN-A",
    "scenario_name": "Normal Operation",
    "incident_expected": false,
    "affected_asset_id": null,
    "expected_root_cause": "normal_operation",
    "expected_priority": "low",
    "expected_action": "continue_monitoring",
    "approval_required": false,
    "expected_grouped_alerts_min": 0,
    "expected_grouped_alerts_max": 1,
    "expected_energy_impact_mwh_day_min": 0.0,
    "expected_energy_impact_mwh_day_max": 0.2,
    "should_escalate": false
  },
  {
    "scenario_id": "SCN-B",
    "scenario_name": "Inverter Cooling Degradation",
    "incident_expected": true,
    "affected_asset_id": "INV-042",
    "expected_root_cause": "cooling_subsystem_degradation",
    "expected_priority": "high",
    "expected_action": "inspect_cooling_fan_within_24_hours",
    "approval_required": true,
    "expected_grouped_alerts_min": 8,
    "expected_grouped_alerts_max": 14,
    "expected_energy_impact_mwh_day_min": 2.0,
    "expected_energy_impact_mwh_day_max": 3.5,
    "should_escalate": true
  },
  {
    "scenario_id": "SCN-C",
    "scenario_name": "BESS Thermal Management Risk",
    "incident_expected": true,
    "affected_asset_id": "BESS-011",
    "expected_root_cause": "bess_thermal_management_degradation",
    "expected_priority": "critical",
    "expected_action": "escalate_to_site_engineer_and_inspect_cooling_loop_immediately",
    "approval_required": true,
    "expected_grouped_alerts_min": 8,
    "expected_grouped_alerts_max": 12,
    "expected_energy_impact_mwh_day_min": 0.0,
    "expected_energy_impact_mwh_day_max": 5.0,
    "should_escalate": true
  },
  {
    "scenario_id": "SCN-D",
    "scenario_name": "Weather-Driven False Positive",
    "incident_expected": false,
    "affected_asset_id": null,
    "expected_root_cause": "weather_driven_output_reduction",
    "expected_priority": "low",
    "expected_action": "continue_monitoring",
    "approval_required": false,
    "expected_grouped_alerts_min": 0,
    "expected_grouped_alerts_max": 6,
    "expected_energy_impact_mwh_day_min": 0.0,
    "expected_energy_impact_mwh_day_max": 1.0,
    "should_escalate": false
  }
]
```

Controlled vocabularies:
- `expected_root_cause`: `normal_operation | cooling_subsystem_degradation | bess_thermal_management_degradation | weather_driven_output_reduction`
- `expected_priority`: `low | medium | high | critical`
- `expected_action`: `continue_monitoring | inspect_cooling_fan_within_24_hours | escalate_to_site_engineer_and_inspect_cooling_loop_immediately`

---

## 12. Synthetic Data Generator (`scripts/generate_synthetic_data.py`)

### 12.1 CLI

```bash
python scripts/generate_synthetic_data.py --scenario inverter_cooling_degradation --duration-hours 6 --interval-minutes 5
python scripts/generate_synthetic_data.py --all
python scripts/generate_synthetic_data.py --all --duration-hours 6 --interval-minutes 5
```

Arguments:
- `--scenario {normal_operation,inverter_cooling_degradation,bess_thermal_risk,weather_false_positive}`
- `--all` (generate all four)
- `--duration-hours` (default 6)
- `--interval-minutes` (default 5)
- `--seed` (default 42)
- `--anchor` (default `2026-06-16T13:00:00Z`)

### 12.2 Outputs

```text
data/assets.json
data/manufacturer_notes.json
data/maintenance_records.json
data/ground_truth.json
data/scenarios/<scenario>/telemetry_events.jsonl
data/scenarios/<scenario>/alert_events.jsonl
data/scenarios/<scenario>/weather_events.jsonl
data/scenarios/<scenario>/forecast_events.jsonl
data/scenarios/<scenario>/maintenance_events.jsonl
data/scenarios/<scenario>/grid_dispatch_events.jsonl
```

### 12.3 Module structure (functions to implement)

```python
def build_assets(seed) -> dict            # writes assets.json
def build_manufacturer_notes() -> list    # static, writes manufacturer_notes.json
def build_maintenance_records(seed, assets) -> list
def build_ground_truth() -> list
def time_grid(anchor, duration_hours, interval_minutes) -> list[datetime]
def gen_inverter_telemetry(asset, grid, scenario, seed) -> list[Envelope]
def gen_bess_telemetry(asset, grid, scenario, seed) -> list[Envelope]
def gen_weather(grid, scenario, seed) -> list[Envelope]
def gen_forecast(asset, telemetry, weather, scenario) -> list[Envelope]
def gen_dispatch(asset, grid, scenario) -> list[Envelope]
def derive_alerts(telemetry, weather, forecast) -> list[Envelope]  # applies §7 rules
def write_jsonl(path, envelopes)
def run_scenario(scenario, args)
def main()
```

Each scenario writes only the focal asset(s) + a small set of background assets (5 inverters) to keep files small and demo-fast.

Required libraries: `faker`, `numpy`, `pandas`, `python-dateutil`. Optional: `confluent-kafka`, `kafka-python`, `pydantic`, `scikit-learn`.

---

## 13. Kafka Simulation & Backend Services

### 13.1 Mode 1 — Hackathon Simple Mode (PRIMARY)

JSONL files act as Kafka logs. `scripts/produce_events.py` merges all six per-scenario JSONL files, sorts by `timestamp`, and feeds the ingestion service either by HTTP POST or in-process call. No broker required.

`produce_events.py` CLI:

```bash
python scripts/produce_events.py --scenario inverter_cooling_degradation --speed 20 --sink http://localhost:8002/ingest
python scripts/produce_events.py --scenario inverter_cooling_degradation --speed 20 --sink stdout
```

- `--speed`: time compression multiplier (20 = 1 sim-minute per 3 real-seconds basis; sleeps `delta_seconds/speed`).
- `--sink`: `http://...` POST each envelope, or `stdout`, or `file:...`.
- Preserves timestamp ordering; key = `asset_id` (or `site_id` when asset null).

### 13.2 Mode 2 — Kafka Local Mode (OPTIONAL)

`docker-compose.yml` runs Redpanda. `produce_events.py --transport kafka` publishes to topics; `consume_events.py` subscribes. Same envelope. Topic list in `deployment/kafka_topics.md`. Only attempt if core deliverables are green.

### 13.3 Data Generator Service
Covered by `scripts/generate_synthetic_data.py` (§12). Not a long-running service.

### 13.4 Event Ingestion Service (`services/ingestion_service/`, port 8002)
- FastAPI. `POST /ingest` accepts one `Envelope`.
- `event_router.py`: dispatch by `event_type` to handlers.
- `state_store.py`: in-memory dict keyed by `asset_id` holding rolling telemetry window (deque maxlen 48), recent alerts (60-min window), latest weather, latest forecast, active dispatch.
- `correlation.py`: see §13.6.
- Endpoints:
  - `POST /ingest` → `{ "status": "ok", "candidates_emitted": 0|1 }`
  - `GET /state/{asset_id}` → current window (debug)
  - `GET /candidates` → list of open incident candidates

### 13.5 Anomaly Scoring Service (`services/anomaly_service/`, port 8001 — TrueFoundry-deployed)
- FastAPI. `POST /score`.
- **Input:**

```json
{
  "asset_id": "INV-042",
  "asset_type": "solar_inverter",
  "telemetry_window": [ /* last N telemetry payloads */ ],
  "alerts": [ /* recent alert payloads */ ],
  "weather": { /* latest weather payload */ },
  "forecast": { /* latest forecast payload */ }
}
```

- **Output (exact):**

```json
{
  "asset_id": "INV-042",
  "anomaly_score": 0.87,
  "severity": "high",
  "symptom": "thermal_derating",
  "confidence": 0.81,
  "features": {
    "temperature_delta_pct": 18.0,
    "forecast_deviation_pct": 11.0,
    "cooling_fan_instability": true,
    "voltage_variance_increase": true
  }
}
```

- **`scoring.py` (rule-based MVP):** compute features in `features.py`, then weighted score:

```text
score = 0.35*norm(temperature_delta_pct, 0..25)
      + 0.25*norm(forecast_deviation_pct, 0..20)
      + 0.20*cooling_fan_instability(bool)
      + 0.10*voltage_variance_increase(bool)
      + 0.10*efficiency_drop(bool)
severity = critical if score>=0.85 else high if >=0.6 else medium if >=0.4 else low
symptom  = thermal_derating | thermal_runaway_risk | weather_driven | nominal (decision tree)
confidence = clip(0.5 + 0.4*(#corroborating_features/4), 0..0.95)
```

- BESS variant uses `battery_temperature_c`, `cooling_loop_temp_c`, dispatch-active flag; symptom `thermal_runaway_risk`.
- Weather variant: if forecast deviation is explained by irradiance drop (weather-adjusted deviation < 5%), symptom = `weather_driven`, score < 0.4.
- **Optional ML:** IsolationForest in `scoring.py` behind `USE_ML=false` flag, trained on nominal windows. Off by default.

### 13.6 Incident Correlation Service (`correlation.py` inside ingestion service)
- Buffers alerts per `asset_id` over a 60-min sliding window.
- On each new alert, call anomaly service `/score`.
- **Trigger rule:** emit an incident candidate to `gridops.incident.candidates` when `anomaly_score >= 0.6 AND alert_count >= 3`. (For BESS critical: also trigger on any `critical` severity alert.)
- Candidate payload as in §5.3. Deduplicate: one open candidate per asset per scenario window.

### 13.7 CrewAI Workflow Service (`agents/crew.py`, port 8003)
- FastAPI wrapper: `POST /run_incident` accepts an incident candidate + assembled context, runs the crew, returns the final incident report, and publishes to `gridops.ai.incident_reports` and governance audit.
- Endpoints:
  - `POST /run_incident` → final incident report JSON (§14.4)
  - `GET /health`

### 13.8 Incident Report API (`services/incident_api/`, port 8000)
- FastAPI. Read store of generated reports (file or in-memory).
- Endpoints (frontend-facing):
  - `GET /api/incidents` → list of report summaries
  - `GET /api/incidents/{incident_id}` → full report (§14.4)
  - `POST /api/incidents/{incident_id}/decision` body `{ "decision": "approved|rejected", "actor": "operator_name" }` → writes governance audit, creates simulated work order if approved
  - `GET /api/audit/{incident_id}` → audit trail
  - `GET /api/scenarios` → available scenarios + status

Port map: incident_api `8000`, anomaly `8001`, ingestion `8002`, crew `8003`.

---

## 14. CrewAI Agent Plan

### 14.1 LLM routing (`agents/llm.py`)
All LLM calls use an OpenAI-compatible client pointed at the TrueFoundry AI Gateway:

```python
import os
from crewai import LLM

def gateway_llm(model="openai/gpt-4o-mini", temperature=0.1):
    return LLM(
        model=model,
        base_url=os.environ["TFY_GATEWAY_BASE_URL"],   # e.g. https://<org>.truefoundry.cloud/api/llm
        api_key=os.environ["TFY_API_KEY"],
        temperature=temperature,
    )
```

`.env.example` keys: `TFY_GATEWAY_BASE_URL`, `TFY_API_KEY`, `ENERGY_PRICE_PER_MWH=75`, `GRIDOPS_SEED=42`, `ANOMALY_SERVICE_URL=http://localhost:8001`.

### 14.2 Tools (`agents/tools.py`) — exact signatures

```python
@tool def query_telemetry_window(asset_id: str, start_time: str, end_time: str) -> dict
@tool def query_alerts(asset_id: str, window_minutes: int = 60) -> list
@tool def query_maintenance_history(asset_id: str) -> list
@tool def query_weather_context(site_id: str, window_minutes: int = 60) -> dict
@tool def query_forecast_vs_actual(site_id_or_asset_id: str, window_minutes: int = 60) -> dict
@tool def call_truefoundry_anomaly_service(payload: dict) -> dict
@tool def calculate_business_impact(expected_mwh: float, actual_mwh: float, energy_price: float = 75.0) -> dict
@tool def apply_governance_rules(incident: dict) -> dict
```

Tool data sources: telemetry/alerts/weather/forecast/maintenance read from the ingestion state store (HTTP) or directly from the scenario JSONL/`data/*.json` files in simple mode.

`calculate_business_impact` returns:

```json
{ "energy_loss_mwh_per_day": 2.8, "revenue_loss_usd_per_day": 210.0, "energy_price_per_mwh": 75.0 }
```

`apply_governance_rules` returns:

```json
{ "approval_required": true, "auto_executable": false, "reason": "Action requires taking asset offline", "escalation_level": "site_engineer" }
```

Governance rule logic (deterministic):
- Any action implying offline/disconnect OR priority ∈ {high, critical} → `approval_required=true`.
- priority == critical OR symptom == thermal_runaway_risk → `escalation_level=site_engineer`, `requires_immediate=true`.
- priority == low → `approval_required=false`, `auto_executable=true` (just continue monitoring).

### 14.3 Agents (`agents/agents.yaml`) — exact definitions

| # | Agent | Role | Goal | Inputs | Tools | Behavior | Model |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Alert Correlation Agent | Groups raw alerts into coherent clusters | Confirm which alerts belong to one physical problem | candidate alert_ids, alerts | `query_alerts` | **Deterministic** (rule + LLM tiebreak) | gpt-4o-mini |
| 2 | Telemetry Analysis Agent | Reads telemetry window, finds trends/ordering | Detect thermal ramp, fan instability, output drop and their time ordering | telemetry window | `query_telemetry_window`, `call_truefoundry_anomaly_service` | LLM-assisted over deterministic features | gpt-4o-mini |
| 3 | Maintenance History Agent | Looks up past records + manufacturer notes | Find recurring/known failure patterns | asset_id | `query_maintenance_history` | LLM over retrieved records | gpt-4o-mini |
| 4 | Weather & Forecast Agent | Determines if weather explains the loss | Separate equipment fault from weather effect | site/asset, window | `query_weather_context`, `query_forecast_vs_actual` | **Deterministic** weather-adjusted check + LLM summary | gpt-4o-mini |
| 5 | Root Cause Agent | Synthesizes evidence into one root cause | Produce single root_cause + evidence list | outputs of 1–4 | none (reasons over context) | LLM | gpt-4o-mini |
| 6 | Business Impact Agent | Quantifies impact | Compute MWh/day + $/day loss | forecast vs actual | `calculate_business_impact` | **Deterministic** | gpt-4o-mini |
| 7 | Maintenance Recommendation Agent | Recommends concrete action | Map root cause → standardized action | root cause, criticality | none | LLM constrained to action vocab | gpt-4o-mini |
| 8 | Safety/Governance Agent | Applies governance rules | Decide approval/escalation | incident draft | `apply_governance_rules` | **Deterministic** | gpt-4o-mini |
| 9 | Operator Briefing Agent | Writes the final human-readable briefing | Produce concise operator summary | full incident | none | LLM | gpt-4o |

### 14.4 Per-agent output schemas

**Agent 1 (Alert Correlation):**
```json
{ "grouped_alert_ids": ["..."], "alert_count": 9, "max_severity": "high", "cluster_rationale": "..." }
```
**Agent 2 (Telemetry Analysis):**
```json
{ "symptom": "thermal_derating", "temperature_trend": "rising",
  "temperature_before_output_drop": true, "fan_instability": true,
  "efficiency_drop_pct": 4.1, "anomaly_score": 0.87, "confidence": 0.81 }
```
**Agent 3 (Maintenance History):**
```json
{ "similar_past_issue": true, "last_similar_record_id": "MR-INV042-0001",
  "months_since": 8, "runtime_hours": 19450, "runtime_above_risk_threshold": true,
  "manufacturer_note_id": "MN-INV-001" }
```
**Agent 4 (Weather & Forecast):**
```json
{ "weather_explains_loss": false, "weather_adjusted_deviation_pct": 11.2,
  "irradiance_stable": true, "cloud_cover_pct": 6.0 }
```
**Agent 5 (Root Cause):**
```json
{ "root_cause": "cooling_subsystem_degradation", "confidence": 0.83,
  "evidence": [
    {"evidence_id":"EV-1","text":"Temperature increased before output dropped.","source":"telemetry"},
    {"evidence_id":"EV-2","text":"Efficiency dropped below normal operating range.","source":"telemetry"},
    {"evidence_id":"EV-3","text":"Actual output below weather-adjusted forecast.","source":"forecast"},
    {"evidence_id":"EV-4","text":"Weather does not explain the loss.","source":"weather"},
    {"evidence_id":"EV-5","text":"Similar cooling fan issue 8 months ago.","source":"maintenance"},
    {"evidence_id":"EV-6","text":"Runtime above fan-risk threshold (>18,000h).","source":"manufacturer_note"}
  ] }
```
**Agent 6 (Business Impact):**
```json
{ "energy_loss_mwh_per_day": 2.8, "revenue_loss_usd_per_day": 210.0, "basis": "forecast_vs_actual" }
```
**Agent 7 (Recommendation):**
```json
{ "recommended_action": "inspect_cooling_fan_within_24_hours", "action_window_hours": 24, "priority": "high" }
```
**Agent 8 (Governance):**
```json
{ "approval_required": true, "auto_executable": false, "escalation_level": "site_engineer",
  "requires_immediate": false, "reason": "Action may require taking inverter offline" }
```
**Agent 9 (Operator Briefing):** the final assembled report.

### 14.5 Final Incident Report (published to `gridops.ai.incident_reports`; returned by Incident Report API)

```json
{
  "incident_id": "INC-INV042-20260616",
  "scenario_id": "SCN-B",
  "site_id": "SITE-DS-001",
  "asset_id": "INV-042",
  "asset_name": "Solar Inverter 042",
  "created_at": "2026-06-16T14:40:00Z",
  "status": "awaiting_approval",
  "title": "Cooling subsystem degradation on Solar Inverter INV-042",
  "root_cause": "cooling_subsystem_degradation",
  "priority": "high",
  "confidence": 0.83,
  "symptom": "thermal_derating",
  "anomaly_score": 0.87,
  "grouped_alert_ids": ["ALT-INV042-0001","ALT-INV042-0002","ALT-INV042-0003"],
  "alert_count": 9,
  "evidence": [
    {"evidence_id":"EV-1","text":"Temperature increased before output dropped.","source":"telemetry"},
    {"evidence_id":"EV-2","text":"Efficiency dropped below normal operating range.","source":"telemetry"},
    {"evidence_id":"EV-3","text":"Actual output below weather-adjusted forecast.","source":"forecast"},
    {"evidence_id":"EV-4","text":"Weather does not explain the loss.","source":"weather"},
    {"evidence_id":"EV-5","text":"Similar cooling fan issue 8 months ago.","source":"maintenance"},
    {"evidence_id":"EV-6","text":"Runtime above fan-risk threshold (>18,000h).","source":"manufacturer_note"}
  ],
  "business_impact": {
    "energy_loss_mwh_per_day": 2.8,
    "revenue_loss_usd_per_day": 210.0,
    "energy_price_per_mwh": 75.0
  },
  "recommended_action": "inspect_cooling_fan_within_24_hours",
  "action_window_hours": 24,
  "governance": {
    "approval_required": true,
    "auto_executable": false,
    "escalation_level": "site_engineer",
    "requires_immediate": false,
    "decision": null,
    "audit_id": "AUD-0007"
  },
  "operator_briefing": "INV-042 shows progressive cooling subsystem degradation...",
  "trace": {
    "tfy_trace_id": "trace_abc123",
    "llm_calls": 6,
    "total_latency_ms": 8400,
    "total_cost_usd": 0.012
  }
}
```

### 14.6 Crew orchestration (`agents/crew.py`)
- **Process:** sequential. Order: 1 → (2,3,4) → 5 → 6 → 7 → 8 → 9.
- Agents 2,3,4 are independent; run sequentially in simple mode (parallel optional).
- Each task in `tasks.yaml` declares `expected_output` matching the schemas above and `output_json` Pydantic models for structured parsing.
- The crew returns the §14.5 report. The service injects `trace` from gateway response metadata.

`tasks.yaml` defines one task per agent with `description`, `expected_output`, `agent`, and `context` (list of upstream task names) wiring the dependency graph above.

---

## 15. TrueFoundry Architecture

```text
JSONL/Kafka Events
        ↓
Event Ingestion Service (local or TFY)
        ↓
TrueFoundry Anomaly Scoring Service (deployed)
        ↓
Incident Correlation
        ↓
CrewAI Workflow Service (local or TFY)
        ↓
TrueFoundry AI Gateway  ──►  LLM Providers
        ↓
Incident Report API  ──►  Frontend
        ↓
Governance/Audit + Evaluation
```

Usage (decisions):
1. **Deploy the anomaly scoring service to TrueFoundry** using `deployment/truefoundry.yaml` (FastAPI service, exposes `/score`). This is the showcased production service.
2. **Route every LLM call through the TrueFoundry AI Gateway** via `agents/llm.py` (`TFY_GATEWAY_BASE_URL`). This gives cost/latency/trace observability for free.
3. **Track** model calls, latency, cost, and traces via the gateway dashboard; surface `trace` block in each incident report.
4. **Deploy the CrewAI workflow service** to TrueFoundry if time allows; otherwise run locally with gateway-routed LLM calls (observability still works).
5. **Demo** the TrueFoundry observability dashboard (gateway request log + anomaly service metrics) live.

`deployment/truefoundry.yaml` (service spec sketch):
```yaml
name: gridops-anomaly-service
type: service
image:
  type: build
  build_spec:
    type: dockerfile
    dockerfile_path: services/anomaly_service/Dockerfile
ports:
  - port: 8001
    protocol: TCP
    expose: true
resources:
  cpu_request: 0.2
  cpu_limit: 0.5
  memory_request: 256
  memory_limit: 512
env:
  USE_ML: "false"
```

**Fallback plan (if TFY deployment stalls):**
- Run all services locally (`make run-all`).
- Keep API interfaces TFY-compatible (no code change needed to deploy later).
- If the gateway is reachable, still route LLM calls through it (primary path).
- If the gateway is unreachable, fall back to a direct provider key but keep `agents/llm.py` interface identical; show architecture diagram + a captured/mock trace JSON in the demo.

---

## 16. Evaluation Plan

### 16.1 Metrics (`evaluation/metrics.py`)
- Alert grouping accuracy: `expected_grouped_alerts_min <= alert_count <= max`.
- Root cause match: `report.root_cause == gt.expected_root_cause`.
- Priority match: `report.priority == gt.expected_priority`.
- Recommended action match: `report.recommended_action == gt.expected_action`.
- Approval rule accuracy: `report.governance.approval_required == gt.approval_required`.
- False escalation rate: fraction of non-incident scenarios that produced an incident.
- Business impact within range: `min <= energy_loss_mwh_per_day <= max`.
- Latency per incident: from `trace.total_latency_ms`.
- Cost per incident: from `trace.total_cost_usd`.

### 16.2 Runner (`evaluation/run_eval.py`)

```bash
python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json
```

Per-scenario output:
```json
{
  "scenario_id": "SCN-B",
  "incident_detected": true,
  "alert_grouping_match": true,
  "root_cause_match": true,
  "priority_match": true,
  "action_match": true,
  "approval_match": true,
  "business_impact_within_range": true,
  "latency_ms": 8400,
  "cost_usd": 0.012,
  "overall_result": "pass"
}
```

Aggregate output: `{ "scenarios": 4, "passed": 4, "root_cause_accuracy": 1.0, "false_escalation_rate": 0.0, "avg_latency_ms": ..., "avg_cost_usd": ... }`.

`overall_result == "pass"` requires root_cause, priority, action, approval, and incident-detection all matching.

---

## 17. Implementation Timeline (5 hours, 3–5 people)

| Time | Data Eng | CrewAI Eng | TFY/Deploy Eng | Backend/API Eng | Demo Owner |
| --- | --- | --- | --- | --- | --- |
| 0:00–0:30 | Repo skeleton, `assets.json`, envelope/schemas | Read plan, scaffold `crew.py`, agents.yaml | Set up TFY account, gateway key, test LLM call | FastAPI skeletons for 3 services | Draft demo script outline |
| 0:30–1:30 | Implement generator (telemetry+alerts+weather+forecast), Scenario B+A | Implement tools.py + agents 1–4 | Dockerfile + deploy anomaly service to TFY | Ingestion service + state store | Architecture diagram |
| 1:30–2:30 | Scenarios C+D, ground_truth.json, maintenance records | Agents 5–9, wire sequential crew | Verify anomaly `/score` live; gateway tracing | Correlation service + candidate emission | Demo narrative draft |
| 2:30–3:30 | Validate JSONL ordering, produce_events.py | Run crew end-to-end on Scenario B, fix output JSON | Connect crew LLM to gateway, confirm traces | Incident Report API + decision/audit | Dry-run demo on Scenario B |
| 3:30–4:15 | Background asset noise, polish data | Run all 4 scenarios, generate eval reports | Optional: deploy crew service to TFY | Wire `/api/*` endpoints to store | Eval script run + metrics |
| 4:15–5:00 | Buffer/Kafka (optional) | Tune prompts so eval passes | Capture TFY dashboard screenshots | README + run instructions | Final demo rehearsal |

Priority order: 1) generator, 2) JSONL streams, 3) rule-based anomaly service, 4) CrewAI workflow, 5) TFY gateway integration, 6) eval script, 7) optional Kafka.

---

## 18. Hackathon Simplifications (Decisions)

Do:
- Synthetic data only (no real SCADA).
- JSONL event streams as primary transport.
- Rule-based anomaly scoring.
- Static manufacturer notes and maintenance logs.
- Deterministic, seeded scenarios.
- Simulated work-order creation and governance/audit logs.

Do NOT:
- Build real grid control.
- Claim certified diagnosis.
- Connect to real energy assets.
- Overbuild Kafka if it risks the demo.
- Spend time training ML models (IsolationForest stays optional/off).

---

## 19. Run Commands (Makefile targets)

```makefile
setup:        pip install -r requirements.txt
gen-data:     python scripts/generate_synthetic_data.py --all
run-anomaly:  uvicorn services.anomaly_service.main:app --port 8001
run-ingest:   uvicorn services.ingestion_service.main:app --port 8002
run-crew:     uvicorn agents.crew:app --port 8003
run-api:      uvicorn services.incident_api.main:app --port 8000
produce:      python scripts/produce_events.py --scenario inverter_cooling_degradation --speed 20 --sink http://localhost:8002/ingest
eval:         python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json
```

End-to-end demo sequence:
```bash
make setup && make gen-data
# terminals: make run-anomaly | make run-ingest | make run-crew | make run-api
make produce            # streams Scenario B; ingestion → anomaly → candidate → crew → report
curl localhost:8000/api/incidents
curl -X POST localhost:8000/api/incidents/INC-INV042-20260616/decision -d '{"decision":"approved","actor":"operator"}'
make eval
```

---

## 20. requirements.txt (pinned-minor)

```text
fastapi>=0.110
uvicorn[standard]>=0.29
pydantic>=2.6
crewai>=0.80
crewai-tools>=0.12
faker>=24.0
numpy>=1.26
pandas>=2.2
python-dateutil>=2.9
requests>=2.31
python-dotenv>=1.0
# optional
scikit-learn>=1.4
confluent-kafka>=2.3
```

---

## 21. Final Deliverables Checklist

- [ ] `scripts/generate_synthetic_data.py` producing all `data/` outputs deterministically.
- [ ] `data/assets.json`, `manufacturer_notes.json`, `maintenance_records.json`, `ground_truth.json`.
- [ ] Four scenario folders with six JSONL streams each (Kafka-shaped envelopes).
- [ ] `produce_events.py` / `consume_events.py` (Mode 1 primary, Mode 2 optional).
- [ ] TrueFoundry-deployable anomaly scoring service (`/score`).
- [ ] CrewAI 9-agent workflow producing the §14.5 incident report.
- [ ] Incident Report API with decision + audit endpoints.
- [ ] Evaluation script + metrics passing all four scenarios.
- [ ] LLM calls routed through TrueFoundry AI Gateway with trace data.
- [ ] `docs/architecture.md`, `docs/data_contracts.md`, `docs/demo_script.md`, README.
