"""
Event Producer — Mode 1 (JSONL simulation, primary) per §13.1.

Merges all six per-scenario JSONL files, sorts by timestamp,
and feeds the ingestion service via HTTP POST, stdout, or file.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

SCENARIOS = [
    "normal_operation",
    "inverter_cooling_degradation",
    "bess_thermal_risk",
    "weather_false_positive",
]

JSONL_FILES = [
    "telemetry_events.jsonl",
    "alert_events.jsonl",
    "weather_events.jsonl",
    "forecast_events.jsonl",
    "maintenance_events.jsonl",
    "grid_dispatch_events.jsonl",
]


def load_scenario(scenario: str) -> list[dict]:
    """Load and merge all six JSONL event streams, sorted by timestamp."""
    base_dir = Path("data/scenarios") / scenario
    events: list[dict] = []

    for fname in JSONL_FILES:
        fpath = base_dir / fname
        if not fpath.exists():
            continue
        with open(fpath) as f:
            for line in f:
                line = line.strip()
                if line:
                    events.append(json.loads(line))

    # Sort by timestamp (ISO-8601 strings sort lexicographically correctly)
    events.sort(key=lambda e: e["timestamp"])
    return events


def send_http(event: dict, url: str, session: requests.Session) -> None:
    """POST a single event envelope to the ingestion service."""
    try:
        resp = session.post(url, json=event, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"  [WARN] POST failed for {event.get('event_id')}: {exc}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description="GridOps event producer (Mode 1 — JSONL)")
    parser.add_argument(
        "--scenario",
        choices=SCENARIOS,
        default="inverter_cooling_degradation",
        help="Which scenario to stream",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=20.0,
        help="Time compression multiplier (20 = 1 sim-minute per 3 real-seconds)",
    )
    parser.add_argument(
        "--sink",
        default="stdout",
        help="Destination: http://host:port/ingest | stdout | file:path/to/output.jsonl",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print events without sleeping or sending",
    )
    args = parser.parse_args()

    print(f"Loading scenario: {args.scenario}", file=sys.stderr)
    events = load_scenario(args.scenario)
    print(f"Loaded {len(events)} events sorted by timestamp", file=sys.stderr)

    if not events:
        print("No events found. Run generate_synthetic_data.py first.", file=sys.stderr)
        sys.exit(1)

    # Prepare sink
    out_file = None
    session = None
    if args.sink.startswith("http"):
        session = requests.Session()
        print(f"Streaming to HTTP sink: {args.sink}", file=sys.stderr)
    elif args.sink.startswith("file:"):
        out_path = Path(args.sink[5:])
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_file = open(out_path, "w")
        print(f"Writing to file: {out_path}", file=sys.stderr)
    else:
        print("Writing to stdout", file=sys.stderr)

    # Stream events with time compression
    prev_sim_ts: str | None = None
    prev_real_ts: float | None = None

    for i, event in enumerate(events):
        sim_ts = event["timestamp"]

        # Compute wall-clock sleep duration based on event timestamp delta
        if prev_sim_ts is not None and not args.dry_run:
            from common.timeutil import seconds_between
            sim_delta = seconds_between(prev_sim_ts, sim_ts)
            if sim_delta > 0:
                sleep_secs = sim_delta / args.speed
                time.sleep(max(0.0, sleep_secs))

        prev_sim_ts = sim_ts

        # Deliver event
        if args.sink.startswith("http"):
            send_http(event, args.sink, session)
        elif out_file is not None:
            out_file.write(json.dumps(event) + "\n")
            out_file.flush()
        else:
            print(json.dumps(event))

        if (i + 1) % 50 == 0:
            print(
                f"  [{i+1}/{len(events)}] sent event_id={event.get('event_id')} ts={sim_ts}",
                file=sys.stderr,
            )

    if out_file:
        out_file.close()

    if session:
        session.close()

    print(f"Done. Streamed {len(events)} events.", file=sys.stderr)


if __name__ == "__main__":
    main()
