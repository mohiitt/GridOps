# GridOps Copilot — Production Readiness Assessment

> **TrueFoundry × CrewAI Hackathon — Desert Sun Solar + BESS (500 MW)**  
> Real-time AI-powered operations platform for renewable energy infrastructure.

---

## Executive Summary

GridOps Copilot demonstrates a production-grade architecture for autonomous incident
management in utility-scale renewable energy facilities. The system ingests real-time
sensor telemetry, detects anomalies, and deploys a 9-agent CrewAI crew — all routed
through TrueFoundry's AI Gateway for complete observability and cost control.

---

## 1. How We Use TrueFoundry

### 1.1 AI Gateway — Every LLM Call Is Routed Through TrueFoundry

All 9 CrewAI agents use `TFY_GATEWAY_BASE_URL` as the `base_url` for their LLM client
(`agents/llm.py`). This means:

| Feature | How It Works |
|---------|-------------|
| **Unified API key** | A single `TFY_API_KEY` governs all LLM access — no per-model keys scattered across services |
| **Model routing** | Agents 1–8 use `gpt-4o-mini` (low cost); Agent 9 (Operator Briefing) uses `gpt-4o` (high quality) — both via the same gateway endpoint |
| **Automatic fallback** | If the gateway is unreachable, `agents/llm.py` falls back to a direct OpenAI key without any code changes |
| **Token tracking** | Every call's `prompt_tokens`, `completion_tokens`, and `total_cost_usd` are captured via a LiteLLM success callback and stored in the incident report's `trace` field |
| **Trace ID propagation** | The callback captures `x-trace-id`, `x-litellm-call-id`, and Cloudflare Ray IDs from gateway response headers. The final incident report stores `all_call_trace_ids` — one per agent — so every LLM interaction is traceable back to TrueFoundry's dashboard |

```python
# agents/llm.py — real TrueFoundry gateway routing
return LLM(
    model="openai/gpt-4o-mini",
    base_url=TFY_GATEWAY_BASE_URL,   # TrueFoundry AI Gateway
    api_key=TFY_API_KEY,
    temperature=0.1,
)
```

### 1.2 Observability — Per-Incident Cost and Latency Accounting

Each incident report includes a `trace` block with real numbers from the gateway:

```json
"trace": {
  "tfy_trace_id": "tfy-abc123...",
  "all_call_trace_ids": ["tfy-t1...", "tfy-t2...", ..., "tfy-t9..."],
  "llm_calls": 9,
  "total_latency_ms": 18420,
  "total_tokens": 14850,
  "prompt_tokens": 11200,
  "completion_tokens": 3650,
  "total_cost_usd": 0.003825,
  "models_used": ["openai/gpt-4o-mini", "openai/gpt-4o"],
  "gateway": "truefoundry"
}
```

This is visible in the UI under **Observability → Gateway Observability**.

### 1.3 TrueFoundry Model Serving — Deploy All 4 Services

`tfy/truefoundry.yaml` defines the complete multi-service deployment:

```bash
# Deploy all 4 services to TrueFoundry managed K8s in one command
servicefoundry deploy --file tfy/truefoundry.yaml --workspace <workspace-fqn>
```

| Service | Replicas | Resources | Exposure |
|---------|----------|-----------|----------|
| Anomaly Scoring | 2 | 0.5 CPU / 512 MB | Internal |
| Event Ingestion | 1 | 1 CPU / 1 GB | Public |
| CrewAI Crew | 2 | 2 CPU / 2 GB | Internal |
| Incident API | 2 | 0.5 CPU / 512 MB | Public |

Secrets (`TFY_API_KEY`, `OPENAI_API_KEY`) are stored in a TrueFoundry Secret Group
and injected at runtime — never baked into container images.

### 1.4 TrueFoundry Anomaly Service Integration

The `call_truefoundry_anomaly_service` CrewAI tool (in `agents/tools.py`) calls the
anomaly scoring microservice. In production this runs on TrueFoundry's platform and
is referenced via `ANOMALY_SERVICE_URL` environment variable — no hardcoded endpoints.

---

## 2. How We Use CrewAI

### 2.1 9-Agent Sequential Pipeline

```
Alert Correlation Agent
  ↓  (groups alerts into incident window)
Telemetry Analysis Agent ──┐
Maintenance History Agent  │ (parallel context for Root Cause)
Weather/Forecast Agent   ──┘
  ↓
Root Cause Agent
  (synthesizes all 4 inputs → determines root cause with confidence score)
  ↓
Business Impact Agent
  (calculates energy loss MWh/day + revenue $/day)
  ↓
Maintenance Recommendation Agent
  (recommends action + urgency window)
  ↓
Safety Governance Agent
  (checks if human approval gate is required)
  ↓
Operator Briefing Agent  ← uses GPT-4o (higher quality for human-facing text)
  (writes plain-English operator briefing)
```

### 2.2 Production-Grade CrewAI Configuration

| Feature | Configuration | Purpose |
|---------|--------------|---------|
| `max_iter=5` | Per agent | Prevents infinite tool-calling loops |
| `max_retry_limit=2` | Per agent | Retries transient LLM/tool failures automatically |
| `step_callback` | Crew-level | Logs every agent reasoning step for monitoring |
| `task_callback` | Crew-level | Logs task completion for latency profiling |
| `Process.sequential` | Crew-level | Ensures deterministic, auditable execution order |
| LiteLLM callback | Global | Captures real trace IDs from TrueFoundry gateway |

### 2.3 Human-in-the-Loop Governance Gate

The Safety Governance Agent outputs `approval_required: true` for any action that
requires taking an asset offline. This gates the incident in `awaiting_review` status
in the UI — no automated action is taken until a human operator approves via the
"Investigate Incident Details" workflow. This is the **Human-in-the-Loop** pattern
that satisfies utility regulatory requirements.

### 2.4 Structured Tool Integration

Each agent uses typed CrewAI `@tool` functions that query real in-memory data:

| Tool | Agent | Data Source |
|------|-------|-------------|
| `query_alerts` | Alert Correlation | State store rolling window |
| `query_telemetry_window` | Telemetry Analysis | State store time-series buffer |
| `call_truefoundry_anomaly_service` | Telemetry Analysis | Anomaly scoring service (ML rules) |
| `query_maintenance_history` | Maintenance History | `data/maintenance/*.json` |
| `query_weather_context` | Weather/Forecast | State store weather window |
| `query_forecast_vs_actual` | Weather/Forecast + Impact | State store forecast data |
| `calculate_business_impact` | Business Impact | Energy price × power loss |
| `apply_governance_rules` | Safety Governance | `config/governance_rules.yaml` |

---

## 3. Event Pipeline Architecture

```
NumPy Physics Simulator (stream_live.py)
    │
    ├──[HTTP POST]──→ /ingest (Ingestion Service)
    │
    └──[Kafka produce]──→ gridops.raw.events (opt-in, KAFKA_BOOTSTRAP_SERVERS)
                              │
                              └──[Kafka consume]──→ /ingest pipeline (same code)

Ingestion Service
    │
    ├── Pydantic v2 envelope validation (schema_version, correlation_id, source_system)
    ├── State store rolling window (per-asset telemetry buffer)
    ├── Anomaly scoring via HTTP → Anomaly Service
    ├── Correlation engine (alert grouping, candidate emission)
    ├── SSE broadcast → frontend Live Event Feed ticker
    │
    └──[background]──→ CrewAI Service /run_incident
                              │
                              └──→ Incident API /api/reports
```

### 3.1 Kafka Integration (Production Mode)

Set `KAFKA_BOOTSTRAP_SERVERS` to activate:

```bash
# .env
KAFKA_BOOTSTRAP_SERVERS=redpanda:9092
KAFKA_TOPIC=gridops.raw.events
KAFKA_CONSUMER_GROUP=gridops-ingestion

# Start Redpanda (Kafka-compatible, zero-dependency)
docker compose --profile kafka up redpanda
```

The stream generator supports `--sink both` to dual-publish to HTTP and Kafka
simultaneously for zero-downtime migration between modes.

---

## 4. Scalability

| Component | Current | Production Path |
|-----------|---------|----------------|
| Event ingestion | Single process, in-memory | Redis pub/sub + multiple replicas |
| State store | Per-process dict | Redis hash + TTL |
| Crew execution | Synchronous, 1 request/worker | 2 replicas × async queue (Celery) |
| Incident API | In-memory dict | PostgreSQL + read replicas |
| SSE subscribers | Per-process list | WebSocket gateway (e.g. Pusher) |
| Event bus | HTTP direct / Kafka opt-in | Kafka + schema registry |

---

## 5. Reliability

| Feature | Implementation |
|---------|---------------|
| LLM fallback chain | Gateway → Direct OpenAI → Mock report (never returns 500) |
| Crew failure fallback | `generate_mock_fallback_report()` returns high-fidelity data |
| Service health checks | `GET /health` on all 4 services; Docker/K8s HEALTHCHECK |
| Retry on tool errors | `max_retry_limit=2` per CrewAI agent |
| Kafka consumer resilience | `auto.offset.reset=latest`, error logging, graceful shutdown |
| Correlation deduplication | Candidate ID is deterministic (asset + window) — no duplicate crew runs |

---

## 6. Security

| Area | Implementation |
|------|---------------|
| Secrets management | TrueFoundry Secret Groups — never in container image or git |
| Non-root containers | All Dockerfiles use `useradd -u 1000 gridops` |
| API key rotation | Single `TFY_API_KEY` updated in Secret Group propagates to all replicas |
| Governance gate | Human approval required before any asset-offline action |
| Audit trail | Every decision (approve/reject/work_order) logged with timestamp + actor |

---

## 7. Evaluation

Scenario-level evaluation results are stored in `data/eval_reports/` as JSON files,
one per incident run. The eval harness (`evaluation/`) checks:

- Root cause classification accuracy
- Confidence score calibration
- Business impact calculation correctness
- Governance rule application accuracy
- Operator briefing quality (LLM-as-judge)

Run: `make eval` to generate aggregate metrics across all 4 scenarios (SCN-A through SCN-D).

---

## 8. Quick-Start Commands

```bash
# Local development (all services)
./run_demo.sh

# Docker Compose (all 4 services)
docker compose up

# Docker Compose with Kafka (Redpanda)
docker compose --profile kafka up

# Deploy to TrueFoundry
servicefoundry deploy --file tfy/truefoundry.yaml --workspace <fqn>

# Stream with Kafka sink
python scripts/stream_live.py --sink kafka --kafka-bootstrap localhost:9092

# Stream with both HTTP and Kafka
python scripts/stream_live.py --sink both --kafka-bootstrap localhost:9092
```

---

*GridOps Copilot — Built for TrueFoundry × CrewAI Hackathon, June 2026*
