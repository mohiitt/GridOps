"""
TrueFoundry AI Gateway LLM client per §14.1.

Priority routing (§15 fallback plan):
  1. TrueFoundry AI Gateway (TFY_GATEWAY_BASE_URL + TFY_API_KEY) — primary
  2. Direct OpenAI (OPENAI_API_KEY) — fallback if gateway not configured
  3. RuntimeError — if neither is available

All LLM calls go through TFY_GATEWAY_BASE_URL when credentials exist.
Default model: openai/gpt-4o-mini.
Operator Briefing Agent uses gpt-4o.

TrueFoundry Observability:
  - Trace IDs are captured from the LiteLLM response `_hidden_params`
    (field: `additional_headers` → `x-litellm-call-id` or `x-trace-id`).
  - A LiteLLM success callback (`tfy_trace_collector`) is registered at import
    time and populates `LATEST_TFY_TRACES` for the current process.
  - The crew assembler reads this dict when building the incident report.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any

from crewai import LLM

logger = logging.getLogger("gridops.agents.llm")

# ── TrueFoundry trace ID capture ──────────────────────────────────────────────
# Maps litellm_call_id → {trace_id, model, latency_ms, tokens, cost_usd}

LATEST_TFY_TRACES: dict[str, dict[str, Any]] = {}
_traces_lock = threading.Lock()


def _register_litellm_callbacks() -> None:
    """Register a LiteLLM success callback to capture TrueFoundry trace IDs."""
    try:
        import litellm

        def tfy_trace_collector(kwargs: dict, completion_response: Any, start_time: Any, end_time: Any) -> None:
            try:
                call_id = kwargs.get("litellm_call_id", "")
                model = kwargs.get("model", "unknown")

                # TrueFoundry gateway injects trace ID in response headers via
                # additional_headers or via the litellm_params
                response_headers: dict = {}
                if hasattr(completion_response, "_hidden_params"):
                    hp = completion_response._hidden_params or {}
                    response_headers = hp.get("additional_headers", {})

                # Prefer TrueFoundry's trace header, fall back to LiteLLM call ID
                tfy_trace_id = (
                    response_headers.get("x-trace-id")
                    or response_headers.get("x-litellm-call-id")
                    or response_headers.get("cf-ray")          # Cloudflare ray ID
                    or f"litellm_{call_id}"
                )

                # Token usage
                usage = getattr(completion_response, "usage", None) or {}
                if hasattr(usage, "total_tokens"):
                    total_tokens = usage.total_tokens or 0
                    prompt_tokens = usage.prompt_tokens or 0
                    completion_tokens = usage.completion_tokens or 0
                else:
                    total_tokens = usage.get("total_tokens", 0)
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)

                latency_ms = int((end_time - start_time).total_seconds() * 1000)
                # Cost estimate: gpt-4o-mini $0.15/$0.60 per 1M tokens
                cost_usd = round((prompt_tokens * 0.00000015) + (completion_tokens * 0.0000006), 8)

                trace_entry = {
                    "tfy_trace_id": tfy_trace_id,
                    "litellm_call_id": call_id,
                    "model": model,
                    "latency_ms": latency_ms,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "cost_usd": cost_usd,
                    "response_headers": {
                        k: v for k, v in response_headers.items()
                        if k.lower().startswith(("x-", "cf-"))
                    },
                }

                with _traces_lock:
                    LATEST_TFY_TRACES[call_id] = trace_entry

                logger.debug(
                    "TFY trace captured: %s model=%s latency=%dms tokens=%d cost=$%.6f",
                    tfy_trace_id, model, latency_ms, total_tokens, cost_usd,
                )

            except Exception as exc:
                logger.debug("tfy_trace_collector error (non-fatal): %s", exc)

        litellm.success_callback = litellm.success_callback or []
        if tfy_trace_collector not in litellm.success_callback:
            litellm.success_callback.append(tfy_trace_collector)
            logger.info("TrueFoundry LiteLLM trace callback registered")

    except ImportError:
        logger.debug("litellm not available — trace callback skipped")


def get_aggregated_trace_metrics() -> dict[str, Any]:
    """
    Return aggregated metrics across all captured LiteLLM calls.
    Called by the crew assembler to build the trace section of the report.
    """
    with _traces_lock:
        traces = list(LATEST_TFY_TRACES.values())

    if not traces:
        return {}

    # Use the last trace's ID as the primary (most recent = Operator Briefing = final agent)
    primary_trace_id = traces[-1]["tfy_trace_id"] if traces else "unknown"

    return {
        "tfy_trace_id": primary_trace_id,
        "all_call_trace_ids": [t["tfy_trace_id"] for t in traces],
        "llm_calls": len(traces),
        "total_latency_ms": sum(t["latency_ms"] for t in traces),
        "total_tokens": sum(t["total_tokens"] for t in traces),
        "prompt_tokens": sum(t["prompt_tokens"] for t in traces),
        "completion_tokens": sum(t["completion_tokens"] for t in traces),
        "total_cost_usd": round(sum(t["cost_usd"] for t in traces), 8),
        "models_used": list({t["model"] for t in traces}),
    }


def clear_trace_store() -> None:
    """Reset trace store between crew runs."""
    with _traces_lock:
        LATEST_TFY_TRACES.clear()


# Register callback on module import
_register_litellm_callbacks()


def gateway_llm(model: str = "openai/gpt-4o-mini", temperature: float = 0.1) -> LLM:
    """
    Return a CrewAI LLM using priority routing per §15.

    1. TrueFoundry AI Gateway (preferred — provides cost/trace observability).
    2. Direct OpenAI API key (fallback — same interface, no gateway tracing).
    """
    base_url = os.environ.get("TFY_GATEWAY_BASE_URL", "").strip()
    tfy_key = os.environ.get("TFY_API_KEY", "").strip()

    if base_url and tfy_key:
        logger.debug("Using TrueFoundry AI Gateway: %s model=%s", base_url, model)
        return LLM(
            model=model,
            base_url=base_url,
            api_key=tfy_key,
            temperature=temperature,
        )

    # §15 fallback: direct provider key
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key:
        logger.warning(
            "TFY_GATEWAY_BASE_URL/TFY_API_KEY not set — falling back to direct OpenAI key. "
            "Gateway tracing will not be available."
        )
        return LLM(
            model=model,
            api_key=openai_key,
            temperature=temperature,
        )

    raise RuntimeError(
        "No LLM credentials available. Configure one of:\n"
        "  TFY_GATEWAY_BASE_URL + TFY_API_KEY  (preferred — TrueFoundry AI Gateway)\n"
        "  OPENAI_API_KEY                       (fallback — direct OpenAI)\n"
        "Copy .env.example to .env and fill in your credentials."
    )


def default_llm() -> LLM:
    """gpt-4o-mini via gateway (or fallback) for most agents."""
    return gateway_llm(model="openai/gpt-4o-mini", temperature=0.1)


def briefing_llm() -> LLM:
    """gpt-4o via gateway (or fallback) for the Operator Briefing Agent."""
    return gateway_llm(model="openai/gpt-4o", temperature=0.2)


def is_gateway_configured() -> bool:
    """True when TrueFoundry gateway credentials are present."""
    return bool(
        os.environ.get("TFY_GATEWAY_BASE_URL", "").strip()
        and os.environ.get("TFY_API_KEY", "").strip()
    )
