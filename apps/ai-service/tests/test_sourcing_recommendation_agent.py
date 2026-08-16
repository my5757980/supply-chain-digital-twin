from __future__ import annotations

from app.agents.sourcing_recommendation_agent import SourcingRecommendationAgent, SupplierCandidate


def test_prefers_own_backup_supplier_when_available() -> None:
    agent = SourcingRecommendationAgent()
    own_backup = SupplierCandidate(id="backup-1", name="My Backup Co", source="own_backup")
    directory = SupplierCandidate(id="dir-1", name="Directory Co", source="directory")

    result = agent.recommend(
        own_backup_suppliers=[own_backup],
        directory_entries=[directory],
    )

    assert result == own_backup


def test_falls_back_to_directory_when_no_backup_registered() -> None:
    agent = SourcingRecommendationAgent()
    directory = SupplierCandidate(id="dir-1", name="Directory Co", source="directory")

    result = agent.recommend(own_backup_suppliers=[], directory_entries=[directory])

    assert result == directory


def test_returns_none_when_no_alternative_exists() -> None:
    agent = SourcingRecommendationAgent()

    result = agent.recommend(own_backup_suppliers=[], directory_entries=[])

    assert result is None


def test_never_returns_a_directory_entry_when_a_backup_exists() -> None:
    agent = SourcingRecommendationAgent()
    own_backup = SupplierCandidate(id="backup-1", name="My Backup Co", source="own_backup")
    directory_a = SupplierCandidate(id="dir-1", name="Directory A", source="directory")
    directory_b = SupplierCandidate(id="dir-2", name="Directory B", source="directory")

    result = agent.recommend(
        own_backup_suppliers=[own_backup],
        directory_entries=[directory_a, directory_b],
    )

    assert result is not None
    assert result.source == "own_backup"
