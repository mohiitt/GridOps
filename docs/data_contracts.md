# GridOps Copilot — Data Contracts

## Common Envelope (all events)

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
  "payload": {}
}
```

`event_type` ∈ `telemetry | alert | weather | forecast | maintenance | workorder | dispatch | incident | audit`

## Kafka Topics

See `deployment/kafka_topics.md` for the full topic list.

## Anomaly Score API

**Request:** `POST /score`
```json
{
  "asset_id": "INV-042",
  "asset_type": "solar_inverter",
  "telemetry_window": [...],
  "alerts": [...],
  "weather": {...},
  "forecast": {...}
}
```

**Response:**
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

## Incident Report (§14.5)

See the full schema in `services/incident_api/schemas.py`.

Key fields:
- `incident_id`: e.g., `INC-INV042-20260616`
- `root_cause` ∈ `normal_operation | cooling_subsystem_degradation | bess_thermal_management_degradation | weather_driven_output_reduction`
- `priority` ∈ `low | medium | high | critical`
- `recommended_action` ∈ `continue_monitoring | inspect_cooling_fan_within_24_hours | escalate_to_site_engineer_and_inspect_cooling_loop_immediately`

## Ground Truth Scenarios

| ID | Name | incident_expected | affected_asset |
|----|------|------------------|----------------|
| SCN-A | Normal Operation | false | null |
| SCN-B | Inverter Cooling Degradation | true | INV-042 |
| SCN-C | BESS Thermal Management Risk | true | BESS-011 |
| SCN-D | Weather-Driven False Positive | false | null |
