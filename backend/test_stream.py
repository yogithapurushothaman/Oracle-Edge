"""
ORACLE Edge - Step 2 Real-Time SSE Stream & Dashboard State Verification
Tests:
1. GET /api/v1/dashboard/state snapshot
2. Ingestion trigger and real-time subscriber broadcast
3. Live HTTP SSE stream verification (if server running)
"""

import sys
import os
import json
import asyncio
import argparse

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app, subscribers, build_dashboard_state
from backend.models import SessionLocal

GREEN = "\033[92m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def test_dashboard_state_snapshot():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} TEST 1: GET /api/v1/dashboard/state SNAPSHOT{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    client = TestClient(app)
    response = client.get("/api/v1/dashboard/state")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()

    print(f"Status: {data.get('status')}")
    print(f"Top Priority: {data.get('top_priority')}")
    print(f"Buzzer: {data.get('buzzer')}")
    print(f"Recommended Action: {data.get('recommended_action')}")
    print(f"Asset Count: {len(data.get('assets', []))}")

    assert data.get("status") == "OPERATIONAL"
    assert "top_priority" in data
    assert "buzzer" in data
    assert "recommended_action" in data
    assert len(data.get("assets", [])) >= 2

    # Check H01 and B17
    asset_ids = [a["asset_id"] for a in data["assets"]]
    assert "H01" in asset_ids, "H01 should be present in dashboard assets"
    assert "B17" in asset_ids, "B17 should be present in dashboard assets"

    print(f"{GREEN}[PASS] TEST 1: Dashboard state snapshot validated.{RESET}")


def test_subscriber_broadcast():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} TEST 2: REAL-TIME INGESTION -> SUBSCRIBER BROADCAST LOOP{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    client = TestClient(app)

    # 1. Simulate an SSE client connecting by adding a queue to subscribers
    test_queue = asyncio.Queue()
    subscribers.add(test_queue)

    try:
        # 2. Post high-water level surge on H01
        telemetry_payload = {
            "device_id": "ORACLE-ESP32-01",
            "readings": [
                {
                    "sensor_id": "SNS-H01",
                    "asset_id": "H01",
                    "water_level_cm": 21.0,  # CRITICAL >= 18.0
                    "rise_rate_cm_min": 0.8
                },
                {
                    "sensor_id": "SNS-B17",
                    "asset_id": "B17",
                    "water_level_cm": 10.0,
                    "rise_rate_cm_min": 0.1
                }
            ]
        }

        post_resp = client.post("/api/v1/sensors/telemetry", json=telemetry_payload)
        assert post_resp.status_code == 200

        # 3. Verify the subscriber received the broadcasted update
        assert not test_queue.empty(), "Subscriber queue must receive broadcast event"
        broadcast_data = test_queue.get_nowait()

        print("Broadcast Event Top Priority:", broadcast_data.get("top_priority"))
        print("Broadcast Event Buzzer:", broadcast_data.get("buzzer"))
        print("Broadcast Recommended Action:", broadcast_data.get("recommended_action"))

        assert broadcast_data["top_priority"] == "H01"
        assert broadcast_data["buzzer"] is True
        assert "Hospital" in broadcast_data["recommended_action"]

        h01_item = next((a for a in broadcast_data["assets"] if a["asset_id"] == "H01"), None)
        assert h01_item is not None
        assert h01_item["status"] == "CRITICAL"
        assert h01_item["water_level_cm"] == 21.0
        assert h01_item["led_critical"] is True
        assert h01_item["led_safe"] is False

        print(f"{GREEN}[PASS] TEST 2: Ingestion successfully triggered real-time broadcast to subscriber.{RESET}")

    finally:
        subscribers.discard(test_queue)


def test_live_stream(base_url="http://127.0.0.1:8000"):
    import requests
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} TEST 3: LIVE HTTP SSE STREAM ({base_url}/api/v1/stream){RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    response = requests.get(f"{base_url}/api/v1/stream", stream=True, timeout=5)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")

    # Read first line from SSE stream
    for line in response.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                data = json.loads(decoded[6:])
                print("Live Stream Snapshot Top Priority:", data.get("top_priority"))
                print("Live Stream Status:", data.get("status"))
                assert data.get("status") == "OPERATIONAL"
                break

    print(f"{GREEN}[PASS] TEST 3: Live SSE connection verified.{RESET}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ORACLE Edge Step 2 Test Script")
    parser.add_argument("--live", action="store_true", help="Test live server on http://127.0.0.1:8000")
    args = parser.parse_args()

    test_dashboard_state_snapshot()
    test_subscriber_broadcast()

    if args.live:
        test_live_stream()

    print(f"\n{BOLD}{GREEN}{'='*65}{RESET}")
    print(f"{BOLD}{GREEN} ALL STEP 2 STREAMING & SNAPSHOT TESTS PASSED!{RESET}")
    print(f"{BOLD}{GREEN}{'='*65}{RESET}\n")
