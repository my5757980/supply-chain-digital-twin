"""Demo/dev script: runs a real disruption signal through the full
predict -> recommend -> plan pipeline and posts the results to apps/api
(quickstart.md §4).

Requires ANTHROPIC_API_KEY to be set (the agents call the real Claude API).

Usage:
    python scripts/seed_disruption.py --tenant-id <uuid> --supplier-id <uuid> \
        --supplier-name "Acme Supplies" --item-id <uuid> [--item-id <uuid> ...]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.adapters.signals import supplier_delay_signal  # noqa: E402
from app.agents.contingency_plan_agent import ContingencyPlanAgent  # noqa: E402
from app.agents.prediction_agent import PredictionAgent  # noqa: E402
from app.agents.sourcing_recommendation_agent import (  # noqa: E402
    SourcingRecommendationAgent,
    SupplierCandidate,
)
from app.callbacks.predictions import PredictionCallbackClient  # noqa: E402
from app.callbacks.recommendations import RecommendationCallbackClient  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--supplier-id", required=True)
    parser.add_argument("--supplier-name", required=True)
    parser.add_argument("--item-id", action="append", required=True, dest="item_ids")
    parser.add_argument("--lead-time-hours", type=float, default=72)
    args = parser.parse_args()

    signal = supplier_delay_signal(
        tenant_id=args.tenant_id,
        supplier_id=args.supplier_id,
        supplier_name=args.supplier_name,
        affected_inventory_item_ids=args.item_ids,
        lead_time_hours=args.lead_time_hours,
    )

    prediction = PredictionAgent().predict(signal)
    if prediction is None:
        print("Signal rejected: lead time below the 48h floor.")
        return

    prediction_result = PredictionCallbackClient().send(prediction)
    print(f"Prediction persisted: {prediction_result}")

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
    if recommendation:
        print(f"Recommended: {recommendation.name} ({recommendation.source})")
    else:
        print("No alternative supplier found — contingency plan will include fallback guidance.")

    steps = ContingencyPlanAgent().generate_plan(signal, recommendation)
    print(f"Contingency plan: {steps}")

    recommendation_result = RecommendationCallbackClient().send(
        tenant_id=args.tenant_id,
        alert_id=str(prediction_result["alert_id"]),
        steps=steps,
        recommendation=recommendation,
    )
    print(f"Recommendation persisted: {recommendation_result}")


if __name__ == "__main__":
    main()
