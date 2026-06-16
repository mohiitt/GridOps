# GridOps Copilot

**Tagline:** From renewable-energy alert noise to actionable incident intelligence.

**Hackathon:** TrueFoundry × CrewAI — *From Prototype to Production: Real-World AI Agents*

GridOps Copilot is an AI operations copilot for renewable-energy operators managing a 500 MW solar + BESS portfolio. It ingests high-volume, disconnected SCADA signals and produces a single explainable incident per asset cluster.

```
Many raw alerts + telemetry + maintenance + weather/forecast
        ↓ (anomaly scoring + correlation + CrewAI multi-agent reasoning)
One explainable incident:
  root cause · evidence · priority · business impact · recommended action · governance
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure TrueFoundry credentials
cp .env.example .env
# Edit .env: set TFY_GATEWAY_BASE_URL and TFY_API_KEY

# 3. Generate all synthetic data
make gen-data

# 4. Start all services (4 terminals)
make run-anomaly   # Anomaly scoring service — port 8001
make run-ingest    # Event ingestion service — port 8002
make run-crew      # CrewAI workflow service — port 8003
make run-api       # Incident report API     — port 8000

# 5. Run the demo scenario
make produce       # Streams inverter cooling degradation scenario

# 6. Check results
curl localhost:8000/api/incidents

# 7. Approve the incident
curl -X POST localhost:8000/api/incidents/INC-INV042-20260616/decision \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved", "actor": "operator"}'

# 8. Run evaluation
make eval
```

## Architecture

```
JSONL Streams → Ingestion Service → Anomaly Service (TFY)
                                          ↓
                              Incident Correlation
                                          ↓
                              CrewAI 9-Agent Workflow → TFY AI Gateway → LLM
                                          ↓
                              Incident Report API → Frontend
```

See `docs/architecture.md` for full details.

## Scenarios

| ID | Name | Incident | Focal Asset |
|----|------|---------|-------------|
| SCN-A | Normal Operation | No | — |
| SCN-B | Inverter Cooling Degradation | **Yes** | INV-042 |
| SCN-C | BESS Thermal Management Risk | **Yes** | BESS-011 |
| SCN-D | Weather-Driven False Positive | No | — |

## Repository Structure

```
common/             Shared envelope + schemas (Pydantic v2)
config/             Settings (env vars)
scripts/            Data generator + event producer/consumer
services/
  anomaly_service/  TFY-deployable anomaly scorer (port 8001)
  ingestion_service/ Event ingestion + correlation (port 8002)
  incident_api/     Frontend-facing REST API (port 8000)
agents/             CrewAI 9-agent workflow (port 8003)
evaluation/         Eval runner + metrics
deployment/         TrueFoundry YAML + Kafka topics
docs/               Architecture, data contracts, demo script
data/               Generated assets, scenarios, eval reports
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TFY_GATEWAY_BASE_URL` | TrueFoundry AI Gateway URL | _(required)_ |
| `TFY_API_KEY` | TrueFoundry API key | _(required)_ |
| `GRIDOPS_SEED` | Global RNG seed | 42 |
| `ENERGY_PRICE_PER_MWH` | Energy price for impact calc | 75 |
| `ANOMALY_SERVICE_URL` | Anomaly service URL | http://localhost:8001 |

## Full-Stack Demo

### Option A — UI-driven (recommended)

```bash
# Terminal 1–4: start all backend services
make run-anomaly &   # port 8001
make run-ingest  &   # port 8002
make run-crew    &   # port 8003
make run-api         # port 8000

# Terminal 5: start frontend in LIVE mode
cd frontend
cp .env.local.example .env.local
# Edit .env.local → set NEXT_PUBLIC_USE_LIVE_API=true
npm install && npm run dev          # http://localhost:3000

# In the browser:
# 1. Select "Inverter Cooling Degradation" scenario in the header dropdown
# 2. Click "Run AI Analysis" — events stream, agents animate, incident appears
# 3. Click the incident → Approve → work order created + audit trail updates
```

### Option B — CLI-driven

```bash
# After all 4 services are up:
make produce-fast      # instant replay, triggers crew in background
sleep 120              # wait for 9-agent CrewAI workflow
curl localhost:8000/api/incidents   # → incident for INV-042
```

### Option C — All 4 scenarios

```bash
make run-all-scenarios  # reset → stream → poll per scenario
make eval               # evaluate against ground truth
```

### Frontend fixture mode (no backend required)

```bash
cd frontend && npm install && npm run dev
# NEXT_PUBLIC_USE_LIVE_API defaults to false → full fixture demo
```

## Evaluation

```bash
python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json
```

Target: 4/4 scenarios pass, `root_cause_accuracy=1.0`, `false_escalation_rate=0.0`.

## TrueFoundry Deployment

```bash
# Deploy anomaly service
truefoundry deploy --file deployment/truefoundry.yaml --workspace <workspace_fqn>
```

See `deployment/truefoundry.yaml` for the service spec.
