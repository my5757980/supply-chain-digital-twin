"""Contingency Plan Agent (T065): produces a step-by-step, plain-language
plan for a disruption — including a fallback plan when no viable
alternative sourcing option exists (spec.md US3 Acceptance Scenario 3),
rather than silently omitting the alert.
"""

from __future__ import annotations

from app.adapters.signals import Signal
from app.agents.llm_client import ChatClient, OpenAiCompatibleClient, parse_json_reply
from app.agents.sourcing_recommendation_agent import SupplierCandidate

AGENT_NAME = "contingency-plan-agent-v1"


class ContingencyPlanAgent:
    def __init__(self, client: ChatClient | None = None) -> None:
        self._client = client or OpenAiCompatibleClient()

    def generate_plan(
        self,
        signal: Signal,
        recommendation: SupplierCandidate | None,
    ) -> list[str]:
        raw = self._client.complete(
            self._build_prompt(signal, recommendation), max_tokens=500
        )
        data = parse_json_reply(raw)
        steps = [str(step) for step in data["steps"]]
        if not steps:
            raise ValueError("Contingency plan must include at least one step")
        return steps

    @staticmethod
    def _build_prompt(signal: Signal, recommendation: SupplierCandidate | None) -> str:
        context_lines = "\n".join(f"- {key}: {value}" for key, value in signal.context.items())
        if recommendation is not None:
            source_desc = (
                "the business's own registered backup supplier"
                if recommendation.source == "own_backup"
                else "a vetted supplier from a local directory"
            )
            alternative_line = (
                f"A possible alternative has been identified: {recommendation.name} "
                f"({source_desc})."
            )
        else:
            alternative_line = (
                "No alternative supplier could be identified automatically. The plan MUST "
                "still give the owner concrete next steps (e.g., contacting the affected "
                "supplier directly, checking existing stock, or sourcing locally themselves) "
                "rather than leaving them with nothing to do."
            )
        return (
            "You are a supply chain contingency-planning assistant for a small "
            "business owner. Given the disruption below, respond with ONLY a "
            'JSON object of the form {"steps": [<3-5 short, plain-language, '
            'ordered action steps a non-technical owner can follow, no jargon>]}.\n\n'
            f"Disruption type: {signal.type}\n"
            f"Context:\n{context_lines}\n"
            f"{alternative_line}"
        )
