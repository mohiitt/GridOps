"""
TrueFoundry AI Gateway LLM client per §14.1.

All LLM calls go through TFY_GATEWAY_BASE_URL (OpenAI-compatible).
Default model: openai/gpt-4o-mini.
Operator Briefing Agent uses gpt-4o.
"""
from __future__ import annotations

import os

from crewai import LLM


def gateway_llm(model: str = "openai/gpt-4o-mini", temperature: float = 0.1) -> LLM:
    """Return a CrewAI LLM routed through TrueFoundry AI Gateway."""
    base_url = os.environ.get("TFY_GATEWAY_BASE_URL", "")
    api_key = os.environ.get("TFY_API_KEY", "")

    if not base_url or not api_key:
        raise RuntimeError(
            "TFY_GATEWAY_BASE_URL and TFY_API_KEY must be set in environment. "
            "Copy .env.example to .env and fill in your credentials."
        )

    return LLM(
        model=model,
        base_url=base_url,
        api_key=api_key,
        temperature=temperature,
    )


def default_llm() -> LLM:
    """gpt-4o-mini via gateway for most agents."""
    return gateway_llm(model="openai/gpt-4o-mini", temperature=0.1)


def briefing_llm() -> LLM:
    """gpt-4o via gateway for the Operator Briefing Agent."""
    return gateway_llm(model="openai/gpt-4o", temperature=0.2)
