from pydantic import BaseModel, Field
from typing import Any, Literal

EventType = Literal[
    "telemetry", "alert", "weather", "forecast", "maintenance",
    "workorder", "dispatch", "incident", "audit"
]

SourceSystem = Literal[
    "SCADA", "CMMS", "WeatherAPI", "ForecastEngine", "GridOpsAI", "OperatorConsole"
]


class Envelope(BaseModel):
    event_id: str
    event_type: EventType
    source_system: SourceSystem
    site_id: str = "SITE-DS-001"
    asset_id: str | None = None
    timestamp: str            # ISO-8601 Z
    schema_version: str = "1.0"
    correlation_id: str
    payload: dict[str, Any]
