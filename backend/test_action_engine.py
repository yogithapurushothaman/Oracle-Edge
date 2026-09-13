"""
ORACLE Edge - Closed-Loop Action Engine & ESP32 Buzzer Silence Verification Test
Tests:
1. Team pool initialization (3 teams: Team Alpha, Team Bravo, Team Charlie, available count = 3).
2. Telemetry ingestion with critical flood level:
   - Evaluates buzzer = True (unacknowledged alert).
   - Evaluates led_critical = True (red LED active).
3. POST /api/v1/actions/{id}/assign:
   - Assigns next available team ('Team Alpha').
   - Sets buzzer_silenced = True.
   - Decrements available teams count to 2.
4. Subsequent critical telemetry ingestion:
   - Evaluates buzzer = False (buzzer silenced!).
   - Evaluates led_critical = True (red LED remains on to warn of flood depth).
5. POST /api/v1/actions/{id}/complete:
   - Marks status = 'COMPLETED'.
   - Releases team back to AVAILABLE status.
   - Increments available teams count back to 3.
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app, build_dashboard_state
from backend.models import init_db, SessionLocal, Team, Action, Asset

GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def run_action_engine_tests():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} CLOSED-LOOP ACTION ENGINE & BUZZER SILENCE TEST SUITE{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    init_db()
    client = TestClient(app)

    # -------------------------------------------------------------
    # TEST 1: Initial Team Pool & Dashboard State
    # -------------------------------------------------------------
    print(f"\n{BOLD}[TEST 1] Verifying 3 Available Inspection Teams...{RESET}")
    res = client.get("/api/v1/dashboard/state")
    assert res.status_code == 200
    state = res.json()

    print(f"  Available Teams: {state.get('available_teams_count')} / {state.get('total_teams_count')}")
    assert state.get("total_teams_count") == 3, f"Expected 3 teams, got {state.get('total_teams_count')}"
    assert state.get("available_teams_count") == 3, f"Expected 3 available teams, got {state.get('available_teams_count')}"
    
    team_names = [t["team_name"] for t in state.get("teams", [])]
    print(f"  Team List: {team_names}")
    assert "Team Alpha" in team_names
    assert "Team Bravo" in team_names
    assert "Team Charlie" in team_names
    print(f"{GREEN}[PASS] Initial 3 inspection teams validated.{RESET}")

    # -------------------------------------------------------------
    # TEST 2: Critical Telemetry Ingestion (Unacknowledged)
    # -------------------------------------------------------------
    print(f"\n{BOLD}[TEST 2] Transmitting Critical Telemetry (H01 water = 21.5cm)...{RESET}")
    # Reset any active action for H01 to PENDING with buzzer_silenced = False
    with SessionLocal() as db:
        act = db.query(Action).filter(Action.asset_id == "H01").first()
        if act:
            act.status = "PENDING"
            act.buzzer_silenced = False
            act.assigned_team = None
            db.commit()

    crit_payload = {
        "device_id": "ORACLE-ESP32-01",
        "readings": [
            {
                "sensor_id": "SNS-H01",
                "asset_id": "H01",
                "water_level_cm": 21.5,
                "rise_rate_cm_min": 1.8
            },
            {
                "sensor_id": "SNS-B17",
                "asset_id": "B17",
                "water_level_cm": 11.0,
                "rise_rate_cm_min": 0.2
            }
        ]
    }

    res = client.post("/api/v1/sensors/telemetry", json=crit_payload)
    assert res.status_code == 200
    data = res.json()

    print(f"  Buzzer Trigger: {data.get('buzzer')}")
    print(f"  H01 Status: {data['actuators']['H01']['status']}")
    print(f"  H01 Red Critical LED: {data['actuators']['H01']['led_critical']}")
    print(f"  H01 Green Safe LED: {data['actuators']['H01']['led_safe']}")

    assert data["buzzer"] is True, "Buzzer should sound for unacknowledged critical flood!"
    assert data["actuators"]["H01"]["led_critical"] is True, "H01 Red LED must be ON"
    assert data["actuators"]["H01"]["led_safe"] is False, "H01 Green LED must be OFF"
    print(f"{GREEN}[PASS] Unacknowledged critical alert triggers buzzer + red LED.{RESET}")

    # -------------------------------------------------------------
    # TEST 3: Dispatch Team (Acknowledge & Silence)
    # -------------------------------------------------------------
    print(f"\n{BOLD}[TEST 3] Operator Acknowledging & Dispatching Team to H01...{RESET}")
    assign_res = client.post("/api/v1/actions/H01/assign", json={})
    assert assign_res.status_code == 200
    assigned_action = assign_res.json()

    print(f"  Assigned Action ID: {assigned_action.get('action_id')}")
    print(f"  Assigned Team: {assigned_action.get('assigned_team')}")
    print(f"  Status: {assigned_action.get('status')}")
    print(f"  Buzzer Silenced Flag: {assigned_action.get('buzzer_silenced')}")

    assert assigned_action["status"] == "DISPATCHED"
    assert assigned_action["assigned_team"] == "Team Alpha"
    assert assigned_action["buzzer_silenced"] is True

    # Check dashboard state available teams decremented to 2
    dash_res = client.get("/api/v1/dashboard/state")
    dash_state = dash_res.json()
    print(f"  Available Teams After Dispatch: {dash_state.get('available_teams_count')} / {dash_state.get('total_teams_count')}")
    assert dash_state.get("available_teams_count") == 2, "Available teams should decrement from 3 to 2"
    assert dash_state.get("buzzer") is False, "Buzzer should be silenced in dashboard state!"
    assert dash_state.get("buzzer_silenced") is True, "buzzer_silenced flag should be True"
    print(f"{GREEN}[PASS] Dispatch successfully assigned Team Alpha and silenced buzzer.{RESET}")

    # -------------------------------------------------------------
    # TEST 4: Subsequent Telemetry Actuator Response (Buzzer Silent, Red LED ON)
    # -------------------------------------------------------------
    print(f"\n{BOLD}[TEST 4] ESP32 Transmitting Subsequent Telemetry while Dispatched...{RESET}")
    res2 = client.post("/api/v1/sensors/telemetry", json=crit_payload)
    assert res2.status_code == 200
    data2 = res2.json()

    print(f"  Hardware Buzzer: {data2.get('buzzer')}")
    print(f"  H01 Red Critical LED: {data2['actuators']['H01']['led_critical']}")

    assert data2["buzzer"] is False, "Buzzer must remain SILENT because incident is acknowledged/dispatched!"
    assert data2["actuators"]["H01"]["led_critical"] is True, "H01 Red LED must REMAIN LIT to warn of physical water depth!"
    print(f"{GREEN}[PASS] Buzzer remains silenced while Red warning LED stays illuminated.{RESET}")

    # -------------------------------------------------------------
    # TEST 5: Complete Action (Incident Concluded & Team Released)
    # -------------------------------------------------------------
    print(f"\n{BOLD}[TEST 5] Completing Action and Releasing Team...{RESET}")
    complete_res = client.post(f"/api/v1/actions/{assigned_action['action_id']}/complete")
    assert complete_res.status_code == 200
    completed = complete_res.json()
    print(f"  Status: {completed.get('status')}")
    assert completed["status"] == "COMPLETED"

    dash_res3 = client.get("/api/v1/dashboard/state")
    dash_state3 = dash_res3.json()
    print(f"  Available Teams After Completion: {dash_state3.get('available_teams_count')} / {dash_state3.get('total_teams_count')}")
    assert dash_state3.get("available_teams_count") == 3, "Available teams should increment back to 3"
    print(f"{GREEN}[PASS] Team released back to AVAILABLE status.{RESET}")

    print(f"\n{BOLD}{GREEN}{'='*65}{RESET}")
    print(f"{BOLD}{GREEN} ALL 5 TESTS PASSED! CLOSED-LOOP ACTION ENGINE IS OPERATIONAL.{RESET}")
    print(f"{BOLD}{GREEN}{'='*65}{RESET}\n")


if __name__ == "__main__":
    run_action_engine_tests()
