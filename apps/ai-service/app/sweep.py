"""Runs the predict -> recommend -> plan pipeline for the businesses that
apps/api reports as worth looking at.

Direction matters here. The prediction layer pulls its work list and pushes
its outputs; apps/api never calls into this service (Constitution Principle
IX). The same pipeline backs both the periodic sweep and
`scripts/seed_disruption.py`, so a demo and a deployment exercise identical
code rather than two implementations that drift.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.adapters.signals import supplier_delay_signal
from app.agents.contingency_plan_agent import ContingencyPlanAgent
from app.agents.prediction_agent import PredictionAgent
from app.agents.sourcing_recommendation_agent import (
    SourcingRecommendationAgent,
    SupplierCandidate,
)
from app.callbacks.predictions import PredictionCallbackClient
from app.callbacks.recommendations import RecommendationCallbackClient
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PipelineOutcome:
    """What happened to one candidate. `alert_id` is None when nothing was
    raised — most often because the lead time was under the 48-hour floor,
    which is a correct refusal rather than a failure."""

    tenant_id: str
    alert_id: str | None
    reason: str


def run_for_candidate(
    *,
    tenant_id: str,
    supplier_id: str,
    supplier_name: str,
    affected_inventory_item_ids: list[str],
    lead_time_hours: float = 72,
) -> PipelineOutcome:
    signal = supplier_delay_signal(
        tenant_id=tenant_id,
        supplier_id=supplier_id,
        supplier_name=supplier_name,
        affected_inventory_item_ids=affected_inventory_item_ids,
        lead_time_hours=lead_time_hours,
    )

    prediction = PredictionAgent().predict(signal)
    if prediction is None:
        return PipelineOutcome(tenant_id, None, "lead time below the 48h floor")

    prediction_result = PredictionCallbackClient().send(prediction)
    alert_id = str(prediction_result["alert_id"])

    # apps/api returns the sourcing options alongside the persisted
    # prediction, so the agent chooses without this service ever reading the
    # platform's database.
    candidates = prediction_result.get("sourcing_candidates", {})
    own_backups = [
        SupplierCandidate(
            id=c["id"], name=c["name"], source="own_backup", location=c.get("location")
        )
        for c in candidates.get("own_backup_suppliers", [])
    ]
    directory_entries = [
        SupplierCandidate(
            id=c["id"], name=c["name"], source="directory", location=c.get("location")
        )
        for c in candidates.get("directory_entries", [])
    ]
    recommendation = SourcingRecommendationAgent().recommend(own_backups, directory_entries)

    steps = ContingencyPlanAgent().generate_plan(signal, recommendation)
    RecommendationCallbackClient().send(
        tenant_id=tenant_id,
        alert_id=alert_id,
        steps=steps,
        recommendation=recommendation,
    )

    where = recommendation.name if recommendation else "no alternative found"
    return PipelineOutcome(tenant_id, alert_id, f"alert raised, sourcing: {where}")


def fetch_candidates(client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Asks apps/api which businesses to look at. Read-only."""
    http = client or httpx.Client(timeout=15.0)
    response = http.get(
        f"{settings.api_callback_url}/internal/sweep-candidates",
        headers={"x-service-token": settings.service_token},
    )
    response.raise_for_status()
    candidates: list[dict[str, Any]] = response.json().get("candidates", [])
    return candidates


def run_sweep(client: httpx.Client | None = None) -> list[PipelineOutcome]:
    """One full pass. A candidate that fails is logged and skipped — one
    business's bad data must not stop every other business getting warned."""
    outcomes: list[PipelineOutcome] = []
    for candidate in fetch_candidates(client):
        try:
            outcome = run_for_candidate(
                tenant_id=candidate["tenant_id"],
                supplier_id=candidate["supplier_id"],
                supplier_name=candidate["supplier_name"],
                affected_inventory_item_ids=candidate["affected_inventory_item_ids"],
                lead_time_hours=candidate.get("lead_time_hours", 72),
            )
            logger.info("sweep: %s -> %s", outcome.tenant_id, outcome.reason)
            outcomes.append(outcome)
        except Exception:  # noqa: BLE001 - one tenant must not sink the sweep
            logger.exception("sweep failed for tenant %s", candidate.get("tenant_id"))
    return outcomes
