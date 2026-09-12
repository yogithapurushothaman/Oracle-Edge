"""
Test suite for Step 4: Multi-Hazard Scalability, Dynamic Node Registration, and Action Engine
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app, init_db, build_dashboard_state
from backend.models import SessionLocal, Asset, Action, Team

GREEN = "\033[92m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def run_tests():
    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN} STEP 4 INTEGRATION TEST: MULTI-HAZARD & ACTION ENGINE{RESET}")
    print(f"{CYAN}{'='*65}{RESET}")

    init_db()
    client = TestClient(app)

    # 1. Test Seeded Teams & Assets
    print("\n[TEST 1] Verifying Teams & Assets...")
    teams_resp = client.get("/api/v1/teams")
    assert teams_resp.status_code == 200
    teams = teams_resp.json()
    print(f"  Found {len(teams)} municipal response teams:")
    for t in teams:
        print(f"   - {t['team_id']}: {t['team_name']} ({t['hazard_domain']}) [{t['status']}]")
    assert len(teams) >= 4, "Should have seeded 4 default teams"

    # 2. Test Dynamic Node Registration (F09 Vandalur Reserve Forest - WILDFIRE)
    print("\n[TEST 2] Registering Wildfire Node F09...")
    reg_payload = {
        "asset_id": "F09",
        "name": "Vandalur Reserve Forest",
        "domain": "FORESTRY",
        "asset_type": "Forest_Reserve",
        "target_hazard": "WILDFIRE",
        "latitude": 12.8797,
        "longitude": 80.0815,
        "criticality": 0.82,
        "population_impact": 32000
    }
    reg_resp = client.post("/api/v1/assets/register", json=reg_payload)
    assert reg_resp.status_code == 201, f"Expected 201, got {reg_resp.status_code}: {reg_resp.text}"
    reg_data = reg_resp.json()
    print(f"  [REGISTERED]: {reg_data['asset_id']} - {reg_data['name']} (Hazard: {reg_data['target_hazard']})")
    assert reg_data["asset_id"] == "F09"
    assert reg_data["target_hazard"] == "WILDFIRE"

    # 3. Test Dashboard State Multi-Hazard Output
    print("\n[TEST 3] Validating Multi-Hazard Dashboard State...")
    state_resp = client.get("/api/v1/dashboard/state")
    assert state_resp.status_code == 200
    state = state_resp.json()
    
    asset_ids = [a["asset_id"] for a in state["assets"]]
    assert "F09" in asset_ids, "F09 must appear in dashboard state"
    f09_data = next(a for a in state["assets"] if a["asset_id"] == "F09")
    print(f"  F09 Multi-Hazard Telemetry:")
    print(f"   - Surface Temp: {f09_data.get('surface_temp_c')} °C")
    print(f"   - Thermal Risk: {f09_data.get('thermal_risk_pct')} %")
    print(f"   - Humidity: {f09_data.get('humidity_pct')} %")
    print(f"   - Wind Speed: {f09_data.get('wind_speed_kmh')} km/h")
    print(f"   - Risk Score: {f09_data.get('risk_score')} / 100")
    print(f"   - Priority Score: {f09_data.get('priority_score')} / 100")
    print(f"   - SHAP Breakdown: {f09_data.get('shap_breakdown')}")

    # 4. Test Action Engine Queue & Dispatching
    print("\n[TEST 4] Testing Action Engine Queue & Unit Dispatch...")
    actions_resp = client.get("/api/v1/actions")
    assert actions_resp.status_code == 200
    actions = actions_resp.json()
    assert len(actions) > 0, "Action queue must not be empty"
    
    # Find F09 incident action or first pending action
    target_action = next((act for act in actions if act["asset_id"] == "F09"), actions[0])
    action_id = target_action["action_id"]
    print(f"  Target Incident: {action_id} for {target_action['asset_id']}")
    print(f"  Recommended Action: {target_action['recommended_action']}")
    print(f"  Initial Status: {target_action['status']}")

    # Assign Team Charlie (Forestry Fire Rangers)
    assign_resp = client.post(f"/api/v1/actions/{action_id}/assign", json={"team_id": "TEAM-CHARLIE"})
    assert assign_resp.status_code == 200
    assigned_data = assign_resp.json()
    print(f"  After Dispatch:")
    print(f"   - Status: {assigned_data['status']}")
    print(f"   - Assigned Team: {assigned_data['assigned_team']}")
    print(f"   - Countdown: {assigned_data['countdown_seconds']}s")
    assert assigned_data["status"] == "DISPATCHED"
    assert "Charlie" in assigned_data["assigned_team"]

    # 5. Complete Incident
    print("\n[TEST 5] Completing Incident & Releasing Unit...")
    comp_resp = client.post(f"/api/v1/actions/{action_id}/complete")
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    print(f"  Status: {comp_data['status']}")
    assert comp_data["status"] == "COMPLETED"

    # Verify team is released
    teams_after = client.get("/api/v1/teams").json()
    team_charlie = next(t for t in teams_after if t["team_id"] == "TEAM-CHARLIE")
    print(f"  Team Charlie Status: {team_charlie['status']}")
    assert team_charlie["status"] == "AVAILABLE"

    print(f"\n{GREEN}{'='*65}{RESET}")
    print(f"{BOLD}{GREEN} ALL STEP 4 MULTI-HAZARD & ACTION ENGINE TESTS PASSED!{RESET}")
    print(f"{GREEN}{'='*65}{RESET}\n")

if __name__ == "__main__":
    run_tests()
