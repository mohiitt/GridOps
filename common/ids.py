"""Deterministic ID generators for events and records."""
import hashlib


def event_id(prefix: str, asset_id: str, index: int) -> str:
    """Generate a deterministic event ID."""
    return f"evt_{prefix}_{asset_id.lower().replace('-', '')}_{index:04d}"


def alert_id(asset_id: str, index: int) -> str:
    return f"ALT-{asset_id}-{index:04d}"


def record_id(prefix: str, asset_id: str, index: int) -> str:
    return f"{prefix}-{asset_id}-{index:04d}"


def candidate_id(asset_id: str, index: int) -> str:
    return f"CAND-{asset_id}-{index:04d}"


def incident_id(asset_id: str, date_str: str) -> str:
    """e.g. INC-INV042-20260616"""
    clean = asset_id.replace("-", "")
    date_clean = date_str.replace("-", "")
    return f"INC-{clean}-{date_clean}"


def audit_id(index: int) -> str:
    return f"AUD-{index:04d}"


def work_order_id(year: int, sequence: int) -> str:
    return f"WO-{year}-{sequence:05d}"


def dispatch_id(index: int) -> str:
    return f"DSP-{index:04d}"


def correlation_id(asset_id: str, suffix: str) -> str:
    return f"corr_{asset_id.lower().replace('-', '')}_{suffix}"


def short_hash(text: str, length: int = 8) -> str:
    return hashlib.sha1(text.encode()).hexdigest()[:length]
