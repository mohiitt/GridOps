# GridOps Copilot

> **AI-powered operations copilot for renewable energy infrastructure**  
> Hackathon: *TrueFoundry × CrewAI — From Prototype to Production: Real-World AI Agents*

---

## 1. Problem & Use Case

### The Problem

Utility-scale renewable energy facilities (solar farms, BESS) generate thousands of raw
sensor alerts every hour. A 500 MW facility can fire **12+ overlapping SCADA alerts** from
a single inverter fault — temperature spikes, fan failures, power deviations — all
arriving within minutes of each other. Today, operators:

- Manually triage each alert in isolation
- Miss correlated root causes buried in alert noise
- React hours later, after MWh of generation is already lost
- Have no structured way to enforce governance (who approved taking an asset offline?)

### Our Solution

**GridOps Copilot** ingests real-time telemetry, compresses alert noise, and deploys a
9-agent CrewAI crew that produces **one explainable incident per asset** — with root cause,
business impact, recommended action, and a governance gate for human approval.

```
Raw SCADA stream (telemetry + alerts + weather + forecast)
        ↓
Anomaly Scoring + Alert Correlation Engine
        ↓
9-Agent CrewAI Pipeline (via TrueFoundry AI Gateway)
        ↓
ONE Actionable Incident:
  root cause · confidence · evidence · energy loss (MWh/day)
  recommended action · governance gate · operator briefing
```

### Why It Matters

| Metric | Without GridOps | With GridOps |
|--------|----------------|-------------|
| Alerts to review | 12+ raw alerts | 1 incident |
| Time to triage | 45–90 minutes | < 2 minutes |
| Root cause clarity | Manual correlation | AI-generated with evidence |
| Governance | Ad-hoc | Structured approval gate |
| Revenue protected | Unknown | $210–$480/day per incident |

**Target users:** Grid operators, O&M teams, energy asset managers at utility-scale renewable facilities.

---

## 2. Technical Execution

### System Architecture

```
NumPy Physics Simulator (stream_live.py)
    │
    ├──[HTTP POST]──→ Ingestion Service (port 8002)
    │                     │
    │                     ├── Pydantic v2 envelope validation
    │                     ├── State store (rolling telemetry window)
    │                     ├── Anomaly scoring → Anomaly Service (port 8001)
    │                     ├── Alert correlation → incident candidate
    │                     ├── SSE broadcast → frontend Live Event Feed
    │                     └──[background]──→ CrewAI Service (port 8003)
    │                                               │
    └──[Kafka]──→ gridops.raw.events ───────────────┘
                  (opt-in, KAFKA_BOOTSTRAP_SERVERS)
                                               │
                                     TrueFoundry AI Gateway
                                     (routes to GPT-4o-mini / GPT-4o)
                                               │
                                     9 CrewAI Agents (sequential)
                                               │
                                     Incident Report API (port 8000)
                                               │
                                     Next.js Frontend (port 3000)
```

### Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Event schema | Pydantic v2 with `schema_version` + `correlation_id` | Forward-compatible, validation at ingest boundary |
| LLM routing | TrueFoundry AI Gateway | Unified observability, cost tracking, key rotation |
| Agent framework | CrewAI sequential crew | Deterministic execution order for audit compliance |
| Real-time feed | Server-Sent Events (SSE) | Simple, browser-native, no WebSocket overhead |
| Event bus | HTTP (demo) + Kafka (production) | Gradual migration path, `--sink both` flag |
| Data generation | NumPy physics simulator | Physics-based degradation curves, not random noise |
| Human-in-the-loop | Governance gate in Agent 8 | Regulatory compliance — no automated asset-offline actions |

### 9-Agent CrewAI Pipeline

```
1. Alert Correlation Agent     → groups overlapping alerts into incident window
2. Telemetry Analysis Agent    → analyzes temperature/fan/power via ML scoring
3. Maintenance History Agent   → checks asset service records & runtime hours
4. Weather & Forecast Agent    → rules out weather as root cause
5. Root Cause Agent            → synthesizes 1–4 → root cause + confidence
6. Business Impact Agent       → calculates energy loss (MWh/day) + revenue ($/day)
7. Maintenance Recommendation  → recommends corrective action + urgency window
8. Safety Governance Agent     → applies governance rules → human approval gate
9. Operator Briefing Agent ★   → writes plain-English briefing (GPT-4o)
```

### Quick Start

```bash
# Clone and configure
cp .env.example .env
# Set TFY_GATEWAY_BASE_URL and TFY_API_KEY in .env

# Start everything (backend + frontend) in one command
./run_demo.sh
# → Opens at http://localhost:3000

# Or with Docker
docker compose up
```

### Repository Structure

```
GridOps/
├── .env / .env.example          ← credentials (never committed)
├── run_demo.sh                  ← one-command full-stack launcher
├── docker-compose.yml           ← Docker orchestration
├── PRODUCTION_READINESS.md      ← detailed production assessment
├── frontend/                    ← Next.js 14 App Router UI
└── backend/
    ├── agents/                  ← CrewAI 9-agent pipeline (port 8003)
    ├── common/                  ← Pydantic v2 envelope + shared schemas
    ├── config/                  ← environment settings
    ├── services/
    │   ├── anomaly_service/     ← ML anomaly scoring (port 8001)
    │   ├── ingestion_service/   ← event ingest + correlation + SSE (port 8002)
    │   └── incident_api/        ← incident REST API (port 8000)
    ├── scripts/                 ← stream_live.py (physics simulator + Kafka producer)
    ├── data/                    ← assets, scenarios, eval reports, maintenance records
    ├── evaluation/              ← eval harness + metrics
    ├── tfy/                     ← TrueFoundry deployment YAML
    └── requirements.txt
```

---

## 3. Innovation & Creativity

### What Makes GridOps Copilot Different

**1. Physics-Based Synthetic Data — Not Random Noise**  
`stream_live.py` uses NumPy differential equations to simulate real inverter cooling
degradation: `temp = base_temp + (1 - cooling_eff) × thermal_rise`. The simulator has
three phases (Normal → Degrading → Critical) that produce statistically realistic alert
patterns — exactly what a real SCADA system would emit.

**2. Alert Compression Engine**  
The correlation engine ingests 12 raw alerts and outputs 1 incident candidate.
The frontend visualizes this as a compression ratio (12 → 1) with the full alert
stream visible in the Live Event Feed ticker — judges can literally watch the noise
get compressed in real time.

**3. End-to-End Traceability**  
Every incident report stores the TrueFoundry trace IDs for all 9 LLM calls —
`all_call_trace_ids` — enabling per-agent cost and latency attribution on the
TrueFoundry gateway dashboard.

**4. Human-in-the-Loop Governance**  
Agent 8 checks `config/governance_rules.yaml` and sets `approval_required: true`
for any action that requires taking an asset offline. The UI enforces this gate —
the "Approve" button is gated, the audit trail is immutable, and every decision
is logged with actor + timestamp + reason.

**5. Dual-Path Event Bus (HTTP + Kafka)**  
The same ingestion pipeline accepts events via both HTTP POST and a Kafka consumer
topic (`gridops.raw.events`). Operators can start with HTTP (zero infrastructure)
and switch to Kafka for production scale without changing any application code —
just set `KAFKA_BOOTSTRAP_SERVERS`.

**6. Scripted Live Demo with Auto-Navigation**  
The demo is a fully scripted 35-second story arc: events stream → page auto-navigates
to AI Workflow → agents animate one-by-one → page returns to Command Centre → KPI
cards reveal with staggered animation. No manual clicking required during the demo.

---

## 4. Production Readiness

GridOps Copilot is designed with production-grade patterns throughout:

| Layer | Implementation |
|-------|---------------|
| **LLM Gateway** | All 9 agents route through TrueFoundry AI Gateway — unified key, cost tracking, trace IDs, fallback to direct OpenAI if gateway unreachable |
| **Containerisation** | 4 Dockerfiles with non-root users, HEALTHCHECK, and resource limits |
| **K8s / TFY Deploy** | `backend/tfy/truefoundry.yaml` — one-command deploy of all 4 services with horizontal scaling, secret injection, readiness probes |
| **Kafka** | Optional Kafka consumer in ingestion service (activate via `KAFKA_BOOTSTRAP_SERVERS`) + Kafka producer in `stream_live.py` (`--sink kafka`) |
| **Reliability** | `max_iter=5` + `max_retry_limit=2` per CrewAI agent; LLM fallback chain (Gateway → OpenAI → mock report) |
| **Observability** | Real TFY trace IDs captured via LiteLLM callback; per-agent token counts and cost stored in every incident report |
| **Audit Trail** | Every human decision (approve/reject/work_order) is immutably logged with actor + timestamp |
| **Evaluation** | Ground truth JSON for all 4 scenarios; eval harness checks root cause accuracy, false escalation rate, confidence calibration |

**→ Full assessment: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)**

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TFY_GATEWAY_BASE_URL` | TrueFoundry AI Gateway base URL | Yes |
| `TFY_API_KEY` | TrueFoundry API key | Yes |
| `OPENAI_API_KEY` | Direct OpenAI fallback key | Optional |
| `ENERGY_PRICE_PER_MWH` | Energy price for impact calculation | No (default: 75) |
| `KAFKA_BOOTSTRAP_SERVERS` | Enable Kafka consumer in ingestion service | No |
| `ANOMALY_SERVICE_URL` | Anomaly service URL | No (default: localhost:8001) |

---

## Evaluation

```bash
# Run all 4 scenarios and evaluate against ground truth
cd backend && python scripts/run_all_scenarios.py
python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json
```

Target: 4/4 scenarios pass · `root_cause_accuracy = 1.0` · `false_escalation_rate = 0.0`

---

## TrueFoundry Deployment

```bash
# Deploy all 4 microservices to TrueFoundry managed K8s
servicefoundry deploy --file backend/tfy/truefoundry.yaml --workspace <workspace-fqn>

# Or with Docker Compose (local)
docker compose up

# With Kafka (Redpanda)
docker compose --profile kafka up
```

---

*GridOps Copilot — Built for TrueFoundry × CrewAI Hackathon, June 2026*  
*Desert Sun Solar + BESS Facility (500 MW) · 9 CrewAI Agents · TrueFoundry AI Gateway*
