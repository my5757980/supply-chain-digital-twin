from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.agents.models import DisruptionPrediction
from app.callbacks.predictions import PredictionCallbackClient, PredictionCallbackError


def _sample_prediction() -> DisruptionPrediction:
    now = datetime.now(UTC)
    return DisruptionPrediction(
        tenant_id="tenant-1",
        type="supplier_delay",
        affected_supplier_id="supplier-1",
        affected_inventory_item_ids=["item-1"],
        confidence_score=0.8,
        predicted_impact_at=now + timedelta(hours=72),
        created_by_agent="prediction-agent-v1",
        rationale="A supplier has recently missed delivery windows.",
    )


def test_sends_the_expected_payload_and_service_token_header() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = httpx.Request("POST", request.url, content=request.content).content
        return httpx.Response(201, json={"prediction_id": "pred-1", "alert_id": "alert-1"})

    transport = httpx.MockTransport(handler)
    client = PredictionCallbackClient(
        base_url="http://api.internal",
        service_token="test-token",
        client=httpx.Client(transport=transport),
    )

    result = client.send(_sample_prediction())

    assert result == {"prediction_id": "pred-1", "alert_id": "alert-1"}
    assert captured["url"] == "http://api.internal/internal/predictions"
    assert captured["headers"]["x-service-token"] == "test-token"  # type: ignore[index]


def test_raises_a_callback_error_on_a_failed_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"error": {"message": "Invalid service token"}})

    transport = httpx.MockTransport(handler)
    client = PredictionCallbackClient(
        base_url="http://api.internal",
        service_token="wrong-token",
        client=httpx.Client(transport=transport),
    )

    with pytest.raises(PredictionCallbackError):
        client.send(_sample_prediction())
