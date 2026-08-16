"""Prediction Agent (T045): turns a raw signal into a DisruptionPrediction.

Constitution Principle IV requires every AI agent's inputs/outputs to be
inspectable and its actions auditable — `predict()` returns a fully typed
`DisruptionPrediction` (or `None`) rather than free-form text, and the
prompt/response boundary is isolated in `_reason` so it's the one place
that ever talks to the LLM.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from app.adapters.signals import Signal
from app.agents.llm_client import ChatClient, OpenAiCompatibleClient, parse_json_reply
from app.agents.models import DisruptionPrediction

logger = logging.getLogger(__name__)

MINIMUM_LEAD_TIME = timedelta(hours=48)
AGENT_NAME = "prediction-agent-v1"


class PredictionAgent:
    """Enforces the ≥48h lead-time floor (FR-003, SC-001) deterministically
    in code — that's a hard product guarantee, not left to the model's
    judgment. The LLM is used only for the confidence estimate and the
    plain-language rationale, both of which are advisory, not the timing
    guarantee itself."""

    def __init__(self, client: ChatClient | None = None) -> None:
        self._client = client or OpenAiCompatibleClient()

    def predict(
        self, signal: Signal, *, now: datetime | None = None
    ) -> DisruptionPrediction | None:
        now = now or datetime.now(UTC)
        lead_time = signal.predicted_impact_at - now
        if lead_time < MINIMUM_LEAD_TIME:
            logger.info(
                "Rejecting prediction for tenant %s: lead time %s is below the 48h floor",
                signal.tenant_id,
                lead_time,
            )
            return None

        confidence, rationale = self._reason(signal)
        return DisruptionPrediction(
            tenant_id=signal.tenant_id,
            type=signal.type,
            affected_supplier_id=signal.supplier_id,
            affected_inventory_item_ids=signal.affected_inventory_item_ids,
            confidence_score=confidence,
            predicted_impact_at=signal.predicted_impact_at,
            created_by_agent=AGENT_NAME,
            rationale=rationale,
        )

    def _reason(self, signal: Signal) -> tuple[float, str]:
        raw = self._client.complete(self._build_prompt(signal), max_tokens=400)
        data = parse_json_reply(raw)
        confidence = max(0.0, min(1.0, float(data["confidence"])))
        rationale = str(data["rationale"])
        return confidence, rationale

    @staticmethod
    def _build_prompt(signal: Signal) -> str:
        context_lines = "\n".join(f"- {key}: {value}" for key, value in signal.context.items())
        return (
            "You are a supply chain disruption prediction assistant for a "
            "small business owner. Given the signal below, respond with "
            'ONLY a JSON object of the form {"confidence": <0-1 float>, '
            '"rationale": <one or two plain-language sentences a '
            "non-technical business owner would understand, no jargon>}.\n\n"
            f"Disruption type: {signal.type}\n"
            f"Detected at: {signal.detected_at.isoformat()}\n"
            f"Predicted impact at: {signal.predicted_impact_at.isoformat()}\n"
            f"Context:\n{context_lines}"
        )
