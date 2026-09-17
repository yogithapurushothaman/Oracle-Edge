"""
ORACLE Edge - Layer 1 & 2: Edge Ingestion & Data Fusion
Manages hardware pin mappings, telemetry validation, and external weather/satellite data fusion.

Preserves physical ESP32 pin mappings:
- Node 1 (H01 - Metro Hospital): Sensor Pin 36 (VP), LEDs (Red 18, Yellow 19, Green 21), Buzzer 25.
- Node 2 (B17 - River Bridge): Sensor Pin 32, LEDs (Red 22, Yellow 23, Green 13), Buzzer 26.
"""

from typing import Dict, Any, List
from datetime import datetime


class EdgeIngestionManager:
    """
    Ingests and normalizes dual-node IoT sensor telemetry and external GIS data.
    """

    # Physical Tabletop ESP32 Pin Specification
    PIN_MAPPING: Dict[str, Dict[str, Any]] = {
        "H01": {
            "name": "Metro Hospital",
            "sensor_pin": 36,  # ADC1_CH0 (VP)
            "led_red_pin": 18,
            "led_yellow_pin": 19,
            "led_green_pin": 21,
            "buzzer_pin": 25,
            "threshold_dry_cm": 0.2,
            "threshold_yellow_cm": 3.0,
            "threshold_critical_cm": 4.0,
        },
        "B17": {
            "name": "River Bridge",
            "sensor_pin": 32,  # ADC1_CH4
            "led_red_pin": 22,
            "led_yellow_pin": 23,
            "led_green_pin": 13,
            "buzzer_pin": 26,
            "threshold_dry_cm": 0.2,
            "threshold_yellow_cm": 3.0,
            "threshold_critical_cm": 4.0,
        },
    }

    def __init__(self):
        self._cached_weather: Dict[str, Any] = {
            "temperature_c": 24.0,
            "condition": "Heavy Rain",
            "rainfall_rate_mm_hr": 12.0,
            "wind_speed_kmh": 15.0,
            "humidity_pct": 92.0,
            "forecast_summary": "Intense convective precipitation cell over Adyar drainage basin",
            "updated_at": datetime.utcnow().isoformat(),
        }

    def get_pin_mapping(self, asset_id: str) -> Dict[str, Any]:
        """Returns pin assignment and hardware thresholds for an asset node."""
        return self.PIN_MAPPING.get(asset_id, self.PIN_MAPPING["H01"])

    def fetch_weather(self, lat: float = 13.040, lng: float = 80.250) -> Dict[str, Any]:
        """
        External Open-Meteo live/mock weather provider.
        Delivers rainfall (12 mm/hr), wind (15 km/h), humidity (92%), and ambient temp (24°C).
        """
        return {
            **self._cached_weather,
            "latitude": lat,
            "longitude": lng,
            "updated_at": datetime.utcnow().isoformat(),
        }

    def set_weather_override(self, rainfall_mm_hr: float, condition: str = "Heavy Rain"):
        """Overrides weather condition for scenario simulation."""
        self._cached_weather["rainfall_rate_mm_hr"] = rainfall_mm_hr
        self._cached_weather["condition"] = condition

    def get_satellite_inundation_polygons(self) -> List[Dict[str, Any]]:
        """
        Satellite Inundation Mock Provider:
        Provides synthetic low-elevation flood runoff polygons for the Adyar River corridor.
        """
        return [
            {
                "id": "POLY-ADYAR-BASIN-01",
                "name": "Adyar Depression Zone A",
                "elevation_m": 4.2,
                "inundation_risk": "HIGH",
                "coordinates": [
                    [13.004, 80.195],
                    [13.008, 80.225],
                    [13.014, 80.250],
                    [13.009, 80.265],
                    [13.003, 80.220],
                ],
                "water_coverage_pct": 74.5,
            },
            {
                "id": "POLY-HOSPITAL-LOWLAND-02",
                "name": "Metro Hospital Depression Cell",
                "elevation_m": 3.8,
                "inundation_risk": "CRITICAL",
                "coordinates": [
                    [13.080, 80.266],
                    [13.085, 80.268],
                    [13.086, 80.274],
                    [13.081, 80.273],
                ],
                "water_coverage_pct": 86.0,
            },
        ]


# Singleton instance
edge_ingestion_manager = EdgeIngestionManager()
