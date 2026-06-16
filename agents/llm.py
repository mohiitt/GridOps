"""
TrueFoundry AI Gateway LLM client per §14.1.

Priority routing (§15 fallback plan):
  1. TrueFoundry AI Gateway (TFY_GATEWAY_BASE_URL + TFY_API_KEY) — primary
  2. Direct OpenAI (OPENAI_API_KEY) — fallback if gateway not configured
  3. RuntimeError — if neither is available

All LLM calls go through TFY_GATEWAY_BASE_URL when credentials exist.
Default model: openai/gpt-4o-mini.
Operator Briefing Agent uses gpt-4o.
"""
from __future__ import annotations

import logging
import os

from crewai import LLM

logger = logging.getLogger("gridops.agents.llm")


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
