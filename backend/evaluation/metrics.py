"""
Evaluation metrics per §16.1.

Per-scenario result fields:
  - incident_detected: bool
  - alert_grouping_match: bool
  - root_cause_match: bool
  - priority_match: bool
  - action_match: bool
  - approval_match: bool
  - business_impact_within_range: bool
  - latency_ms: int
  - cost_usd: float
  - overall_result: "pass" | "fail"

overall_result == "pass" requires: root_cause, priority, action, approval,
and incident-detection all matching. (Alert grouping is informational only.)
"""
from __future__ import annotations

from typing import Any


def evaluate_scenario(
    report: dict[str, Any] | None,
    ground_truth: dict[str, Any],
) -> dict[str, Any]:
    """
    Compare a generated incident report against one ground-truth entry.
    Returns per-scenario eval result.
    """
    gt = ground_truth
    scenario_id = gt["scenario_id"]
    incident_expected = gt["incident_expected"]

    # No report generated for a non-incident scenario = correct (no false positive)
    if report is None:
        incident_detected = False
        if not incident_expected:
            return {
                "scenario_id": scenario_id,
                "incident_detected": False,
                "alert_grouping_match": True,
                "root_cause_match": True,
                "priority_match": True,
                "action_match": True,
                "approval_match": True,
                "business_impact_within_range": True,
                "latency_ms": 0,
                "cost_usd": 0.0,
                "overall_result": "pass",
                "notes": "Correctly produced no incident for non-incident scenario",
            }
        else:
            return {
                "scenario_id": scenario_id,
                "incident_detected": False,
                "alert_grouping_match": False,
                "root_cause_match": False,
                "priority_match": False,
                "action_match": False,
                "approval_match": False,
                "business_impact_within_range": False,
                "latency_ms": 0,
                "cost_usd": 0.0,
                "overall_result": "fail",
                "notes": "Expected incident but none was generated",
            }

    # Report exists
    incident_detected = True

    # If report was generated for a non-incident scenario → false escalation
    if not incident_expected:
        report_priority = report.get("priority", "low")
        report_root_cause = report.get("root_cause", "")
        # Allow if root_cause matches expected (weather_driven or normal_operation)
        root_cause_match = report_root_cause == gt.get("expected_root_cause", "")
        priority_match = report.get("priority") == gt.get("expected_priority")
        action_match = report.get("recommended_action") == gt.get("expected_action")
        approval_match = report.get("governance", {}).get("approval_required") == gt.get("approval_required")
        overall = "pass" if (root_cause_match and priority_match and action_match and approval_match) else "fail"
        return {
            "scenario_id": scenario_id,
            "incident_detected": True,
            "alert_grouping_match": True,
            "root_cause_match": root_cause_match,
            "priority_match": priority_match,
            "action_match": action_match,
            "approval_match": approval_match,
            "business_impact_within_range": True,
            "latency_ms": report.get("trace", {}).get("total_latency_ms", 0),
            "cost_usd": report.get("trace", {}).get("total_cost_usd", 0.0),
            "overall_result": overall,
            "notes": "Report generated for non-incident scenario",
        }

    # Standard per-scenario metrics
    alert_count = report.get("alert_count", 0)
    alert_grouping_match = (
        gt["expected_grouped_alerts_min"] <= alert_count <= gt["expected_grouped_alerts_max"]
    )

    root_cause_match = report.get("root_cause") == gt["expected_root_cause"]
    priority_match = report.get("priority") == gt["expected_priority"]
    action_match = report.get("recommended_action") == gt["expected_action"]
    approval_match = report.get("governance", {}).get("approval_required") == gt["approval_required"]

    energy_loss = report.get("business_impact", {}).get("energy_loss_mwh_per_day", 0.0)
    business_impact_within_range = (
        gt["expected_energy_impact_mwh_day_min"]
        <= energy_loss
        <= gt["expected_energy_impact_mwh_day_max"]
    )

    latency_ms = report.get("trace", {}).get("total_latency_ms", 0)
    cost_usd = report.get("trace", {}).get("total_cost_usd", 0.0)

    # overall_result requires root_cause, priority, action, approval, incident_detected
    overall = "pass" if (
        incident_detected == incident_expected
        and root_cause_match
        and priority_match
        and action_match
        and approval_match
    ) else "fail"

    return {
        "scenario_id": scenario_id,
        "incident_detected": incident_detected,
        "alert_grouping_match": alert_grouping_match,
        "root_cause_match": root_cause_match,
        "priority_match": priority_match,
        "action_match": action_match,
        "approval_match": approval_match,
        "business_impact_within_range": business_impact_within_range,
        "latency_ms": latency_ms,
        "cost_usd": cost_usd,
        "overall_result": overall,
    }


def aggregate_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute aggregate metrics across all scenarios per §16.2."""
    n = len(results)
    if n == 0:
        return {"scenarios": 0, "passed": 0}

    passed = sum(1 for r in results if r["overall_result"] == "pass")
    incident_results = [r for r in results if r.get("incident_detected")]
    non_incident_false_esc = sum(
        1 for r in results
        if not r.get("incident_detected") is False and r.get("notes", "").startswith("Report generated for non")
    )

    root_cause_accuracy = sum(1 for r in results if r["root_cause_match"]) / n
    false_escalation_rate = sum(
        1 for r in results
        if r.get("notes", "").startswith("Report generated for non")
        and r.get("overall_result") == "fail"
    ) / n

    latencies = [r["latency_ms"] for r in results if r.get("latency_ms", 0) > 0]
    costs = [r["cost_usd"] for r in results if r.get("cost_usd", 0.0) > 0]

    return {
        "scenarios": n,
        "passed": passed,
        "failed": n - passed,
        "pass_rate": round(passed / n, 3),
        "root_cause_accuracy": round(root_cause_accuracy, 3),
        "false_escalation_rate": round(false_escalation_rate, 3),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else 0,
        "avg_cost_usd": round(sum(costs) / len(costs), 6) if costs else 0.0,
    }
