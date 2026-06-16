# GridOps Copilot — Demo Script

## Pre-Demo Setup (5 minutes)

```bash
# 1. Clone and install
git clone <repo> gridops-copilot && cd gridops-copilot
cp .env.example .env
# Edit .env: set TFY_GATEWAY_BASE_URL and TFY_API_KEY
make setup

# 2. Generate all scenario data
make gen-data
# Expected output: 284 assets, 4 scenarios, JSONL files in data/scenarios/

# 3. Start all services (4 terminals)
make run-anomaly   # port 8001
make run-ingest    # port 8002
make run-crew      # port 8003
make run-api       # port 8000
```

## Demo Narrative (15 minutes)

### Slide 1: The Problem

> "A 500 MW solar facility gets hundreds of disconnected alerts per day.
> Operators can't tell which alerts are part of the same physical failure.
> GridOps Copilot correlates them into one actionable incident."

### Slide 2: The Demo Site

> "Desert Sun Solar + BESS, California Desert. 120 inverters, 20 BESS units.
> We inject a real-world inverter cooling degradation scenario."

### Step 1: Stream Scenario B — Inverter Cooling Degradation

```bash
# Terminal 5: stream Scenario B at 20× speed
make produce
# Watch ingestion logs — alerts accumulate for INV-042
# Watch for: "candidates_emitted: 1" — anomaly detected!
```

**Talking point:** "The correlation service detected that INV-042's 9 alerts form a coherent cluster with anomaly score 0.87 — above the 0.6 threshold."

### Step 2: Watch CrewAI Agents Work

The candidate automatically triggers the 9-agent crew:

1. **Alert Correlation** groups the 9 INV-042 alerts
2. **Telemetry Analysis** confirms: temperature rose 25°C BEFORE output dropped
3. **Maintenance History** finds: similar cooling fan issue 8 months ago, runtime > 18,000h
4. **Weather Agent** confirms: irradiance stable, output drop NOT weather-explained
5. **Root Cause** synthesizes: `cooling_subsystem_degradation`, confidence 0.83
6. **Business Impact**: 2.8 MWh/day lost = **$210/day**
7. **Recommendation**: `inspect_cooling_fan_within_24_hours`
8. **Governance**: human approval required before taking inverter offline
9. **Operator Briefing**: concise 3-sentence summary

### Step 3: Inspect the Incident Report

```bash
curl localhost:8000/api/incidents | python3 -m json.tool
curl localhost:8000/api/incidents/INC-INV042-20260616 | python3 -m json.tool
```

**Show:** evidence list, business impact, governance.

### Step 4: Operator Approves

```bash
curl -X POST localhost:8000/api/incidents/INC-INV042-20260616/decision \
  -H "Content-Type: application/json" \
  -d '{"decision": "approved", "actor": "Maria Gonzalez"}'
```

**Show:** work order created automatically. Audit trail:

```bash
curl localhost:8000/api/audit/INC-INV042-20260616 | python3 -m json.tool
```

### Step 5: TrueFoundry Dashboard

> "Every LLM call is routed through the TrueFoundry AI Gateway.
> Show the gateway dashboard: request logs, latency (< 10s), cost per incident (~$0.01)."

### Step 6: Run Evaluation

```bash
make eval
# Expected: 4/4 scenarios pass
# root_cause_accuracy: 100%, false_escalation_rate: 0%
```

### Bonus: Scenario D — Weather False Positive

```bash
python scripts/produce_events.py --scenario weather_false_positive --speed 20 --sink http://localhost:8002/ingest
curl localhost:8000/api/incidents  # No new incident — correctly suppressed!
```

## Key Technical Differentiators

1. **TrueFoundry AI Gateway** — all LLM calls observable, cost-tracked
2. **Deterministic anomaly scoring** — rule-based, no hallucination on detection
3. **9 specialist agents** — each with a clear role, evidence-traceable
4. **Governance-first design** — human approval required before offline actions
5. **4 scenario eval harness** — reproducible, seeded, ground-truth verified
