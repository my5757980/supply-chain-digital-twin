from __future__ import annotations

from datetime import UTC, datetime

from app.adapters.signals import supplier_delay_signal
from app.agents.prediction_agent import MINIMUM_LEAD_TIME, PredictionAgent
from tests.stub_llm import StubChatClient, fenced_json_reply, json_reply


def _signal(lead_time_hours: float, now: datetime):  # noqa: ANN202
    return supplier_delay_signal(
        tenant_id="tenant-1",
        supplier_id="supplier-1",
        supplier_name="Supplier Co",
        affected_inventory_item_ids=["item-1"],
        lead_time_hours=lead_time_hours,
        now=now,
    )


def test_enforces_minimum_48h_lead_time() -> None:
    now = datetime.now(UTC)
    client = StubChatClient(json_reply({"confidence": 0.9, "rationale": "Should not be used."}))
    agent = PredictionAgent(client=client)

    result = agent.predict(_signal(24, now), now=now)

    assert result is None
    # The floor is enforced before any LLM call — a rejected signal must
    # never cost a request.
    assert client.prompts == []


def test_accepts_a_signal_at_or_above_the_48h_floor() -> None:
    now = datetime.now(UTC)
    client = StubChatClient(
        json_reply({"confidence": 0.82, "rationale": "Plain language explanation."})
    )
    agent = PredictionAgent(client=client)

    prediction = agent.predict(_signal(72, now), now=now)

    assert prediction is not None
    assert prediction.predicted_impact_at - now >= MINIMUM_LEAD_TIME
    assert prediction.confidence_score == 0.82
    assert prediction.rationale == "Plain language explanation."
    assert prediction.created_by_agent == "prediction-agent-v1"
    assert prediction.affected_inventory_item_ids == ["item-1"]


def test_clamps_an_out_of_range_confidence_score() -> None:
    now = datetime.now(UTC)
    client = StubChatClient(json_reply({"confidence": 1.4, "rationale": "Overconfident."}))
    agent = PredictionAgent(client=client)

    prediction = agent.predict(_signal(72, now), now=now)

    assert prediction is not None
    assert prediction.confidence_score == 1.0


def test_handles_a_markdown_fenced_json_reply() -> None:
    now = datetime.now(UTC)
    client = StubChatClient(fenced_json_reply({"confidence": 0.6, "rationale": "Fenced reply."}))
    agent = PredictionAgent(client=client)

    prediction = agent.predict(_signal(72, now), now=now)

    assert prediction is not None
    assert prediction.rationale == "Fenced reply."


def test_handles_a_reply_with_prose_around_the_json() -> None:
    """Smaller/open models often add a sentence before the JSON — that
    shouldn't lose the whole prediction."""
    now = datetime.now(UTC)
    client = StubChatClient(
        "Sure! Here is the analysis:\n"
        '{"confidence": 0.7, "rationale": "Wrapped reply."}\n'
        "Hope that helps."
    )
    agent = PredictionAgent(client=client)

    prediction = agent.predict(_signal(72, now), now=now)

    assert prediction is not None
    assert prediction.rationale == "Wrapped reply."


def test_signal_exactly_at_48h_boundary_is_accepted() -> None:
    now = datetime.now(UTC)
    client = StubChatClient(json_reply({"confidence": 0.5, "rationale": "Boundary case."}))
    agent = PredictionAgent(client=client)

    assert agent.predict(_signal(48, now), now=now) is not None


def test_signal_just_under_48h_boundary_is_rejected() -> None:
    now = datetime.now(UTC)
    client = StubChatClient(json_reply({"confidence": 0.5, "rationale": "Should not appear."}))
    agent = PredictionAgent(client=client)

    assert agent.predict(_signal(47.99, now), now=now) is None
