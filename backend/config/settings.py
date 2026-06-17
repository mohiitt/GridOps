import os
from dotenv import load_dotenv

load_dotenv()

GRIDOPS_SEED: int = int(os.getenv("GRIDOPS_SEED", "42"))
ENERGY_PRICE_PER_MWH: float = float(os.getenv("ENERGY_PRICE_PER_MWH", "75"))
SITE_ID: str = "SITE-DS-001"
ANCHOR_TIME: str = "2026-06-16T13:00:00Z"

TFY_GATEWAY_BASE_URL: str = os.getenv("TFY_GATEWAY_BASE_URL", "")
TFY_API_KEY: str = os.getenv("TFY_API_KEY", "")

ANOMALY_SERVICE_URL: str = os.getenv("ANOMALY_SERVICE_URL", "http://localhost:8001")
INGESTION_SERVICE_URL: str = os.getenv("INGESTION_SERVICE_URL", "http://localhost:8002")
CREW_SERVICE_URL: str = os.getenv("CREW_SERVICE_URL", "http://localhost:8003")
INCIDENT_API_URL: str = os.getenv("INCIDENT_API_URL", "http://localhost:8000")

USE_ML: bool = os.getenv("USE_ML", "false").lower() == "true"

SCENARIO_SEEDS: dict[str, int] = {
    "normal_operation": 42,
    "inverter_cooling_degradation": 142,
    "bess_thermal_risk": 242,
    "weather_false_positive": 342,
    "assets": 42,
}
