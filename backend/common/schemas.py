"""Pydantic v2 payload schemas for every Kafka topic."""
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel


OperatingState = Literal["running", "derated", "standby", "charging", "discharging", "fault", "offline"]
ThermalWarningLevel = Literal["normal", "watch", "warning", "critical"]
Severity = Literal["info", "low", "medium", "high", "critical"]

AlertType = Literal[
    "inverter_temperature_high",
    "cooling_fan_irregular",
    "efficiency_drop",
    "output_below_forecast",
    "output_below_forecast_weather",
    "voltage_instability",
    "communication_timeout",
    "performance_degradation",
    "bess_temperature_high",
    "bess_cooling_loop_warning",
    "transformer_thermal",
]


# ── gridops.asset.telemetry ──────────────────────────────────────────────────

class InverterTelemetryPayload(BaseModel):
    asset_type: Literal["solar_inverter"] = "solar_inverter"
    dc_voltage: float
    ac_voltage: float
    dc_current: float
    ac_current: float
    active_power_kw: float
    reactive_power_kvar: float
    inverter_temperature_c: float
    cabinet_temperature_c: float
    cooling_fan_rpm: int
    conversion_efficiency_pct: float
    mppt_efficiency_pct: float
    frequency_hz: float
    voltage_variance: float
    fault_code: Optional[str]
    operating_state: OperatingState


class BESSTelemetryPayload(BaseModel):
    asset_type: Literal["bess_unit"] = "bess_unit"
    state_of_charge_pct: float
    state_of_health_pct: float
    battery_temperature_c: float
    rack_temperature_c: float
    cooling_loop_temp_c: float
    charge_power_kw: float
    discharge_power_kw: float
    cell_voltage_min: float
    cell_voltage_max: float
    thermal_warning_level: ThermalWarningLevel
    operating_state: OperatingState


class TransformerTelemetryPayload(BaseModel):
    asset_type: Literal["transformer"] = "transformer"
    oil_temperature_c: float
    winding_temperature_c: float
    load_pct: float
    vibration_mm_s: float
    dissolved_gas_index: float
    tap_position: int
    operating_state: OperatingState


# ── gridops.scada.alerts ──────────────────────────────────────────────────────

class AlertPayload(BaseModel):
    alert_id: str
    alert_type: AlertType
    asset_id: str
    severity: Severity
    source_system: str
    timestamp: str
    message: str
    threshold_value: float
    observed_value: float
    metric: str
    acknowledged: bool = False
    correlated_incident_id: Optional[str] = None


# ── gridops.weather.observations ─────────────────────────────────────────────

class WeatherPayload(BaseModel):
    irradiance_w_m2: float
    ambient_temperature_c: float
    wind_speed_m_s: float
    humidity_pct: float
    cloud_cover_pct: float
    precipitation_mm: float
    air_pressure_hpa: float


# ── gridops.production.forecast ───────────────────────────────────────────────

class ForecastPayload(BaseModel):
    expected_output_mw: float
    actual_output_mw: float
    forecast_error_pct: float
    expected_energy_mwh: float
    actual_energy_mwh: float
    interval_minutes: int


# ── gridops.maintenance.records ───────────────────────────────────────────────

class MaintenanceRecordPayload(BaseModel):
    record_id: str
    asset_id: str
    work_order_id: str
    timestamp: str
    technician: str
    issue_type: str
    description: str
    resolution: str
    parts_replaced: list[str]
    downtime_hours: float
    follow_up_required: bool
    notes: str


# ── gridops.workorders ────────────────────────────────────────────────────────

class WorkOrderPayload(BaseModel):
    work_order_id: str
    incident_id: str
    status: str
    priority: str
    assigned_to: str
    task: str
    created_by: str
    approval_ref: str


# ── gridops.grid.dispatch ─────────────────────────────────────────────────────

class DispatchPayload(BaseModel):
    dispatch_id: str
    command: str
    requested_power_mw: float
    duration_minutes: int
    grid_signal: str
    active: bool


# ── gridops.incident.candidates ───────────────────────────────────────────────

class IncidentCandidatePayload(BaseModel):
    candidate_id: str
    asset_id: str
    window_start: str
    window_end: str
    grouped_alert_ids: list[str]
    alert_count: int
    max_severity: Severity
    anomaly_score: float
    symptom: str
    trigger: str


# ── gridops.governance.audit ──────────────────────────────────────────────────

GovernanceAction = Literal[
    "approval_requested", "approved", "rejected",
    "escalated", "workorder_created", "acknowledged"
]


class AuditPayload(BaseModel):
    audit_id: str
    incident_id: str
    action: GovernanceAction
    actor: str
    decision: Optional[str] = None
    reason: str
    requires_human: bool
