from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.adapters.signals import Signal, supplier_delay_signal
from app.agents.contingency_plan_agent import ContingencyPlanAgent
from app.agents.sourcing_recommendation_agent import SupplierCandidate
from tests.stub_llm import StubChatClient, fenced_json_reply, json_reply


def _sample_signal() -> Signal:
    return supplier_delay_signal(
        tenant_id="tenant-1",
        supplier_id="supplier-1",
        supplier_name="Supplier Co",
        affected_inventory_item_ids=["item-1"],
        lead_time_hours=72,
        now=datetime.now(UTC),
    )


def test_produces_plain_language_steps_with_a_recommended_alternative() -> None:
    client = StubChatClient(json_reply({"steps": ["Step one.", "Step two.", "Step three."]}))
    agent = ContingencyPlanAgent(client=client)
    recommendation = SupplierCandidate(id="backup-1", name="Backup Co", source="own_backup")

    steps = agent.generate_plan(_sample_signal(), recommendation)

    assert steps == ["Step one.", "Step two.", "Step three."]
    assert "Backup Co" in client.prompts[0]


def test_still_produces_a_plan_when_no_alternative_exists() -> None:
    """Covers spec.md US3 Acceptance Scenario 3: no viable alternative
    sourcing option — the plan must still be generated with fallback
    guidance, not silently omitted."""
    client = StubChatClient(
        json_reply(
            {
                "steps": [
                    "Contact your supplier to confirm the delay.",
                    "Check your current stock levels.",
                    "Look for a local supplier yourself in the meantime.",
                ]
            }
        )
    )
    agent = ContingencyPlanAgent(client=client)

    steps = agent.generate_plan(_sample_signal(), None)

    assert len(steps) >= 1
    # The prompt must make the no-alternative situation explicit rather
    # than quietly omitting it.
    assert "No alternative supplier could be identified" in client.prompts[0]


def test_raises_if_the_model_returns_zero_steps() -> None:
    client = StubChatClient(json_reply({"steps": []}))
    agent = ContingencyPlanAgent(client=client)

    with pytest.raises(ValueError):
        agent.generate_plan(_sample_signal(), None)


def test_handles_a_markdown_fenced_json_reply() -> None:
    client = StubChatClient(fenced_json_reply({"steps": ["Only step."]}))
    agent = ContingencyPlanAgent(client=client)

    assert agent.generate_plan(_sample_signal(), None) == ["Only step."]
