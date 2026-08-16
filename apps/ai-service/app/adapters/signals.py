"""Mock supplier/logistics signal adapters (T044).

Real supplier and logistics feeds are out of scope for the MVP pilot
(spec.md "Out of Scope"; research.md §7) — these functions expose the same
shape a live integration would eventually produce, so swapping a mock for a
real adapter later doesn't require redesigning the Prediction Agent.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

SignalType = Literal["supplier_delay", "port_congestion", "demand_spike"]


@dataclass(frozen=True)
class Signal:
    tenant_id: str
    type: SignalType
    supplier_id: str | None
    affected_inventory_item_ids: list[str]
    detected_at: datetime
    predicted_impact_at: datetime
    context: dict[str, str]


def _utcnow() -> datetime:
    return datetime.now(UTC)


def supplier_delay_signal(
    tenant_id: str,
    supplier_id: str,
    supplier_name: str,
    affected_inventory_item_ids: list[str],
    *,
    lead_time_hours: float = 72,
    now: datetime | None = None,
) -> Signal:
    now = now or _utcnow()
    return Signal(
        tenant_id=tenant_id,
        type="supplier_delay",
        supplier_id=supplier_id,
        affected_inventory_item_ids=affected_inventory_item_ids,
        detected_at=now,
        predicted_impact_at=now + timedelta(hours=lead_time_hours),
        context={
            "supplier_name": supplier_name,
            "pattern": "repeated late deliveries over the last 30 days",
        },
    )


def port_congestion_signal(
    tenant_id: str,
    port_name: str,
    affected_inventory_item_ids: list[str],
    *,
    lead_time_hours: float = 96,
    now: datetime | None = None,
) -> Signal:
    now = now or _utcnow()
    return Signal(
        tenant_id=tenant_id,
        type="port_congestion",
        supplier_id=None,
        affected_inventory_item_ids=affected_inventory_item_ids,
        detected_at=now,
        predicted_impact_at=now + timedelta(hours=lead_time_hours),
        context={
            "port_name": port_name,
            "pattern": "vessel queue time trending upward",
        },
    )


def demand_spike_signal(
    tenant_id: str,
    affected_inventory_item_ids: list[str],
    *,
    lead_time_hours: float = 60,
    now: datetime | None = None,
) -> Signal:
    now = now or _utcnow()
    return Signal(
        tenant_id=tenant_id,
        type="demand_spike",
        supplier_id=None,
        affected_inventory_item_ids=affected_inventory_item_ids,
        detected_at=now,
        predicted_impact_at=now + timedelta(hours=lead_time_hours),
        context={"pattern": "order volume trending well above the recent baseline"},
    )
