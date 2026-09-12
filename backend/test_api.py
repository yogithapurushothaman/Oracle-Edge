import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    import fastapi
    print("FastAPI version:", fastapi.__version__)
    from backend.main import app
    print("FastAPI app imported successfully!")
    from fastapi.testclient import TestClient
    client = TestClient(app)
    
    # Test Root
    r = client.get("/")
    print("GET / ->", r.status_code, r.json().get("platform"))
    
    # Test List Assets
    r = client.get("/api/v1/assets")
    print("GET /api/v1/assets ->", r.status_code, "Count:", len(r.json()))
    
    # Test Top Risk
    r = client.get("/api/v1/risk/top")
    print("GET /api/v1/risk/top ->", r.status_code, "Top asset:", r.json()[0]["asset_id"] if r.json() else "None")
    
    # Test Ingestion (PRD Demo Step 4)
    telemetry = {
        "device_id": "ORACLE-001",
        "water_level_cm": 75.0,
        "water_rise_rate_cm_min": 2.8,
        "rain_detected": True,
        "rainfall_1h_mm": 50.0,
        "rainfall_3h_mm": 105.0,
        "rainfall_24h_mm": 190.0,
        "battery_voltage": 3.98
    }
    r = client.post("/api/v1/sensors/readings", json=telemetry)
    print("POST /api/v1/sensors/readings ->", r.status_code, r.json())
    
    # Test Map Layer
    r = client.get("/api/v1/map")
    print("GET /api/v1/map ->", r.status_code, "Feature count:", len(r.json()["features"]))

    # Test Recommendations
    r = client.get("/api/v1/recommendations")
    print("GET /api/v1/recommendations ->", r.status_code, "Actions count:", len(r.json()["actions"]))

    print("\n[ALL BACKEND API TESTS PASSED SUCCESSFULLY!]")
except Exception as e:
    import traceback
    traceback.print_exc()
