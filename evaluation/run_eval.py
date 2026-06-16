"""
Evaluation runner per §16.2.

Usage:
  python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json

Loads generated incident reports and compares against ground truth.
Prints per-scenario and aggregate results.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from evaluation.metrics import aggregate_results, evaluate_scenario

SCENARIO_TO_REPORT_KEY = {
    "SCN-A": "normal_operation",
    "SCN-B": "inverter_cooling_degradation",
    "SCN-C": "bess_thermal_risk",
    "SCN-D": "weather_false_positive",
}


def load_reports(reports_dir: Path) -> dict[str, dict]:
    """Load all JSON reports from directory, keyed by scenario_id."""
    reports: dict[str, dict] = {}
    if not reports_dir.exists():
        return reports

    for path in reports_dir.glob("*.json"):
        try:
            report = json.loads(path.read_text())
            scenario_id = report.get("scenario_id")
            if scenario_id:
                reports[scenario_id] = report
        except Exception as exc:
            print(f"[WARN] Could not load {path}: {exc}")

    return reports


def main() -> None:
    parser = argparse.ArgumentParser(description="GridOps evaluation runner")
    parser.add_argument(
        "--reports",
        type=Path,
        default=Path("data/eval_reports"),
        help="Directory containing per-scenario JSON reports",
    )
    parser.add_argument(
        "--ground-truth",
        type=Path,
        default=Path("data/ground_truth.json"),
        help="Path to ground_truth.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to write eval results JSON",
    )
    args = parser.parse_args()

    # Ensure reports directory exists
    args.reports.mkdir(parents=True, exist_ok=True)

    # Load ground truth
    if not args.ground_truth.exists():
        print(f"ERROR: ground_truth.json not found at {args.ground_truth}")
        sys.exit(1)

    ground_truth = json.loads(args.ground_truth.read_text())

    # Load reports
    reports = load_reports(args.reports)
    print(f"Loaded {len(reports)} reports from {args.reports}")
    print(f"Report scenario IDs: {list(reports.keys())}")

    # Evaluate per scenario
    results = []
    for gt in ground_truth:
        scenario_id = gt["scenario_id"]
        report = reports.get(scenario_id)
        result = evaluate_scenario(report, gt)
        results.append(result)

        status_icon = "✓" if result["overall_result"] == "pass" else "✗"
        print(f"\n{status_icon} {scenario_id} — {result['overall_result'].upper()}")
        print(f"  incident_detected:           {result['incident_detected']} (expected: {gt['incident_expected']})")
        print(f"  root_cause_match:            {result['root_cause_match']}")
        print(f"  priority_match:              {result['priority_match']}")
        print(f"  action_match:                {result['action_match']}")
        print(f"  approval_match:              {result['approval_match']}")
        print(f"  alert_grouping_match:        {result['alert_grouping_match']}")
        print(f"  business_impact_within_range:{result['business_impact_within_range']}")
        print(f"  latency_ms:                  {result['latency_ms']}")
        print(f"  cost_usd:                    {result['cost_usd']}")
        if "notes" in result:
            print(f"  notes: {result['notes']}")

    # Aggregate
    agg = aggregate_results(results)
    print(f"\n{'='*50}")
    print("AGGREGATE RESULTS")
    print(f"  scenarios:              {agg['scenarios']}")
    print(f"  passed:                 {agg['passed']}")
    print(f"  failed:                 {agg['failed']}")
    print(f"  pass_rate:              {agg['pass_rate']:.1%}")
    print(f"  root_cause_accuracy:    {agg['root_cause_accuracy']:.1%}")
    print(f"  false_escalation_rate:  {agg['false_escalation_rate']:.1%}")
    print(f"  avg_latency_ms:         {agg['avg_latency_ms']}")
    print(f"  avg_cost_usd:           {agg['avg_cost_usd']}")
    print(f"{'='*50}")

    # Write output
    eval_output = {"per_scenario": results, "aggregate": agg}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(eval_output, indent=2))
        print(f"\nResults written to {args.output}")
    else:
        default_out = args.reports / "eval_results.json"
        default_out.parent.mkdir(parents=True, exist_ok=True)
        default_out.write_text(json.dumps(eval_output, indent=2))
        print(f"\nResults written to {default_out}")

    # Exit code: 0 if all pass, 1 otherwise
    sys.exit(0 if agg["passed"] == agg["scenarios"] else 1)


if __name__ == "__main__":
    main()
