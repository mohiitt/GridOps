"""
Rule-based anomaly scoring per §13.5.

Score formula (exact from plan):
  score = 0.35*norm(temperature_delta_pct, 0..25)
        + 0.25*norm(forecast_deviation_pct, 0..20)
        + 0.20*cooling_fan_instability(bool)
        + 0.10*voltage_variance_increase(bool)
        + 0.10*efficiency_drop(bool)

Severity: critical if >=0.85, high if >=0.6, medium if >=0.4, low otherwise.
Symptom decision tree based on asset type and feature combination.
"""
from __future__ import annotations

import os
from typing import Any

from .features import extract_features


def _norm(value: float, lo: float, hi: float) -> float:
    """Normalize a value to [0, 1] within [lo, hi], clamped."""
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def compute_score(features: dict[str, Any], asset_type: str) -> dict[str, Any]:
    """Compute the anomaly score from extracted features."""
    temp_delta = features.get("temperature_delta_pct", 0.0)
    fc_dev = features.get("forecast_deviation_pct", 0.0)
    fan_instability = features.get("cooling_fan_instability", False)
    volt_var_inc = features.get("voltage_variance_increase", False)
    eff_drop = features.get("efficiency_drop", False)
    wa_dev = features.get("weather_adjusted_deviation_pct", 0.0)
    irradiance_stable = features.get("irradiance_stable", True)
    cloud_cover = features.get("cloud_cover_pct", 0.0)
    dispatch_active = features.get("dispatch_active", False)
    corr_count = features.get("corroborating_count", 0)

    # Weather variant: if weather-adjusted deviation < 5%, weather explains the loss
    if asset_type == "solar_inverter" and wa_dev < 5.0 and cloud_cover > 20.0:
        symptom = "weather_driven"
        score = min(0.35, 0.35 * _norm(temp_delta, 0, 25))
        severity = "low" if score < 0.4 else "medium"
        confidence = max(0.5, 0.5 + 0.4 * (corr_count / 4.0))
        return {
            "anomaly_score": round(score, 3),
            "severity": severity,
            "symptom": symptom,
            "confidence": round(min(confidence, 0.95), 3),
            "features": features,
        }

    # Standard formula from §13.5
    score = (
        0.35 * _norm(temp_delta, 0.0, 25.0)
        + 0.25 * _norm(fc_dev, 0.0, 20.0)
        + 0.20 * (1.0 if fan_instability else 0.0)
        + 0.10 * (1.0 if volt_var_inc else 0.0)
        + 0.10 * (1.0 if eff_drop else 0.0)
    )

    # BESS: also factor in dispatch and critical thermal warning
    if asset_type == "bess_unit" and dispatch_active:
        score = min(1.0, score + 0.05)

    # Severity thresholds from plan
    if score >= 0.85:
        severity = "critical"
    elif score >= 0.60:
        severity = "high"
    elif score >= 0.40:
        severity = "medium"
    else:
        severity = "low"

    # Symptom decision tree
    if asset_type == "solar_inverter":
        if fan_instability and temp_delta > 10:
            symptom = "thermal_derating"
        elif temp_delta > 10:
            symptom = "thermal_derating"
        else:
            symptom = "nominal"
    elif asset_type == "bess_unit":
        if features.get("efficiency_drop") and dispatch_active:
            symptom = "thermal_runaway_risk"
        elif features.get("cooling_fan_instability"):
            symptom = "thermal_runaway_risk"
        else:
            symptom = "nominal"
    else:
        symptom = "nominal"

    # Confidence: clip(0.5 + 0.4*(corroborating_features/4), 0, 0.95) from plan
    confidence = min(0.95, max(0.5, 0.5 + 0.4 * (corr_count / 4.0)))

    return {
        "anomaly_score": round(score, 3),
        "severity": severity,
        "symptom": symptom,
        "confidence": round(confidence, 3),
        "features": features,
    }


def score_asset(
    asset_id: str,
    asset_type: str,
    telemetry_window: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    weather: dict[str, Any] | None,
    forecast: dict[str, Any] | None,
    dispatch_active: bool = False,
) -> dict[str, Any]:
    """Full scoring pipeline: feature extraction → scoring → structured output."""
    features = extract_features(
        asset_type=asset_type,
        telemetry_window=telemetry_window,
        alerts=alerts,
        weather=weather,
        forecast=forecast,
        dispatch_active=dispatch_active,
    )
    result = compute_score(features, asset_type)
    return {
        "asset_id": asset_id,
        "anomaly_score": result["anomaly_score"],
        "severity": result["severity"],
        "symptom": result["symptom"],
        "confidence": result["confidence"],
        "features": {
            "temperature_delta_pct": features.get("temperature_delta_pct", 0.0),
            "forecast_deviation_pct": features.get("forecast_deviation_pct", 0.0),
            "cooling_fan_instability": features.get("cooling_fan_instability", False),
            "voltage_variance_increase": features.get("voltage_variance_increase", False),
        },
    }
