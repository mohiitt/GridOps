"""
Event Ingestion Service — FastAPI, port 8002 per §13.4.

Endpoints:
  POST /ingest              → accept one Envelope; triggers crew on new candidate
  POST /set_context         → set scenario metadata before streaming
  GET  /events/stream       → SSE live event feed (for frontend ticker)
  GET  /state/{asset_id}    → current window (debug)
  GET  /candidates          → list of open incident candidates
  POST /reset               → reset state between scenarios
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# json is needed both for SSE serialization and asset name lookup

import requests as _requests
from fastapi import BackgroundTasks, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from common.envelope import Envelope
from .event_router import route_event
from .state_store import store
from . import correlation

logger = logging.getLogger("gridops.ingestion")

app = FastAPI(
    title="GridOps Event Ingestion Service",
    description="Ingests event envelopes and triggers incident correlation",
    version="1.0.0",
)

# CORS — required so the frontend EventSource can connect to port 8002
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── SSE broadcast state ────────────────────────────────────────────────────────
# Each connected SSE client gets its own asyncio.Queue entry.
_live_subscribers: list[asyncio.Queue] = []
_main_loop: asyncio.AbstractEventLoop | None = None  # captured at startup


@app.on_event("startup")
async def _capture_loop() -> None:
    """Store the running event loop so sync handlers can schedule onto it."""
    global _main_loop
    _main_loop = asyncio.get_event_loop()
    # Start optional Kafka consumer if configured
    _kafka_bootstrap = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "").strip()
    if _kafka_bootstrap:
        asyncio.create_task(_kafka_consumer_loop(_kafka_bootstrap))
        logger.info("Kafka consumer task started → %s", _kafka_bootstrap)
    else:
        logger.info("KAFKA_BOOTSTRAP_SERVERS not set — Kafka consumer disabled (HTTP-only mode)")


async def _kafka_consumer_loop(bootstrap_servers: str) -> None:
    """
    Background task: consumes events from Kafka topic `gridops.raw.events`
    and feeds them through the same ingest pipeline as the HTTP endpoint.
    Only active when KAFKA_BOOTSTRAP_SERVERS is configured.
    """
    topic = os.environ.get("KAFKA_TOPIC", "gridops.raw.events")
    group_id = os.environ.get("KAFKA_CONSUMER_GROUP", "gridops-ingestion")

    try:
        from confluent_kafka import Consumer, KafkaException
    except ImportError:
        logger.warning("confluent-kafka not installed — Kafka consumer unavailable")
        return

    conf = {
        "bootstrap.servers": bootstrap_servers,
        "group.id": group_id,
        "auto.offset.reset": "latest",
        "enable.auto.commit": True,
        "session.timeout.ms": 10_000,
    }

    consumer = Consumer(conf)
    consumer.subscribe([topic])
    logger.info("Kafka consumer subscribed to topic=%s group=%s", topic, group_id)

    loop = asyncio.get_event_loop()
    try:
        while True:
            # Poll in a thread pool so we don't block the event loop
            msg = await loop.run_in_executor(None, lambda: consumer.poll(timeout=1.0))
            if msg is None:
                continue
            if msg.error():
                from confluent_kafka import KafkaError
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                logger.error("Kafka consumer error: %s", msg.error())
                continue

            try:
                raw = json.loads(msg.value().decode("utf-8"))
                envelope = Envelope(**raw)
                # Reuse the same ingest pipeline — non-blocking call
                await loop.run_in_executor(None, lambda e=envelope: _process_envelope(e))
                logger.debug("Kafka event ingested: %s %s", envelope.event_type, envelope.asset_id)
            except Exception as exc:
                logger.warning("Kafka message parse/ingest failed: %s", exc)
    except asyncio.CancelledError:
        pass
    finally:
        consumer.close()
        logger.info("Kafka consumer closed")


def _broadcast_sync(summary: dict[str, Any]) -> None:
    """
    Thread-safe broadcast to all SSE subscribers.
    Called from the sync ingest endpoint; schedules onto the main event loop.
    """
    if _main_loop is not None and _main_loop.is_running():
        _main_loop.call_soon_threadsafe(_broadcast_nowait, summary)


def _broadcast_nowait(summary: dict[str, Any]) -> None:
    """Put event summary in every subscriber queue (non-blocking)."""
    dead: list[asyncio.Queue] = []
    for q in list(_live_subscribers):
        try:
            q.put_nowait(summary)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            _live_subscribers.remove(q)
        except ValueError:
            pass

# Track when the current scenario window started (per asset)
_scenario_window_start: dict[str, str] = {}

# Scenario context set by /set_context before streaming
_scenario_context: dict[str, str] = {
    "scenario": "inverter_cooling_degradation",
    "scenario_id": "SCN-B",
    "site_id": "SITE-DS-001",
}

SCENARIO_IDS = {
    "normal_operation": "SCN-A",
    "inverter_cooling_degradation": "SCN-B",
    "bess_thermal_risk": "SCN-C",
    "weather_false_positive": "SCN-D",
}

CREW_SERVICE_URL = os.getenv("CREW_SERVICE_URL", "http://localhost:8003")
INCIDENT_API_URL = os.getenv("INCIDENT_API_URL", "http://localhost:8000")


# ── Background dispatch ────────────────────────────────────────────────────────

def dispatch_to_crew(candidate: dict[str, Any], context: dict[str, str]) -> None:
    """
    Background task: POST candidate to crew service, register report with incident API.
    Errors are logged but never propagated (keeps ingestion service stable).
    """
    crew_url = os.getenv("CREW_SERVICE_URL", CREW_SERVICE_URL)
    api_url = os.getenv("INCIDENT_API_URL", INCIDENT_API_URL)

    try:
        logger.info(
            "Dispatching candidate %s to crew service %s",
            candidate.get("candidate_id"),
            crew_url,
        )
        resp = _requests.post(
            f"{crew_url}/run_incident",
            json={"candidate": candidate, "context": context},
            timeout=300,  # crew may take up to 5 min with 9 LLM calls
        )
        resp.raise_for_status()
        report = resp.json()
        inc_id = report.get("incident_id", "unknown")
        logger.info("Crew produced report %s", inc_id)
    except Exception as exc:
        logger.error("Crew dispatch failed for candidate %s: %s", candidate.get("candidate_id"), exc)
        return

    # Register with incident API
    try:
        reg = _requests.post(f"{api_url}/api/reports", json=report, timeout=15)
        reg.raise_for_status()
        logger.info("Report %s registered with incident API", inc_id)
    except Exception as exc:
        logger.error("Failed to register report %s with incident API: %s", inc_id, exc)


# ── Request / response models ─────────────────────────────────────────────────

class IngestResponse(BaseModel):
    status: str
    candidates_emitted: int
    candidate_id: str | None = None


class SetContextRequest(BaseModel):
    scenario: str
    scenario_id: str | None = None   # auto-derived from scenario if omitted
    site_id: str = "SITE-DS-001"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/set_context")
def set_context(req: SetContextRequest) -> dict[str, str]:
    """Set the current scenario context. Call this before streaming events."""
    scenario_id = req.scenario_id or SCENARIO_IDS.get(req.scenario, "SCN-B")
    _scenario_context.update({
        "scenario": req.scenario,
        "scenario_id": scenario_id,
        "site_id": req.site_id,
    })
    return {"status": "ok", **_scenario_context}


@app.post("/ingest", response_model=IngestResponse)
def ingest(envelope: Envelope, background_tasks: BackgroundTasks) -> IngestResponse:
    """
    Ingest one event envelope. When a new incident candidate is emitted,
    dispatches to the crew service in the background per §13.7.
    """
    asset_id = envelope.asset_id or envelope.site_id
    if asset_id not in _scenario_window_start:
        _scenario_window_start[asset_id] = envelope.timestamp

    route_event(envelope.model_dump(), store)

    candidate = None
    if envelope.event_type == "alert" and envelope.asset_id:
        window_start = _scenario_window_start.get(envelope.asset_id, envelope.timestamp)
        candidate = correlation.on_new_alert(
            asset_id=envelope.asset_id,
            envelope_timestamp=envelope.timestamp,
            store=store,
            window_start=window_start,
        )

    if candidate:
        from pathlib import Path as _Path
        assets_path = _Path("data/assets.json")
        asset_name = candidate["asset_id"]
        try:
            assets_data = json.loads(assets_path.read_text())
            asset = next(
                (a for a in assets_data.get("assets", [])
                 if a["asset_id"] == candidate["asset_id"]),
                None,
            )
            if asset:
                asset_name = asset.get("asset_name", candidate["asset_id"])
        except Exception:
            pass

        context = {
            **_scenario_context,
            "asset_name": asset_name,
        }
        background_tasks.add_task(dispatch_to_crew, candidate, context)
        logger.info(
            "Incident candidate %s queued for crew dispatch (scenario=%s)",
            candidate["candidate_id"],
            context.get("scenario_id"),
        )

    # Broadcast a compact summary to SSE subscribers (live event feed)
    _broadcast_sync(_make_broadcast_summary(envelope, candidate))

    return IngestResponse(
        status="ok",
        candidates_emitted=1 if candidate else 0,
        candidate_id=candidate["candidate_id"] if candidate else None,
    )


def _process_envelope(envelope: Envelope) -> None:
    """
    Shared processing pipeline for both HTTP /ingest and Kafka consumer.
    Mutates global state; caller must not hold the GIL across threads.
    """
    import threading
    # Reuse the HTTP ingest logic in a thread-safe way via a fake BackgroundTasks
    asset_id = envelope.asset_id or envelope.site_id
    if asset_id not in _scenario_window_start:
        _scenario_window_start[asset_id] = envelope.timestamp

    route_event(envelope.model_dump(), store)

    candidate = None
    if envelope.event_type == "alert" and envelope.asset_id:
        window_start = _scenario_window_start.get(envelope.asset_id, envelope.timestamp)
        candidate = correlation.on_new_alert(
            asset_id=envelope.asset_id,
            envelope_timestamp=envelope.timestamp,
            store=store,
            window_start=window_start,
        )

    if candidate:
        context = {**_scenario_context}
        thread = threading.Thread(
            target=dispatch_to_crew, args=(candidate, context), daemon=True
        )
        thread.start()

    _broadcast_sync(_make_broadcast_summary(envelope, candidate))


def _make_broadcast_summary(envelope: Envelope, candidate: Any) -> dict[str, Any]:
    """Build a small JSON object that the frontend SSE ticker can render."""
    payload = envelope.payload or {}
    summary: dict[str, Any] = {
        "id": envelope.event_id,
        "type": envelope.event_type,
        "asset": envelope.asset_id or envelope.site_id or "—",
        "ts": envelope.timestamp,
        "wall_ms": int(time.time() * 1000),
    }

    etype = envelope.event_type
    if etype == "telemetry":
        temp = payload.get("inverter_temperature_c") or payload.get("cell_temp_c")
        pwr = payload.get("ac_power_output_mw") or payload.get("discharge_power_mw")
        fan = payload.get("cooling_fan_rpm")
        summary["temp"] = round(float(temp), 1) if temp is not None else None
        summary["power"] = round(float(pwr), 2) if pwr is not None else None
        summary["fan"] = int(fan) if fan is not None else None
    elif etype == "alert":
        summary["severity"] = payload.get("severity", "info")
        summary["alert_type"] = payload.get("alert_type", "")
        summary["msg"] = str(payload.get("message", ""))[:80]
    elif etype in ("weather", "meteorological"):
        summary["irr"] = payload.get("irradiance_w_m2")
        summary["amb"] = payload.get("ambient_temp_c")
    elif etype == "forecast":
        summary["expected_mw"] = payload.get("expected_output_mw")

    if candidate:
        summary["candidate_id"] = candidate.get("candidate_id")

    return summary


@app.get("/events/stream")
async def live_event_stream() -> StreamingResponse:
    """
    SSE endpoint — streams every ingested event as a compact JSON summary.
    Frontend subscribes with EventSource for the live event ticker.
    Sends a keepalive comment every 15s to prevent connection drops.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _live_subscribers.append(q)

    async def _generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            try:
                _live_subscribers.remove(q)
            except ValueError:
                pass

    return StreamingResponse(
        _generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/state/{asset_id}")
def get_state(asset_id: str) -> dict[str, Any]:
    """Return current state window for an asset (debug endpoint)."""
    return store.snapshot(asset_id)


@app.get("/candidates")
def get_candidates() -> list[dict[str, Any]]:
    """Return all emitted incident candidates."""
    return correlation.get_all_candidates()


@app.post("/reset")
def reset() -> dict[str, str]:
    """Reset state between scenarios (demo/testing use)."""
    _scenario_window_start.clear()
    correlation.reset()
    from .state_store import StateStore
    # Replace store contents
    store._assets.clear()
    if hasattr(store, "_latest_site_weather"):
        del store._latest_site_weather
    return {"status": "reset"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ingestion"}


# ── Live stream control ────────────────────────────────────────────────────────

_live_stream_proc: subprocess.Popen | None = None  # type: ignore[type-arg]


@app.post("/live-stream/start")
def start_live_stream(
    speed: float = Query(default=20.0, description="Sim-minutes per real second"),
    phase1_real_mins: float = Query(default=0.1, description="Real minutes of normal operation before degradation (default=6s)"),
    max_runtime_secs: float = Query(default=15.0, description="Auto-stop after this many seconds (0=forever)"),
) -> dict[str, Any]:
    """
    Start the physics-based live event generator (stream_live.py) as a background process.
    Resets ingestion state first, then begins streaming INV-042 events continuously.
    Events appear in the SSE /events/stream ticker automatically.
    """
    global _live_stream_proc

    # Kill any existing live stream
    if _live_stream_proc and _live_stream_proc.poll() is None:
        _live_stream_proc.terminate()
        try:
            _live_stream_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _live_stream_proc.kill()

    # Reset ingestion state inline (same as POST /reset)
    _scenario_window_start.clear()
    correlation.reset()
    store._assets.clear()
    if hasattr(store, "_latest_site_weather"):
        del store._latest_site_weather

    # Pre-set scenario context for inverter_cooling_degradation
    _scenario_context.update({
        "scenario": "inverter_cooling_degradation",
        "scenario_id": "SCN-B",
        "site_id": "SITE-DS-001",
    })

    # Locate stream_live.py (repo_root/scripts/stream_live.py)
    repo_root = Path(__file__).parents[2]
    script = repo_root / "scripts" / "stream_live.py"
    env = {**os.environ, "PYTHONPATH": str(repo_root)}

    _live_stream_proc = subprocess.Popen(
        [
            sys.executable, str(script),
            "--speed", str(speed),
            "--phase1-real-mins", str(phase1_real_mins),
            "--max-runtime-secs", str(max_runtime_secs),
            "--ingestion-url", "http://localhost:8002",
        ],
        cwd=str(repo_root),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    estimated_incident_secs = phase1_real_mins * 60 + 15  # phase1 + ~15s degradation to first alert
    logger.info(
        "Live stream started: PID=%d speed=%.0fx phase1=%.0fs max=%ss",
        _live_stream_proc.pid, speed, phase1_real_mins * 60, max_runtime_secs,
    )
    return {
        "status": "started",
        "pid": _live_stream_proc.pid,
        "speed": speed,
        "phase1_real_mins": phase1_real_mins,
        "max_runtime_secs": max_runtime_secs,
        "estimated_incident_minutes": round(estimated_incident_secs / 60, 1),
        "estimated_incident_secs": round(estimated_incident_secs),
    }


@app.post("/live-stream/stop")
def stop_live_stream() -> dict[str, Any]:
    """Stop the running live stream generator."""
    global _live_stream_proc
    if _live_stream_proc and _live_stream_proc.poll() is None:
        _live_stream_proc.terminate()
        try:
            _live_stream_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            _live_stream_proc.kill()
        logger.info("Live stream stopped")
        return {"status": "stopped"}
    return {"status": "not_running"}


@app.get("/live-stream/status")
def live_stream_status() -> dict[str, Any]:
    """Check whether the live stream generator is running."""
    global _live_stream_proc
    if _live_stream_proc is None:
        return {"status": "never_started"}
    if _live_stream_proc.poll() is None:
        return {"status": "running", "pid": _live_stream_proc.pid}
    return {"status": "stopped", "returncode": _live_stream_proc.returncode}
