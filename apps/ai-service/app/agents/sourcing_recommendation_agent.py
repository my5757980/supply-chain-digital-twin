"""Sourcing Recommendation Agent (T064).

FR-006: prefer a supplier the SME has already registered as a backup
before falling back to the platform-curated Local Supplier Directory. This
is a deterministic business rule, not something to leave to an LLM's
judgment — same reasoning as the Prediction Agent's ≥48h floor. No Claude
call happens here; the "AI agent" is the explicit, auditable selection
policy itself (Constitution Principle IV requires agents to be inspectable
components, not necessarily LLM calls for every decision).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SourceKind = Literal["own_backup", "directory"]


@dataclass(frozen=True)
class SupplierCandidate:
    id: str
    name: str
    source: SourceKind
    location: str | None = None


class SourcingRecommendationAgent:
    def recommend(
        self,
        own_backup_suppliers: list[SupplierCandidate],
        directory_entries: list[SupplierCandidate],
    ) -> SupplierCandidate | None:
        """Returns the SME's own registered backup if any exist; otherwise
        the first verified Local Supplier Directory match; otherwise
        `None` (no viable alternative — spec.md US3 Acceptance Scenario 3
        still requires a contingency plan to be generated in this case,
        just without a concrete supplier)."""
        if own_backup_suppliers:
            return own_backup_suppliers[0]
        if directory_entries:
            return directory_entries[0]
        return None
