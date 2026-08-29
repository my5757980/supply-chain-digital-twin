"""Covers the periodic sweep.

Before this existed the agents ran only when a human invoked a script, so a
deployed system raised no alerts at all. These tests pin the two properties
that make the sweep safe to leave running unattended: it still refuses a
signal it cannot warn about early enough, and one broken business does not
stop the rest from being looked at.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app import sweep
from app.sweep import fetch_candidates, run_for_candidate, run_sweep


def _candidate(tenant: str = "tenant-1", **overrides: Any) -> dict[str, Any]:
    base = {
        "tenant_id": tenant,
        "supplier_id": "supplier-1",
        "supplier_name": "Supplier Co",
        "affected_inventory_item_ids": ["item-1"],
        "lead_time_hours": 72,
    }
    base.update(overrides)
    return base


def test_refuses_a_signal_it_cannot_warn_about_48h_ahead() -> None:
    # The floor lives in the Prediction Agent, and the sweep must not talk
    # its way around it: no callback should be attempted at all.
    outcome = run_for_candidate(
        tenant_id="tenant-1",
        supplier_id="supplier-1",
        supplier_name="Supplier Co",
        affected_inventory_item_ids=["item-1"],
        lead_time_hours=12,
    )
    assert outcome.alert_id is None
    assert "48h floor" in outcome.reason


def test_fetches_the_work_list_with_the_service_token() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["token"] = request.headers.get("x-service-token")
        return httpx.Response(200, json={"candidates": [_candidate()]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    candidates = fetch_candidates(client)

    assert seen["url"].endswith("/internal/sweep-candidates")
    assert seen["token"] is not None
    assert candidates == [_candidate()]


def test_one_failing_business_does_not_stop_the_others(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"candidates": [_candidate("boom"), _candidate("fine")]},
        )

    processed: list[str] = []

    def fake_run(*, tenant_id: str, **_: Any) -> sweep.PipelineOutcome:
        if tenant_id == "boom":
            raise RuntimeError("supplier data is unusable")
        processed.append(tenant_id)
        return sweep.PipelineOutcome(tenant_id, "alert-1", "alert raised")

    monkeypatch.setattr(sweep, "run_for_candidate", fake_run)

    outcomes = run_sweep(httpx.Client(transport=httpx.MockTransport(handler)))

    assert processed == ["fine"]
    assert [o.tenant_id for o in outcomes] == ["fine"]


def test_an_empty_work_list_is_not_an_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"candidates": []})

    assert run_sweep(httpx.Client(transport=httpx.MockTransport(handler))) == []
