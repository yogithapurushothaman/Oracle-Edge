"""
ORACLE Edge - Unit & Integration Tests for Circuit Breakers and Fallbacks
Tests:
1. WeatherService strict 2.0s timeout & fallback values (rainfall_1h: 4.2, rainfall_3h: 14.8, forecast_heavy_rain: False)
2. WeatherService in-memory caching of last successful rainfall metrics
3. SatelliteNDWIService strict 2.0s timeout & fallback (satellite_ndwi_delta: 0.12)
4. Dashboard state diagnostic payload api_status: {"open_meteo": ..., "sentinel_2": ...}
5. Telemetry ingestion resilience (never delayed or crashed by external API outages)
"""

import sys
import os
import time
import httpx
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.services.weather_service import WeatherService, weather_service
from backend.services.satellite_service import SatelliteNDWIService, satellite_service

GREEN = "\033[92m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def test_weather_service_fallback_on_timeout():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} [TEST 1] Weather Service Circuit Breaker on Timeout{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    ws = WeatherService(timeout=2.0)
    assert ws.timeout.connect == 2.0
    assert ws.timeout.read == 2.0

    # Simulate timeout by mocking httpx.Client.get to raise TimeoutException
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Connection timed out after 2.0s")):
        res = ws.fetch_weather_sync(13.0405, 80.2450)
        print("Fallback Weather Response:", res)
        
        assert res.get("fallback") is True
        assert res.get("api_status") == "FALLBACK"
        assert res.get("rainfall_1h") == 4.2, f"Expected 4.2, got {res.get('rainfall_1h')}"
        assert res.get("rainfall_3h") == 14.8, f"Expected 14.8, got {res.get('rainfall_3h')}"
        assert res.get("forecast_heavy_rain") is False
        assert ws.get_status() == "FALLBACK"

    print(f"{GREEN}[PASS] Weather service fallback on timeout validated.{RESET}")


def test_weather_service_caching_behavior():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} [TEST 2] Weather Service In-Memory Caching{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    ws = WeatherService(timeout=2.0)
    lat, lon = 13.0827, 80.2707

    # Seed initial successful data
    success_data = {
        "source": "Open-Meteo",
        "latitude": lat,
        "longitude": lon,
        "temperature_c": 34.0,
        "humidity_pct": 58.0,
        "wind_speed_kmh": 15.0,
        "current_precipitation": 8.0,
        "rainfall_1h": 8.5,
        "rainfall_3h": 22.4,
        "rainfall_24h": 45.0,
        "forecast_heavy_rain": True,
        "forecast_max_hourly": 12.0
    }
    ws.set_cache(lat, lon, success_data)

    # Now simulate an API outage / timeout
    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Network unreachable")):
        # Clear fresh TTL cache to force circuit breaker to serve persistent last-known cache
        ws._cache.clear()
        res = ws.fetch_weather_sync(lat, lon)
        print("Cached Resilient Weather Response:", res)
        
        assert res.get("cached") is True
        assert res.get("api_status") == "FALLBACK"
        assert res.get("rainfall_1h") == 8.5
        assert res.get("rainfall_3h") == 22.4
        assert res.get("forecast_heavy_rain") is True

    print(f"{GREEN}[PASS] Weather service cached fallback validated.{RESET}")


def test_satellite_service_fallback_on_timeout():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} [TEST 3] Satellite Service Circuit Breaker on Timeout{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    sat = SatelliteNDWIService(timeout_seconds=2.0)

    # Simulate query failure / missing raster
    res = sat.get_evaluator_observation("H01", ground_water_level_cm=20.0)
    print("Satellite Fallback Response:", res)

    assert res.get("api_status") == "FALLBACK"
    assert res.get("satellite_ndwi_delta") == 0.12, f"Expected 0.12, got {res.get('satellite_ndwi_delta')}"
    assert res.get("ndwi_anomaly_delta") == 0.12
    assert res.get("fallback") is True
    assert sat.get_status() == "FALLBACK"

    print(f"{GREEN}[PASS] Satellite service nominal fallback validated.{RESET}")


def test_dashboard_api_status_diagnostics():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} [TEST 4] Dashboard State api_status Diagnostics{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    client = TestClient(app)
    resp = client.get("/api/v1/dashboard/state")
    assert resp.status_code == 200
    data = resp.json()

    print("Dashboard api_status:", data.get("api_status"))
    assert "api_status" in data, "api_status must be in dashboard state"
    assert "open_meteo" in data["api_status"]
    assert data["api_status"]["open_meteo"] in ["LIVE", "FALLBACK"]
    assert "sentinel_2" in data["api_status"]
    assert data["api_status"]["sentinel_2"] in ["LIVE", "FALLBACK"]

    print(f"{GREEN}[PASS] Dashboard state api_status diagnostics validated.{RESET}")


def test_telemetry_ingestion_resilience():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} [TEST 5] Telemetry Ingestion Immunity to API Outage{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    client = TestClient(app)
    payload = {
        "device_id": "ORACLE-ESP32-01",
        "readings": [
            {
                "sensor_id": "SNS-H01",
                "asset_id": "H01",
                "water_level_cm": 22.0,
                "rise_rate_cm_min": 1.2
            }
        ]
    }

    # Even if Open-Meteo hangs or raises an exception, POST /api/v1/sensors/telemetry must complete immediately
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Simulated 2.0s hang")):
        start_t = time.time()
        resp = client.post("/api/v1/sensors/telemetry", json=payload)
        elapsed = time.time() - start_t

        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "success"
        print(f"Ingestion response time under simulated API outage: {elapsed:.3f}s")
        assert elapsed < 3.0, "Ingestion must never hang beyond strict limits"

    print(f"{GREEN}[PASS] Telemetry ingestion resilience validated.{RESET}")


if __name__ == "__main__":
    test_weather_service_fallback_on_timeout()
    test_weather_service_caching_behavior()
    test_satellite_service_fallback_on_timeout()
    test_dashboard_api_status_diagnostics()
    test_telemetry_ingestion_resilience()
    print(f"\n{BOLD}{GREEN}{'='*65}{RESET}")
    print(f"{BOLD}{GREEN} ALL CIRCUIT BREAKER & FALLBACK TESTS PASSED!{RESET}")
    print(f"{BOLD}{GREEN}{'='*65}{RESET}\n")
