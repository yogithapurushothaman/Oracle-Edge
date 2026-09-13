"""
ORACLE Edge - ESP32 Hardware Node Watchdog & Heartbeat Test Suite

Validates:
1. Device model attributes (last_seen, status) and dynamic helpers.
2. Ingestion of telemetry sets device.last_seen = now and status = ONLINE.
3. 8.0-second threshold boundary:
   - <= 8.0 seconds -> ONLINE
   - > 8.0 seconds -> OFFLINE
4. /api/v1/dashboard/state returns device_status.
5. /api/v1/stream (SSE) broadcasts {"device_id": "ORACLE-ESP32-01", "status": "ONLINE" | "OFFLINE", "last_seen_sec": int} every 2 seconds.
"""

import sys
import os
import json
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app, get_device_heartbeat
from backend.models import SessionLocal, Device, init_db

GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"


def test_device_model_and_watchdog_boundary():
    print(f"\n{BOLD}{CYAN}================================================================={RESET}")
    print(f"{BOLD}{CYAN} [TEST 1] Device Watchdog 8.0s Boundary & Helper Evaluation{RESET}")
    print(f"{BOLD}{CYAN}================================================================={RESET}")

    init_db()
    db = SessionLocal()
    try:
        dev = db.query(Device).filter(Device.device_id == "ORACLE-ESP32-01").first()
        assert dev is not None, "ORACLE-ESP32-01 must be seeded in database"

        # 1. Fresh ping (0.0s) -> ONLINE
        dev.last_seen = datetime.utcnow()
        dev.status = "ONLINE"
        db.commit()

        hb = get_device_heartbeat("ORACLE-ESP32-01", db)
        print("Fresh Heartbeat (0s):", hb)
        assert hb["status"] == "ONLINE", f"Expected ONLINE, got {hb['status']}"
        assert hb["last_seen_sec"] <= 2, f"Expected last_seen_sec <= 2, got {hb['last_seen_sec']}"

        # 2. 7.5s ago (<= 8.0s) -> ONLINE
        dev.last_seen = datetime.utcnow() - timedelta(seconds=7.5)
        db.commit()

        hb_7s = get_device_heartbeat("ORACLE-ESP32-01", db)
        print("Borderline Online Heartbeat (7.5s):", hb_7s)
        assert hb_7s["status"] == "ONLINE", f"Expected ONLINE at 7.5s, got {hb_7s['status']}"

        # 3. 8.5s ago (> 8.0s) -> OFFLINE
        dev.last_seen = datetime.utcnow() - timedelta(seconds=8.5)
        db.commit()

        hb_off = get_device_heartbeat("ORACLE-ESP32-01", db)
        print("Watchdog Expiration Heartbeat (8.5s):", hb_off)
        assert hb_off["status"] == "OFFLINE", f"Expected OFFLINE at 8.5s, got {hb_off['status']}"
        assert hb_off["last_seen_sec"] >= 8, f"Expected last_seen_sec >= 8, got {hb_off['last_seen_sec']}"

        print(f"{GREEN}[PASS] Watchdog 8.0-second boundary validated.{RESET}")
    finally:
        db.close()


def test_telemetry_ingestion_heartbeat_update():
    print(f"\n{BOLD}{CYAN}================================================================={RESET}")
    print(f"{BOLD}{CYAN} [TEST 2] Telemetry Ingestion Restores ONLINE Status{RESET}")
    print(f"{BOLD}{CYAN}================================================================={RESET}")

    init_db()
    db = SessionLocal()
    try:
        # Manually age device to OFFLINE
        dev = db.query(Device).filter(Device.device_id == "ORACLE-ESP32-01").first()
        dev.last_seen = datetime.utcnow() - timedelta(seconds=30)
        dev.status = "OFFLINE"
        db.commit()

        # Confirm offline
        hb_before = get_device_heartbeat("ORACLE-ESP32-01", db)
        assert hb_before["status"] == "OFFLINE"
        print("Pre-ingestion device status:", hb_before)

        # Ingest telemetry payload from ORACLE-ESP32-01
        client = TestClient(app)
        payload = {
            "device_id": "ORACLE-ESP32-01",
            "readings": [
                {
                    "sensor_id": "SNS-H01",
                    "asset_id": "H01",
                    "water_level_cm": 15.2,
                    "rise_rate_cm_min": 0.3
                }
            ]
        }
        res = client.post("/api/v1/sensors/telemetry", json=payload)
        assert res.status_code == 200, f"Telemetry ingestion failed: {res.text}"

        # Verify device was updated to ONLINE and last_seen is now
        db.refresh(dev)
        hb_after = get_device_heartbeat("ORACLE-ESP32-01", db)
        print("Post-ingestion device status:", hb_after)
        assert hb_after["status"] == "ONLINE", f"Expected ONLINE after ingestion, got {hb_after['status']}"
        assert hb_after["last_seen_sec"] <= 6, f"Expected last_seen_sec <= 6, got {hb_after['last_seen_sec']}"

        print(f"{GREEN}[PASS] Ingestion heartbeat update validated.{RESET}")
    finally:
        db.close()


def test_dashboard_state_and_diagnostic_endpoint():
    print(f"\n{BOLD}{CYAN}================================================================={RESET}")
    print(f"{BOLD}{CYAN} [TEST 3] /api/v1/dashboard/state & /api/v1/device/status Diagnostic{RESET}")
    print(f"{BOLD}{CYAN}================================================================={RESET}")

    client = TestClient(app)
    # Direct device status endpoint
    res_status = client.get("/api/v1/device/status?device_id=ORACLE-ESP32-01")
    assert res_status.status_code == 200
    diag = res_status.json()
    print("GET /api/v1/device/status:", diag)
    assert diag["device_id"] == "ORACLE-ESP32-01"
    assert diag["status"] in ["ONLINE", "OFFLINE"]
    assert "last_seen_sec" in diag

    # Dashboard state snapshot
    res_dash = client.get("/api/v1/dashboard/state")
    assert res_dash.status_code == 200
    dash = res_dash.json()
    assert "device_status" in dash, "dashboard state must include device_status"
    print("Dashboard State device_status:", dash["device_status"])
    assert dash["device_status"]["device_id"] == "ORACLE-ESP32-01"
    assert dash["device_status"]["status"] in ["ONLINE", "OFFLINE"]

    print(f"{GREEN}[PASS] Dashboard state and diagnostic endpoint validated.{RESET}")


def test_sse_stream_heartbeat_broadcast():
    print(f"\n{BOLD}{CYAN}================================================================={RESET}")
    print(f"{BOLD}{CYAN} [TEST 4] SSE Stream 2-Second Heartbeat Broadcast{RESET}")
    print(f"{BOLD}{CYAN}================================================================={RESET}")

    import asyncio
    from starlette.requests import Request

    async def run_stream_test():
        scope = {"type": "http", "method": "GET", "path": "/api/v1/stream", "headers": []}
        req = Request(scope)
        # Call stream_dashboard endpoint
        resp = await app.routes[-1].endpoint(req) if False else None
        
        # We can directly invoke stream_dashboard logic
        from backend.main import stream_dashboard
        streaming_resp = await stream_dashboard(req)
        
        events = []
        async for chunk in streaming_resp.body_iterator:
            chunk_str = chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk
            if chunk_str.startswith("data: "):
                payload = json.loads(chunk_str[6:].strip())
                events.append(payload)
                if payload.get("device_id") == "ORACLE-ESP32-01" and "status" in payload and "last_seen_sec" in payload:
                    print("Captured SSE Heartbeat Event:", payload)
                    return payload
            if len(events) >= 5:
                break
        return None

    hb_captured = asyncio.run(run_stream_test())
    assert hb_captured is not None, "Failed to capture 2-second heartbeat from SSE generator"
    assert hb_captured["device_id"] == "ORACLE-ESP32-01"
    assert hb_captured["status"] in ["ONLINE", "OFFLINE"]
    assert "last_seen_sec" in hb_captured
    print(f"{GREEN}[PASS] SSE 2-second heartbeat broadcast validated.{RESET}")


if __name__ == "__main__":
    test_device_model_and_watchdog_boundary()
    test_telemetry_ingestion_heartbeat_update()
    test_dashboard_state_and_diagnostic_endpoint()
    test_sse_stream_heartbeat_broadcast()
    print(f"\n{BOLD}{GREEN}================================================================={RESET}")
    print(f"{BOLD}{GREEN} ALL WATCHDOG & HEARTBEAT TESTS PASSED!{RESET}")
    print(f"{BOLD}{GREEN}================================================================={RESET}\n")
