"""
Feature extraction for anomaly scoring per §13.5.

Takes a telemetry window (list of payload dicts) + alerts + weather + forecast
and returns a feature dict used by scoring.py.
"""
from __future__ import annotations

from typing import Any


def extract_features(
    asset_type: str,
    telemetry_window: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    weather: dict[str, Any] | None,
    forecast: dict[str, Any] | None,
    dispatch_active: bool = False,
) -> dict[str, Any]:
    """Compute all scoring features from raw window data."""
    if not telemetry_window:
        return _empty_features()

    if asset_type == "solar_inverter":
        return _inverter_features(telemetry_window, alerts, weather, forecast)
    elif asset_type == "bess_unit":
        return _bess_features(telemetry_window, alerts, dispatch_active)
    else:
        return _empty_features()


def _empty_features() -> dict[str, Any]:
    return {
        "temperature_delta_pct": 0.0,
        "forecast_deviation_pct": 0.0,
        "cooling_fan_instability": False,
        "voltage_variance_increase": False,
        "efficiency_drop": False,
        "weather_adjusted_deviation_pct": 0.0,
        "irradiance_stable": True,
        "cloud_cover_pct": 0.0,
        "dispatch_active": False,
        "corroborating_count": 0,
    }


def _inverter_features(
    window: list[dict],
    alerts: list[dict],
    weather: dict | None,
    forecast: dict | None,
) -> dict[str, Any]:
    temps = [p.get("inverter_temperature_c", 0.0) for p in window]
    fans = [p.get("cooling_fan_rpm", 9999) for p in window]
    effs = [p.get("conversion_efficiency_pct", 100.0) for p in window]
    volt_vars = [p.get("voltage_variance", 0.0) for p in window]

    # Baseline from first 20% of window (before anomaly)
    n = len(temps)
    baseline_n = max(1, n // 5)
    baseline_temp = sum(temps[:baseline_n]) / baseline_n
    current_temp = temps[-1] if temps else 0.0

    # temperature_delta_pct: percent increase from baseline
    if baseline_temp > 0:
        temp_delta_pct = ((current_temp - baseline_temp) / baseline_temp) * 100.0
    else:
        temp_delta_pct = 0.0

    # cooling_fan_instability: any recent fan < 1200 RPM
    recent_fans = fans[max(0, n - 6):]
    fan_instability = any(r < 1200 for r in recent_fans)

    # voltage_variance_increase: recent volt_var > 2.0
    recent_vv = volt_vars[max(0, n - 6):]
    volt_var_inc = any(v > 2.0 for v in recent_vv)

    # efficiency_drop: current efficiency < 96%
    current_eff = effs[-1] if effs else 100.0
    eff_drop = current_eff < 96.0

    # forecast_deviation_pct
    fc_dev = forecast.get("forecast_error_pct", 0.0) if forecast else 0.0

    # weather-adjusted deviation: if irradiance explains the drop (plan §10)
    # Recompute expected using CURRENT irradiance; if actual tracks → weather explains it
    irradiance = weather.get("irradiance_w_m2", 910.0) if weather else 910.0
    irradiance_stable = irradiance > 800.0
    cloud_cover = weather.get("cloud_cover_pct", 0.0) if weather else 0.0
    NOMINAL_IRRADIANCE = 910.0  # W/m² (desert day reference)

    if forecast and weather:
        expected_mw = forecast.get("expected_output_mw", 0.0)
        actual_mw = forecast.get("actual_output_mw", expected_mw)
        ambient = weather.get("ambient_temperature_c", 25.0)
        temp_derate = 1.0 - 0.004 * max(0.0, ambient - 25.0)

        # Capacity estimated from NOMINAL conditions (irradiance=910 W/m²)
        nominal_temp_derate = 1.0 - 0.004 * max(0.0, ambient - 25.0)
        nominal_expected = expected_mw  # This is the raw forecast (based on nominal irradiance)
        # Weather-adjusted expected = scale by current/nominal irradiance ratio
        irr_ratio = irradiance / NOMINAL_IRRADIANCE
        wa_expected = nominal_expected * irr_ratio
        if wa_expected > 0.01:
            wa_dev = ((wa_expected - actual_mw) / wa_expected) * 100.0
        else:
            wa_dev = 0.0
    else:
        wa_dev = fc_dev

    # Count corroborating features
    corr_count = sum([
        temp_delta_pct > 10.0,
        fan_instability,
        volt_var_inc,
        eff_drop,
        fc_dev > 10.0,
    ])

    return {
        "temperature_delta_pct": round(temp_delta_pct, 2),
        "forecast_deviation_pct": round(fc_dev, 2),
        "cooling_fan_instability": fan_instability,
        "voltage_variance_increase": volt_var_inc,
        "efficiency_drop": eff_drop,
        "weather_adjusted_deviation_pct": round(wa_dev, 2),
        "irradiance_stable": irradiance_stable,
        "cloud_cover_pct": round(cloud_cover, 2),
        "dispatch_active": False,
        "corroborating_count": corr_count,
    }


def _bess_features(
    window: list[dict],
    alerts: list[dict],
    dispatch_active: bool,
) -> dict[str, Any]:
    bat_temps = [p.get("battery_temperature_c", 0.0) for p in window]
    cool_temps = [p.get("cooling_loop_temp_c", 0.0) for p in window]
    thermal_levels = [p.get("thermal_warning_level", "normal") for p in window]

    n = len(bat_temps)
    baseline_n = max(1, n // 5)
    baseline_bat = sum(bat_temps[:baseline_n]) / baseline_n
    current_bat = bat_temps[-1] if bat_temps else 0.0
    current_cool = cool_temps[-1] if cool_temps else 0.0

    if baseline_bat > 0:
        temp_delta_pct = ((current_bat - baseline_bat) / baseline_bat) * 100.0
    else:
        temp_delta_pct = 0.0

    # cooling_fan_instability: cooling loop temp > 38°C
    cool_instability = current_cool > 38.0

    # voltage_variance_increase: used as thermal escalation proxy
    current_level = thermal_levels[-1] if thermal_levels else "normal"
    thermal_escalated = current_level in ("warning", "critical")

    # efficiency_drop: battery temperature above risk threshold
    bat_above_threshold = current_bat > 45.0

    # forecast deviation not applicable to BESS directly
    fc_dev = 0.0

    corr_count = sum([
        temp_delta_pct > 10.0,
        cool_instability,
        thermal_escalated,
        bat_above_threshold,
        dispatch_active,
    ])

    return {
        "temperature_delta_pct": round(temp_delta_pct, 2),
        "forecast_deviation_pct": fc_dev,
        "cooling_fan_instability": cool_instability,
        "voltage_variance_increase": thermal_escalated,
        "efficiency_drop": bat_above_threshold,
        "weather_adjusted_deviation_pct": 0.0,
        "irradiance_stable": True,
        "cloud_cover_pct": 0.0,
        "dispatch_active": dispatch_active,
        "corroborating_count": corr_count,
    }
