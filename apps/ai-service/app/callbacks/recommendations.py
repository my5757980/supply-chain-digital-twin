"""Persists a Recommendation via apps/api's internal callback (T066).

Same one-directional pattern as callbacks/predictions.py — apps/ai-service
pushes its output, apps/api never reaches back into ai-service internals
(Constitution Principle IX).
"""

from __future__ import annotations

import httpx

from app.agents.sourcing_recommendation_agent import SupplierCandidate
from app.config import settings


class RecommendationCallbackError(RuntimeError):
    """Raised when apps/api rejects or fails to accept a recommendation."""


class RecommendationCallbackClient:
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

    def send(
        self,
        *,
        tenant_id: str,
        alert_id: str,
        steps: list[str],
        recommendation: SupplierCandidate | None,
    ) -> dict[str, object]:
        payload: dict[str, object] = {
            "tenant_id": tenant_id,
            "alert_id": alert_id,
            "steps": steps,
        }
        if recommendation is not None:
            if recommendation.source == "own_backup":
                payload["recommended_supplier_id"] = recommendation.id
            else:
                payload["recommended_directory_entry_id"] = recommendation.id

        try:
            response = self._client.post(
                f"{self._base_url}/internal/recommendations",
                json=payload,
                headers={"x-service-token": self._service_token},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise RecommendationCallbackError(str(exc)) from exc
        result: dict[str, object] = response.json()
        return result
