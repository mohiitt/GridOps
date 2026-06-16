"""
Run all 4 scenarios end-to-end and generate eval reports.

Flow per scenario:
  1. POST /reset          → clear ingestion state
  2. POST /set_context    → set scenario_id for crew dispatch
  3. Stream all events    → ingestion (instant replay: speed=999999)
  4. Poll /api/incidents  → wait for report (incident scenarios only)
  5. Save to data/eval_reports/SCN-X.json

Usage:
  python scripts/run_all_scenarios.py [--ingestion-url http://localhost:8002]
                                      [--api-url      http://localhost:8000]
                                      [--timeout      120]
                                      [--scenario     inverter_cooling_degradation]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests

from scripts.produce_events import SCENARIO_IDS, load_scenario

SCENARIOS_META = [
    {"name": "normal_operation",             "scenario_id": "SCN-A", "incident_expected": False, "focal_asset": None},
    {"name": "inverter_cooling_degradation", "scenario_id": "SCN-B", "incident_expected": True,  "focal_asset": "INV-042"},
    {"name": "bess_thermal_risk",            "scenario_id": "SCN-C", "incident_expected": True,  "focal_asset": "BESS-011"},
    {"name": "weather_false_positive",       "scenario_id": "SCN-D", "incident_expected": False, "focal_asset": None},
]


def reset_ingestion(ingestion_url: str) -> None:
    resp = requests.post(f"{ingestion_url}/reset", timeout=10)
    resp.raise_for_status()


def set_context(ingestion_url: str, scenario: str, scenario_id: str) -> None:
    resp = requests.post(
        f"{ingestion_url}/set_context",
        json={"scenario": scenario, "scenario_id": scenario_id, "site_id": "SITE-DS-001"},
        timeout=10,
    )
    resp.raise_for_status()


def stream_events(ingestion_url: str, scenario: str, session: requests.Session) -> int:
    """Stream all events for a scenario at instant speed. Returns event count."""
    events = load_scenario(scenario)
    ingest_url = f"{ingestion_url}/ingest"
    for event in events:
        try:
            session.post(ingest_url, json=event, timeout=15)
        except Exception as exc:
            print(f"  [WARN] POST failed: {exc}", file=sys.stderr)
    return len(events)


def wait_for_report(
    api_url: str,
    scenario_id: str,
    timeout_s: float = 120.0,
) -> dict | None:
    """Poll /api/incidents until a report for this scenario_id appears."""
    deadline = time.time() + timeout_s
    interval = 3.0
    while time.time() < deadline:
        try:
            resp = requests.get(f"{api_url}/api/incidents", timeout=10)
            resp.raise_for_status()
            incidents = resp.json()
            for inc in incidents:
                if inc.get("scenario_id") == scenario_id:
                    # Fetch full report
                    full = requests.get(
                        f"{api_url}/api/incidents/{inc['incident_id']}", timeout=10
                    )
                    full.raise_for_status()
                    return full.json()
        except Exception as exc:
            print(f"  [WARN] Polling error: {exc}", file=sys.stderr)
        remaining = deadline - time.time()
        if remaining > 0:
            time.sleep(min(interval, remaining))
    return None


def save_report(report: dict, scenario_id: str) -> Path:
    eval_dir = Path("data/eval_reports")
    eval_dir.mkdir(parents=True, exist_ok=True)
    path = eval_dir / f"{report['incident_id']}.json"
    path.write_text(json.dumps(report, indent=2))
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all GridOps scenarios end-to-end")
    parser.add_argument("--ingestion-url", default="http://localhost:8002")
    parser.add_argument("--api-url", default="http://localhost:8000")
    parser.add_argument("--timeout", type=float, default=120.0,
                        help="Seconds to wait for crew report per incident scenario")
    parser.add_argument(
        "--scenario",
        choices=[s["name"] for s in SCENARIOS_META],
        default=None,
        help="Run a single scenario (default: all)",
    )
    args = parser.parse_args()

    scenarios = (
        [s for s in SCENARIOS_META if s["name"] == args.scenario]
        if args.scenario
        else SCENARIOS_META
    )

    session = requests.Session()
    results: list[dict] = []

    for meta in scenarios:
        name = meta["name"]
        scenario_id = meta["scenario_id"]
        incident_expected = meta["incident_expected"]
        focal = meta["focal_asset"]

        print(f"\n{'='*55}")
        print(f"Scenario {scenario_id}: {name}")
        print(f"  incident_expected={incident_expected}, focal_asset={focal}")

        # 1. Reset
        try:
            reset_ingestion(args.ingestion_url)
            print("  ✓ Ingestion state reset")
        except Exception as exc:
            print(f"  [ERROR] Could not reset ingestion: {exc}")
            results.append({"scenario_id": scenario_id, "status": "error", "error": str(exc)})
            continue

        # 2. Set context
        try:
            set_context(args.ingestion_url, name, scenario_id)
            print(f"  ✓ Context set: {scenario_id}")
        except Exception as exc:
            print(f"  [WARN] Could not set context: {exc}")

        # 3. Stream events
        try:
            n = stream_events(args.ingestion_url, name, session)
            print(f"  ✓ Streamed {n} events")
        except Exception as exc:
            print(f"  [ERROR] Stream failed: {exc}")
            results.append({"scenario_id": scenario_id, "status": "error", "error": str(exc)})
            continue

        # 4. Wait for report (incident scenarios only)
        if incident_expected:
            print(f"  Waiting up to {args.timeout}s for incident report...")
            report = wait_for_report(args.api_url, scenario_id, timeout_s=args.timeout)
            if report:
                path = save_report(report, scenario_id)
                print(f"  ✓ Report saved: {path.name}")
                print(f"    incident_id={report.get('incident_id')}")
                print(f"    root_cause={report.get('root_cause')}")
                print(f"    priority={report.get('priority')}")
                print(f"    recommended_action={report.get('recommended_action')}")
                results.append({"scenario_id": scenario_id, "status": "ok", "report": report.get("incident_id")})
            else:
                print(f"  [WARN] Timed out waiting for report (crew may still be running)")
                print(f"         Check data/eval_reports/ after crew finishes.")
                results.append({"scenario_id": scenario_id, "status": "timeout"})
        else:
            # For non-incident scenarios: verify no incident was generated
            time.sleep(5)  # brief wait to ensure correlation settled
            try:
                resp = requests.get(f"{args.api_url}/api/incidents", timeout=10)
                incidents = resp.json()
                scn_incidents = [i for i in incidents if i.get("scenario_id") == scenario_id]
                if scn_incidents:
                    print(f"  [WARN] Unexpected incident for non-incident scenario {scenario_id}")
                    results.append({"scenario_id": scenario_id, "status": "false_positive"})
                else:
                    print(f"  ✓ Correctly produced no incident")
                    results.append({"scenario_id": scenario_id, "status": "ok_no_incident"})
            except Exception as exc:
                print(f"  [WARN] Could not verify non-incident: {exc}")
                results.append({"scenario_id": scenario_id, "status": "ok_no_incident"})

    session.close()

    print(f"\n{'='*55}")
    print("Summary:")
    for r in results:
        status = r["status"]
        icon = "✓" if status.startswith("ok") else "✗"
        print(f"  {icon} {r['scenario_id']}: {status}")

    print("\nRun evaluation:")
    print("  python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json")


if __name__ == "__main__":
    main()
