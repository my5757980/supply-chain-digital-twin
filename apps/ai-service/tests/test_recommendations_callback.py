from __future__ import annotations

import json

import httpx
import pytest

from app.agents.sourcing_recommendation_agent import SupplierCandidate
from app.callbacks.recommendations import RecommendationCallbackClient, RecommendationCallbackError


def test_sends_recommended_supplier_id_for_an_own_backup_choice() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        captured["headers"] = dict(request.headers)
        return httpx.Response(201, json={"id": "rec-1", "owner_decision": "pending"})

    client = RecommendationCallbackClient(
        base_url="http://api.internal",
        service_token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = client.send(
        tenant_id="tenant-1",
        alert_id="alert-1",
        steps=["Step one.", "Step two."],
        recommendation=SupplierCandidate(id="backup-1", name="Backup Co", source="own_backup"),
    )

    assert result == {"id": "rec-1", "owner_decision": "pending"}
    body = captured["body"]
    assert body["recommended_supplier_id"] == "backup-1"  # type: ignore[index]
    assert "recommended_directory_entry_id" not in body  # type: ignore[operator]
    assert captured["headers"]["x-service-token"] == "test-token"  # type: ignore[index]


def test_sends_recommended_directory_entry_id_for_a_directory_choice() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(201, json={"id": "rec-2"})

    client = RecommendationCallbackClient(
        base_url="http://api.internal",
        service_token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    client.send(
        tenant_id="tenant-1",
        alert_id="alert-1",
        steps=["Step one."],
        recommendation=SupplierCandidate(id="dir-1", name="Directory Co", source="directory"),
    )

    body = captured["body"]
    assert body["recommended_directory_entry_id"] == "dir-1"  # type: ignore[index]
    assert "recommended_supplier_id" not in body  # type: ignore[operator]


def test_sends_neither_id_when_no_alternative_was_found() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(201, json={"id": "rec-3"})

    client = RecommendationCallbackClient(
        base_url="http://api.internal",
        service_token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    client.send(tenant_id="tenant-1", alert_id="alert-1", steps=["Step one."], recommendation=None)

    body = captured["body"]
    assert "recommended_supplier_id" not in body  # type: ignore[operator]
    assert "recommended_directory_entry_id" not in body  # type: ignore[operator]


def test_raises_a_callback_error_on_a_failed_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, json={"error": {"message": "bad reference"}})

    client = RecommendationCallbackClient(
        base_url="http://api.internal",
        service_token="test-token",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(RecommendationCallbackError):
        client.send(
            tenant_id="tenant-1", alert_id="alert-1", steps=["Step one."], recommendation=None
        )
