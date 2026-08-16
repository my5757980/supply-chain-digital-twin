from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DisruptionPrediction(BaseModel):
    """Mirrors data-model.md's `DisruptionPrediction` entity."""

    tenant_id: str
    type: Literal["supplier_delay", "port_congestion", "demand_spike"]
    affected_supplier_id: str | None
    affected_inventory_item_ids: list[str]
    confidence_score: float = Field(ge=0, le=1)
    predicted_impact_at: datetime
    created_by_agent: str
    rationale: str
