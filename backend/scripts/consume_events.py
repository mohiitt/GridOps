"""
Event Consumer — Mode 2 (Kafka/Redpanda, optional) per §13.2.

Subscribes to Kafka topics and POSTs events to the ingestion service.
Only used when running with --transport kafka (Mode 2).
"""
from __future__ import annotations

import argparse
import json
import sys

TOPICS = [
    "gridops.asset.telemetry",
    "gridops.scada.alerts",
    "gridops.weather.observations",
    "gridops.production.forecast",
    "gridops.maintenance.records",
    "gridops.workorders",
    "gridops.grid.dispatch",
    "gridops.incident.candidates",
    "gridops.ai.incident_reports",
    "gridops.governance.audit",
]


def consume_kafka(bootstrap_servers: str, group_id: str, sink_url: str) -> None:
    """Consume Kafka messages and forward to the ingestion service."""
    try:
        from confluent_kafka import Consumer, KafkaException
    except ImportError:
        print("confluent_kafka not installed. Mode 2 is optional.", file=sys.stderr)
        sys.exit(1)

    import requests

    conf = {
        "bootstrap.servers": bootstrap_servers,
        "group.id": group_id,
        "auto.offset.reset": "earliest",
    }
    consumer = Consumer(conf)
    consumer.subscribe(TOPICS)
    session = requests.Session()

    print(f"Consuming from {bootstrap_servers}, topics={TOPICS}", file=sys.stderr)
    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                raise KafkaException(msg.error())
            try:
                event = json.loads(msg.value().decode("utf-8"))
                resp = session.post(sink_url, json=event, timeout=10)
                resp.raise_for_status()
            except Exception as exc:
                print(f"[WARN] Error processing message: {exc}", file=sys.stderr)
    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="GridOps event consumer (Mode 2 — Kafka)")
    parser.add_argument("--bootstrap-servers", default="localhost:9092")
    parser.add_argument("--group-id", default="gridops-ingestion")
    parser.add_argument("--sink", default="http://localhost:8002/ingest")
    args = parser.parse_args()

    consume_kafka(args.bootstrap_servers, args.group_id, args.sink)


if __name__ == "__main__":
    main()
