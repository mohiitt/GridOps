# GridOps Copilot — Architecture

## Overview

GridOps Copilot converts high-volume, disconnected grid signals into a single explainable incident per asset cluster.

```
Synthetic Data Generator (scripts/generate_synthetic_data.py)
        ↓ JSONL event streams (6 files × 4 scenarios)
Event Ingestion Service (port 8002)  ──► In-memory Asset State Store
        ↓ on each alert
TrueFoundry Anomaly Scoring Service (port 8001, TFY-deployed)
        ↓ score ≥ 0.6 AND alert_count ≥ 3
Incident Correlation → Candidate Emitted
        ↓
CrewAI Workflow Service (port 8003) — 9 agents sequential
        ↓ all LLM calls
TrueFoundry AI Gateway ──► LLM Providers (GPT-4o-mini / GPT-4o)
        ↓
Incident Report API (port 8000)  ──► Frontend
        ↓
Governance / Audit Store + Evaluation Harness
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `services/incident_api` | 8000 | Frontend-facing REST API |
| `services/anomaly_service` | 8001 | Rule-based anomaly scorer (TFY-deployed) |
| `services/ingestion_service` | 8002 | Event ingestion + correlation |
| `agents/crew.py` | 8003 | CrewAI 9-agent workflow |

## Event Transport

**Mode 1 (Primary):** JSONL simulation — `produce_events.py` merges 6 per-scenario files, sorts by timestamp, POSTs to ingestion service. No broker required.

**Mode 2 (Optional):** Kafka/Redpanda — same envelope flows through topics. Only attempt after Mode 1 passes.

## CrewAI Agents (Sequential)

1. Alert Correlation Agent — groups alerts into coherent cluster
2. Telemetry Analysis Agent — detects thermal ramp, fan instability, time ordering
3. Maintenance History Agent — finds prior similar failures + manufacturer notes
4. Weather & Forecast Agent — separates equipment fault from weather effect
5. Root Cause Agent — synthesizes evidence into one root cause
6. Business Impact Agent — computes MWh/day + $/day loss
7. Maintenance Recommendation Agent — maps to standardized action
8. Safety/Governance Agent — applies approval/escalation rules
9. Operator Briefing Agent — writes human-readable briefing (uses GPT-4o)

## TrueFoundry Integration

- Anomaly scoring service deployed to TrueFoundry (see `deployment/truefoundry.yaml`)
- All LLM calls routed through TrueFoundry AI Gateway for cost/latency/trace observability
- Gateway traces surfaced in `report.trace` block
