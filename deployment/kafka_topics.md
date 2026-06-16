# Kafka Topic Definitions (Mode 2 — Optional)

These topics are only needed for Mode 2 (Kafka/Redpanda). Mode 1 (JSONL simulation) does not require a broker.

## Topics

| Topic | Purpose | Key | Retention |
|-------|---------|-----|-----------|
| `gridops.asset.telemetry` | Periodic asset measurements | `asset_id` | 7d |
| `gridops.scada.alerts` | Threshold/condition alerts | `asset_id` | 7d |
| `gridops.weather.observations` | Site weather per station | `asset_id` (WX-001) | 7d |
| `gridops.production.forecast` | Expected vs actual production | `asset_id` or `site_id` | 7d |
| `gridops.maintenance.records` | CMMS maintenance records | `asset_id` | 30d |
| `gridops.workorders` | Work order events | `asset_id` | 30d |
| `gridops.grid.dispatch` | Grid dispatch requests | `asset_id` | 7d |
| `gridops.incident.candidates` | Correlated alert clusters | `asset_id` | 7d |
| `gridops.ai.incident_reports` | Final CrewAI reports | `asset_id` | 30d |
| `gridops.governance.audit` | Immutable audit log | `incident_id` | 365d |

## Create Topics (Redpanda CLI)

```bash
rpk topic create gridops.asset.telemetry --partitions 4 --replicas 1
rpk topic create gridops.scada.alerts --partitions 4 --replicas 1
rpk topic create gridops.weather.observations --partitions 1 --replicas 1
rpk topic create gridops.production.forecast --partitions 4 --replicas 1
rpk topic create gridops.maintenance.records --partitions 2 --replicas 1
rpk topic create gridops.workorders --partitions 2 --replicas 1
rpk topic create gridops.grid.dispatch --partitions 2 --replicas 1
rpk topic create gridops.incident.candidates --partitions 2 --replicas 1
rpk topic create gridops.ai.incident_reports --partitions 2 --replicas 1
rpk topic create gridops.governance.audit --partitions 1 --replicas 1
```

## Mode 2 Usage

```bash
# Start Redpanda
docker-compose --profile kafka up -d redpanda

# Produce events to Kafka
python scripts/produce_events.py --scenario inverter_cooling_degradation --transport kafka --bootstrap-servers localhost:9092

# Consume and forward to ingestion service
python scripts/consume_events.py --bootstrap-servers localhost:9092 --sink http://localhost:8002/ingest
```
