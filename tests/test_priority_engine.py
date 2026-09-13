"""
ORACLE Edge - Priority Engine & Multi-Hazard Scoring Pytest Suite
Validates Scenarios A, B, and C per PRD Decision Engine requirements:

1. Scenario A: Bridge Flooded (18 cm), Hospital Dry (4 cm) -> Bridge MUST be Priority #1
2. Scenario B: Both Rising Moderately: Bridge at 14 cm, Hospital at 12 cm with rapid rise rate -> Hospital flips to Priority #1
3. Scenario C: Equal Flood Depth: Bridge at 20 cm, Hospital at 20 cm -> Hospital MUST remain Priority #1 due to 0.95 criticality
"""

import sys
import os
import pytest

# Ensure repository root and backend are in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from backend.services.decision_engine import decision_engine


def test_bridge_priority_when_hospital_safe():
    """
    Scenario A (Bridge Flooded, Hospital Dry):
    Bridge B17 at 18 cm, Hospital H01 at 4 cm -> Bridge MUST be Priority #1.
    """
    bridge_score = decision_engine.compute_priority_score(
        asset_id="B17",
        asset_type="Bridge",
        criticality=0.75,
        population_served=15000,
        water_level_cm=18.0,
        rise_rate_cm_min=0.2
    )

    hospital_score = decision_engine.compute_priority_score(
        asset_id="H01",
        asset_type="Hospital",
        criticality=0.95,
        population_served=45000,
        water_level_cm=4.0,
        rise_rate_cm_min=0.1
    )

    print(f"\n[Scenario A] Bridge B17 Score: {bridge_score} | Hospital H01 Score: {hospital_score}")
    assert bridge_score > hospital_score, (
        f"Bridge B17 ({bridge_score}) must be Priority #1 over Dry Hospital H01 ({hospital_score})"
    )

    # Validate ranking list order
    ranked = decision_engine.rank_assets([
        {"asset_id": "H01", "asset_type": "Hospital", "criticality": 0.95, "population_served": 45000, "water_level_cm": 4.0, "rise_rate_cm_min": 0.1},
        {"asset_id": "B17", "asset_type": "Bridge", "criticality": 0.75, "population_served": 15000, "water_level_cm": 18.0, "rise_rate_cm_min": 0.2}
    ])
    assert ranked[0]["asset_id"] == "B17", f"Expected Priority #1 to be B17, got {ranked[0]['asset_id']}"
    assert ranked[1]["asset_id"] == "H01"


def test_hospital_flips_priority_on_rapid_rise():
    """
    Scenario B (Both Rising Moderately):
    Bridge B17 at 14 cm, Hospital H01 at 12 cm with high rise rate ->
    Hospital flips to Priority #1 due to critical healthcare consequence.
    """
    bridge_score = decision_engine.compute_priority_score(
        asset_id="B17",
        asset_type="Bridge",
        criticality=0.75,
        population_served=15000,
        water_level_cm=14.0,
        rise_rate_cm_min=0.4
    )

    hospital_score = decision_engine.compute_priority_score(
        asset_id="H01",
        asset_type="Hospital",
        criticality=0.95,
        population_served=45000,
        water_level_cm=12.0,
        rise_rate_cm_min=1.8
    )

    print(f"\n[Scenario B] Hospital H01 Score: {hospital_score} | Bridge B17 Score: {bridge_score}")
    assert hospital_score > bridge_score, (
        f"Hospital H01 ({hospital_score}) must flip to Priority #1 over Bridge B17 ({bridge_score}) due to rapid rise rate"
    )

    # Validate ranking list order
    ranked = decision_engine.rank_assets([
        {"asset_id": "B17", "asset_type": "Bridge", "criticality": 0.75, "population_served": 15000, "water_level_cm": 14.0, "rise_rate_cm_min": 0.4},
        {"asset_id": "H01", "asset_type": "Hospital", "criticality": 0.95, "population_served": 45000, "water_level_cm": 12.0, "rise_rate_cm_min": 1.8}
    ])
    assert ranked[0]["asset_id"] == "H01", f"Expected Priority #1 to be H01, got {ranked[0]['asset_id']}"
    assert ranked[1]["asset_id"] == "B17"


def test_hospital_wins_tiebreaker_on_equal_depth():
    """
    Scenario C (Equal Flood Depth):
    Bridge B17 at 20 cm, Hospital H01 at 20 cm ->
    Hospital MUST remain Priority #1 due to 0.95 criticality.
    """
    bridge_score = decision_engine.compute_priority_score(
        asset_id="B17",
        asset_type="Bridge",
        criticality=0.75,
        population_served=15000,
        water_level_cm=20.0,
        rise_rate_cm_min=0.5
    )

    hospital_score = decision_engine.compute_priority_score(
        asset_id="H01",
        asset_type="Hospital",
        criticality=0.95,
        population_served=45000,
        water_level_cm=20.0,
        rise_rate_cm_min=0.5
    )

    print(f"\n[Scenario C] Hospital H01 Score: {hospital_score} | Bridge B17 Score: {bridge_score}")
    assert hospital_score > bridge_score, (
        f"Hospital H01 ({hospital_score}) must win tiebreaker over Bridge B17 ({bridge_score}) at equal depth"
    )

    # Validate ranking list order
    ranked = decision_engine.rank_assets([
        {"asset_id": "B17", "asset_type": "Bridge", "criticality": 0.75, "population_served": 15000, "water_level_cm": 20.0, "rise_rate_cm_min": 0.5},
        {"asset_id": "H01", "asset_type": "Hospital", "criticality": 0.95, "population_served": 45000, "water_level_cm": 20.0, "rise_rate_cm_min": 0.5}
    ])
    assert ranked[0]["asset_id"] == "H01", f"Expected Priority #1 to be H01, got {ranked[0]['asset_id']}"
    assert ranked[1]["asset_id"] == "B17"


if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
