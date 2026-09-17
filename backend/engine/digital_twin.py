"""
ORACLE Edge - Layer 3: Municipal Digital Twin Registry
Maintains comprehensive digital twin records, asset criticality models, and spatial metadata.
"""

from typing import Dict, Any, Optional


class MunicipalDigitalTwinRegistry:
    """
    Manages high-fidelity digital twin profiles for municipal infrastructure.
    """

    DIGITAL_TWINS: Dict[str, Dict[str, Any]] = {
        "H01": {
            "asset_id": "H01",
            "name": "Metro Hospital",
            "type": "Healthcare",
            "criticality": 10,
            "population_served": 15000,
            "icu_beds": 120,
            "evacuation_tolerance": "Zero",
            "elevation_risk": "Depression Basin",
            "latitude": 13.0827,
            "longitude": 80.2707,
            "power_grid": "Dual Redundant Basement Grid (Flood Vulnerable)",
            "primary_hazards": ["Basement Substation Flooding", "ICU Oxygen Supply Cutoff"],
            "recommended_defense": "High-capacity mobile dewatering pumps & perimeter flood barriers",
        },
        "B17": {
            "asset_id": "B17",
            "name": "River Bridge",
            "type": "Transport",
            "criticality": 6,
            "population_served": 8000,
            "daily_traffic": 8000,
            "alternate_route": "No",
            "elevation_risk": "Channel Flow",
            "latitude": 13.0067,
            "longitude": 80.2570,
            "structure_type": "Pre-stressed Concrete 4-Span Pier",
            "primary_hazards": ["Pier Scour Hydrodynamic Turbulence", "Deck Inundation"],
            "recommended_defense": "Acoustic pier scour monitoring & vehicular diversion patrol",
        },
        "D03": {
            "asset_id": "D03",
            "name": "Drain D03 (Adyar Sluice)",
            "type": "Drainage",
            "criticality": 7,
            "population_served": 12000,
            "elevation_risk": "Canal Confluence",
            "latitude": 13.0120,
            "longitude": 80.2480,
            "primary_hazards": ["Silt Blockage", "Tidal Backflow"],
        },
        "R08": {
            "asset_id": "R08",
            "name": "Road R08 (Inner Ring Expressway)",
            "type": "Expressway",
            "criticality": 5,
            "population_served": 28000,
            "elevation_risk": "Underpass Inundation",
            "latitude": 13.0450,
            "longitude": 80.2210,
            "primary_hazards": ["Subway Flooding", "Traffic Gridlock"],
        },
    }

    def get_digital_twin(self, asset_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves digital twin profile by asset ID."""
        return self.DIGITAL_TWINS.get(asset_id)

    def get_all_digital_twins(self) -> Dict[str, Dict[str, Any]]:
        """Returns all municipal digital twin records."""
        return self.DIGITAL_TWINS


# Singleton instance
digital_twin_registry = MunicipalDigitalTwinRegistry()
