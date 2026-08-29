"""Demo/dev script: runs one disruption signal through the full
predict -> recommend -> plan pipeline and posts the results to apps/api
(quickstart.md §4).

The pipeline itself lives in `app.sweep`, shared with the periodic sweep,
so seeding a demo and running in production exercise the same code.

Requires the LLM_* variables to be set (the agents call a real model).

Usage:
    python scripts/seed_disruption.py --tenant-id <uuid> --supplier-id <uuid> \
        --supplier-name "Acme Supplies" --item-id <uuid> [--item-id <uuid> ...]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.sweep import run_for_candidate  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--supplier-id", required=True)
    parser.add_argument("--supplier-name", required=True)
    parser.add_argument("--item-id", action="append", required=True, dest="item_ids")
    parser.add_argument("--lead-time-hours", type=float, default=72)
    args = parser.parse_args()

    outcome = run_for_candidate(
        tenant_id=args.tenant_id,
        supplier_id=args.supplier_id,
        supplier_name=args.supplier_name,
        affected_inventory_item_ids=args.item_ids,
        lead_time_hours=args.lead_time_hours,
    )
    if outcome.alert_id is None:
        print(f"No alert raised: {outcome.reason}")
        return
    print(f"Alert {outcome.alert_id} raised — {outcome.reason}")


if __name__ == "__main__":
    main()
