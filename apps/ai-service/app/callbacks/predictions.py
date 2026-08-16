"""Persists a DisruptionPrediction via apps/api's internal callback (T046).

This is the one place apps/ai-service ever talks to apps/api — matching
Constitution Principle IX (the action layer only consumes prediction-layer
*outputs*, and this is the prediction layer pushing its own output out,
never the reverse: apps/api never reaches into apps/ai-service internals).
"""

from __future__ import annotations

import httpx

from app.agents.models import DisruptionPrediction
from app.config import settings


class PredictionCallbackError(RuntimeError):
    """Raised when apps/api rejects or fails to accept a prediction."""


class PredictionCallbackClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        service_token: str | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url or settings.api_callback_url
        self._service_token = service_token or settings.service_token
        self._client = client or httpx.Client(timeout=10.0)

    def send(self, prediction: DisruptionPrediction) -> dict[str, str]:
        payload = {
            "tenant_id": prediction.tenant_id,
            "type": prediction.type,
            "affected_supplier_id": prediction.affected_supplier_id,
            "affected_inventory_item_ids": prediction.affected_inventory_item_ids,
            "confidence_score": prediction.confidence_score,
            "predicted_impact_at": prediction.predicted_impact_at.isoformat(),
            "created_by_agent": prediction.created_by_agent,
            "rationale": prediction.rationale,
        }
        try:
            response = self._client.post(
                f"{self._base_url}/internal/predictions",
                json=payload,
                headers={"x-service-token": self._service_token},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise PredictionCallbackError(str(exc)) from exc
        result: dict[str, str] = response.json()
        return result
