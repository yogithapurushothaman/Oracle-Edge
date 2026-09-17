"""
ORACLE Edge - Core Ingestion, Real-Time Streaming & Actuator Backend
Step 1 & Step 2: FastAPI + SQLite (SQLAlchemy) + Server-Sent Events (SSE)

Receives telemetry from tabletop ESP32 hardware, commands actuators (LEDs and buzzer),
and broadcasts real-time updates to the ORACLE Command Center Dashboard via SSE.
"""

import os
import sys
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Set, Any
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# Allow imports whether executed from root or backend directory
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from backend.models import (
        init_db, get_db, SessionLocal, Asset, TelemetryReading,
        Action, Team, Device, TelemetryPayload, TelemetryResponse, ActuatorState,
        AssetRegisterIn, AssetOut, ActionAssignIn, ActionOut, TeamOut, TelemetryReadingOut,
        SensorReadingIn
    )
    from backend.services.decision_engine import decision_engine
    from backend.services.weather_service import weather_service
    from backend.services.satellite_service import satellite_service
    from backend.engine.triage import municipal_triage_engine
    from backend.engine.digital_twin import digital_twin_registry
    from backend.engine.ingestion import edge_ingestion_manager
except ImportError:
    from models import (
        init_db, get_db, SessionLocal, Asset, TelemetryReading,
        Action, Team, Device, TelemetryPayload, TelemetryResponse, ActuatorState,
        AssetRegisterIn, AssetOut, ActionAssignIn, ActionOut, TeamOut, TelemetryReadingOut,
        SensorReadingIn
    )
    from services.decision_engine import decision_engine
    from services.weather_service import weather_service
    from services.satellite_service import satellite_service
    from engine.triage import municipal_triage_engine
    from engine.digital_twin import digital_twin_registry
    from engine.ingestion import edge_ingestion_manager


# Active SSE subscribers
subscribers: Set[asyncio.Queue] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed baseline assets on startup."""
    init_db()
    yield


app = FastAPI(
    title="ORACLE Edge - Command Center Intelligence Backend",
    description="Tabletop ESP32 telemetry ingestion, real-time SSE stream, and actuator loop.",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Dashboard State Helper
# ==========================================

def calculate_risk_score_out_of_100(water_level_cm: float, rise_rate_cm_min: float, criticality: float, is_critical: bool, is_full_scale: bool = False) -> float:
    """Calculates an intuitive 0-100 risk score aligned with critical thresholds."""
    if is_full_scale or water_level_cm > 30.0:
        # Full scale 0-85cm (PRD Demonstration Scenario)
        if is_critical or water_level_cm >= 70.0:
            base = 88.0 + (water_level_cm - 70.0) * 0.7 + (rise_rate_cm_min * 2.0) + (criticality * 4.0)
            return min(99.0, max(85.0, round(base, 1)))
        elif water_level_cm >= 55.0 or rise_rate_cm_min >= 1.5:
            base = 66.0 + (water_level_cm - 55.0) * 0.7 + (rise_rate_cm_min * 3.5)
            return min(80.0, max(65.0, round(base, 1)))
        elif water_level_cm >= 35.0 or rise_rate_cm_min >= 0.6:
            base = 42.0 + (water_level_cm - 35.0) * 0.6 + (rise_rate_cm_min * 4.0)
            return min(60.0, max(35.0, round(base, 1)))
        else:
            base = 12.0 + (water_level_cm / 30.0) * 14.0 + (criticality * 4.0)
            return min(30.0, max(10.0, round(base, 1)))
    else:
        # Tabletop scale 0-25cm
        if is_critical:
            base = 82.0 + (water_level_cm - 18.0) * 1.5 + (rise_rate_cm_min * 4.0) + (criticality * 6.0)
            return min(99.0, max(82.0, round(base, 1)))
        elif water_level_cm >= 12.0 or rise_rate_cm_min >= 0.5:
            base = 45.0 + (water_level_cm - 12.0) * 3.5 + (rise_rate_cm_min * 15.0) + (criticality * 10.0)
            return min(79.0, max(45.0, round(base, 1)))
        else:
            base = (water_level_cm / 12.0) * 30.0 + (rise_rate_cm_min * 10.0) + (criticality * 5.0)
            return min(44.0, max(5.0, round(base, 1)))


def get_device_heartbeat(device_id: str = "ORACLE-ESP32-01", db: Optional[Session] = None) -> dict:
    """
    Evaluates hardware watchdog status:
    - If (now - last_seen).total_seconds() <= 8.0: ONLINE (Physical Hardware Mode)
    - If (now - last_seen).total_seconds() > 8.0: SIMULATION (Standalone / Offline Simulation Mode)
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True
    try:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        now = datetime.utcnow()
        if not device or not device.last_seen:
            return {
                "device_id": device_id,
                "status": "SIMULATION",
                "mode": "SIMULATION",
                "is_online": False,
                "last_seen_sec": 9999
            }
        elapsed = (now - device.last_seen).total_seconds()
        is_online = elapsed <= 8.0
        status_str = "ONLINE" if is_online else "SIMULATION"
        mode_str = "HARDWARE" if is_online else "SIMULATION"

        if device.status != status_str:
            device.status = status_str
            try:
                db.commit()
            except Exception:
                pass

        return {
            "device_id": device_id,
            "status": status_str,
            "mode": mode_str,
            "is_online": is_online,
            "last_seen_sec": max(0, int(elapsed))
        }
    finally:
        if close_db:
            db.close()


def build_dashboard_state(db: Session) -> dict:
    """Constructs a comprehensive snapshot of all assets, readings, rankings, actuators, actions, and teams."""
    assets = db.query(Asset).all()
    if not assets:
        seed_assets(db)
        assets = db.query(Asset).all()

    asset_data_list = []
    any_critical = False
    actuators_dict = {}

    for asset in assets:
        target_hazard = asset.target_hazard or "FLOOD"
        lat = asset.latitude if asset.latitude is not None else (13.0405 if asset.asset_id == "H01" else 13.0827)
        lng = asset.longitude if asset.longitude is not None else (80.2450 if asset.asset_id == "H01" else 80.2707)
        satellite_ndwi_delta = 0.0

        # Multi-Hazard Scoring Dispatch
        if target_hazard == "WILDFIRE":
            # Fetch live weather (or cached) from Open-Meteo
            w = weather_service.fetch_weather_sync(lat, lng)
            temp_c = float(w.get("temperature_c", 38.5))
            humid = float(w.get("humidity_pct", 28.0))
            wind = float(w.get("wind_speed_kmh", 22.0))
            thermal_anom = 0.76 if temp_c >= 35.0 else 0.40

            wf = decision_engine.compute_wildfire_scores(
                surface_temp_c=temp_c,
                thermal_anomaly=thermal_anom,
                humidity_pct=humid,
                wind_speed_kmh=wind,
                dry_fuel_index=0.78,
                population_impact=asset.population_served,
                criticality=asset.criticality or 0.82
            )
            risk_score = wf["risk_score"]
            priority_score = wf["priority_score"]
            status_str = wf["risk_level"]
            is_critical = wf["is_critical"]
            shap_factors = wf["shap_breakdown"]

            water_level = 0.0
            rise_rate = 0.0
            surface_temp = round(temp_c, 1)
            thermal_risk = round(thermal_anom * 100.0, 1)
            humidity_val = round(humid, 1)
            wind_val = round(wind, 1)
            tilt_val = 0.0
            vib_val = 0.0
            scour_val = 0.0
            timestamp = datetime.utcnow().isoformat()

        elif target_hazard == "STRUCTURAL":
            st = decision_engine.compute_structural_scores(
                tilt_deg=1.6,
                vibration_g=0.45,
                flood_scour_risk=52.0,
                population_impact=asset.population_served,
                criticality=asset.criticality or 0.85
            )
            risk_score = st["risk_score"]
            priority_score = st["priority_score"]
            status_str = st["risk_level"]
            is_critical = st["is_critical"]
            shap_factors = st["shap_breakdown"]

            water_level = 14.5
            rise_rate = 0.4
            surface_temp = 32.0
            thermal_risk = 20.0
            humidity_val = 65.0
            wind_val = 14.0
            tilt_val = st["tilt_deg"]
            vib_val = st["vibration_g"]
            scour_val = st["scour_risk"]
            timestamp = datetime.utcnow().isoformat()

        else:
            # FLOOD (Default) - Multi-Factor Municipal Triage
            latest = db.query(TelemetryReading).filter(
                TelemetryReading.asset_id == asset.asset_id
            ).order_by(TelemetryReading.id.desc()).first()

            if latest:
                water_level = latest.water_level_cm
                rise_rate = latest.rise_rate_cm_min
                timestamp = latest.timestamp.isoformat()
            else:
                water_level = 0.0
                rise_rate = 0.0
                timestamp = datetime.utcnow().isoformat()

            scored = municipal_triage_engine.compute_asset_risk(asset.asset_id, water_level, rise_rate)
            risk_score = scored["total_risk"]
            priority_score = scored["total_risk"]
            status_str = scored["status"]
            is_critical = (status_str == "CRITICAL")
            shap_factors = {
                "IoT Depth & Rise Rate": scored["breakdown"].get("water_level_points", 0.0),
                "Infrastructure Criticality": scored["breakdown"].get("criticality_points", 0.0),
                "Population Exposure": scored["breakdown"].get("population_points", 0.0),
                "Satellite GIS Risk": scored["breakdown"].get("weather_points", 0.0),
                "Historical Baseline": scored["breakdown"].get("historical_points", 0.0),
                "Water Level": scored["breakdown"].get("water_level_points", 0.0),
                "Criticality": scored["breakdown"].get("criticality_points", 0.0),
                "Population Impact": scored["breakdown"].get("population_points", 0.0),
                "Weather": scored["breakdown"].get("weather_points", 0.0),
                "Historical Data": scored["breakdown"].get("historical_points", 0.0),
            }

            sat_obs = satellite_service.get_evaluator_observation(
                asset.asset_id,
                ground_water_level_cm=water_level,
                ground_rise_rate_cm_min=rise_rate
            )
            satellite_ndwi_delta = float(sat_obs.get("satellite_ndwi_delta", 0.12))

            surface_temp = 31.0
            thermal_risk = 15.0
            humidity_val = 78.0
            wind_val = 18.0
            tilt_val = 0.2
            vib_val = 0.08
            scour_val = 30.0

        if is_critical:
            any_critical = True

        actuator_state = {
            "status": status_str,
            "led_safe": not is_critical,
            "led_critical": is_critical
        }
        actuators_dict[asset.asset_id] = actuator_state

        asset_data_list.append({
            "asset_id": asset.asset_id,
            "name": asset.name,
            "type": asset.asset_type or ("Hospital" if asset.asset_id == "H01" else "Bridge"),
            "domain": asset.domain or "URBAN_INFRASTRUCTURE",
            "target_hazard": target_hazard,
            "latitude": lat,
            "longitude": lng,
            "criticality": asset.criticality,
            "population_served": asset.population_served,
            "water_level_cm": round(water_level, 1),
            "rise_rate_cm_min": round(rise_rate, 2),
            "satellite_ndwi_delta": round(satellite_ndwi_delta, 3),
            "surface_temp_c": surface_temp,
            "thermal_risk_pct": thermal_risk,
            "humidity_pct": humidity_val,
            "wind_speed_kmh": wind_val,
            "tilt_deg": tilt_val,
            "vibration_g": vib_val,
            "scour_risk_pct": scour_val,
            "priority_score": round(priority_score, 2),
            "risk_score": risk_score,
            "status": status_str,
            "timestamp": timestamp,
            "led_safe": not is_critical,
            "led_critical": is_critical,
            "shap_breakdown": shap_factors
        })

    # Sort descending by priority_score to assign ranks
    asset_data_list.sort(key=lambda a: a["priority_score"], reverse=True)
    for idx, a in enumerate(asset_data_list):
        a["priority_rank"] = idx + 1

    # Check active action / dispatch state
    active_action = db.query(Action).filter(Action.status != "COMPLETED").order_by(Action.created_at.desc()).first()
    is_silenced = bool(active_action and active_action.buzzer_silenced)
    assigned_team_name = active_action.assigned_team if (active_action and active_action.status == "DISPATCHED") else None

    # Compute overall municipal triage recommendation and tie-breaker
    triage_payload = [
        {"asset_id": a["asset_id"], "water_level_cm": a["water_level_cm"], "rise_rate_cm_min": a["rise_rate_cm_min"]}
        for a in asset_data_list
    ]
    triage_result = municipal_triage_engine.compute_municipal_triage(
        triage_payload,
        is_dispatched=is_silenced,
        assigned_team=assigned_team_name
    )

    top_priority_id = triage_result["top_priority"]
    recommended_action = triage_result["recommended_action"]
    action_level = triage_result["action_level"]

    # Seed baseline actions if table is empty
    actions_in_db = db.query(Action).all()
    if not actions_in_db:
        baseline_actions = [
            Action(
                action_id="ACT-H01-INIT",
                asset_id="H01",
                recommended_action="Deploy Emergency Flood Barrier Crew to Hospital Perimeter",
                priority=1,
                priority_score=92.0,
                target_hazard="FLOOD",
                assigned_team=None,
                target_response_time="10 mins",
                status="PENDING",
                buzzer_silenced=False,
                reasoning="Water level surge near ICU basement inlet.",
                created_at=datetime.utcnow(),
                dispatched_at=None,
                countdown_seconds=900
            ),
            Action(
                action_id="ACT-B17-INIT",
                asset_id="B17",
                recommended_action="Dispatch Ultrasonic Pier Scour Assessment Team",
                priority=2,
                priority_score=76.0,
                target_hazard="STRUCTURAL",
                assigned_team=None,
                target_response_time="20 mins",
                status="PENDING",
                buzzer_silenced=False,
                reasoning="Hydrodynamic current rise on Adyar causeway.",
                created_at=datetime.utcnow(),
                countdown_seconds=1200
            )
        ]
        db.add_all(baseline_actions)
        db.commit()
        actions_in_db = db.query(Action).all()

    # Closed-loop Buzzer Silence evaluation:
    # If all critical assets have their active actions silenced (team dispatched), buzzer turns OFF.
    any_unsilenced_critical = False
    for asset_item in asset_data_list:
        if asset_item["status"] == "CRITICAL":
            act = db.query(Action).filter(
                Action.asset_id == asset_item["asset_id"],
                Action.status != "COMPLETED"
            ).order_by(Action.created_at.desc()).first()
            if not act or not act.buzzer_silenced:
                any_unsilenced_critical = True

    # Primary critical asset buzzer silence state for UI banner
    primary_crit_asset = next((a for a in asset_data_list if a["status"] == "CRITICAL"), None)
    if primary_crit_asset:
        prim_act = db.query(Action).filter(
            Action.asset_id == primary_crit_asset["asset_id"],
            Action.status != "COMPLETED"
        ).order_by(Action.created_at.desc()).first()
        buzzer_silenced = bool(prim_act and prim_act.buzzer_silenced)
    else:
        buzzer_silenced = False

    available_teams_count = db.query(Team).filter(Team.status == "AVAILABLE").count()
    total_teams_count = db.query(Team).count()

    actions_list = [
        {
            "action_id": act.action_id,
            "asset_id": act.asset_id,
            "recommended_action": act.recommended_action,
            "priority": act.priority,
            "priority_score": act.priority_score,
            "target_hazard": act.target_hazard or "FLOOD",
            "assigned_team": act.assigned_team,
            "target_response_time": act.target_response_time,
            "status": act.status,
            "buzzer_silenced": bool(act.buzzer_silenced),
            "reasoning": act.reasoning,
            "created_at": act.created_at.isoformat() if act.created_at else None,
            "dispatched_at": act.dispatched_at.isoformat() if act.dispatched_at else None,
            "completed_at": act.completed_at.isoformat() if act.completed_at else None,
            "countdown_seconds": act.countdown_seconds or 900
        }
        for act in sorted(actions_in_db, key=lambda x: x.priority_score, reverse=True)
    ]

    teams_in_db = db.query(Team).all()
    teams_list = [
        {
            "team_id": t.team_id,
            "team_name": t.team_name,
            "specialty": t.specialty,
            "hazard_domain": t.hazard_domain,
            "status": t.status,
            "current_assignment": t.current_assignment
        }
        for t in teams_in_db
    ]

    crit_count = sum(1 for a in asset_data_list if a["status"] == "CRITICAL")
    high_count = sum(1 for a in asset_data_list if a["status"] in ["ELEVATED", "HIGH"] or (a["risk_score"] >= 60.0 and a["status"] != "CRITICAL"))

    # Determine selected asset telemetry (H01 or B17)
    focus_asset = next((a for a in asset_data_list if a["asset_id"] == top_priority_id), asset_data_list[0])

    return {
        "status": "OPERATIONAL",
        "timestamp": datetime.utcnow().isoformat(),
        "device_id": "ORACLE-ESP32-01",
        "top_priority": top_priority_id,
        "buzzer": any_unsilenced_critical,
        "buzzer_silenced": buzzer_silenced,
        "critical_assets_count": crit_count,
        "high_risk_assets_count": max(1, high_count),
        "total_monitored_assets_count": 27,
        "system_status_label": "Emergency Triage" if crit_count > 0 else "Normal",
        "system_status_subtext": "(Triage Active)" if crit_count > 0 else "(All Systems Functional)",
        "available_teams_count": available_teams_count,
        "total_teams_count": total_teams_count,
        "action_level": action_level,
        "recommended_action": recommended_action,
        "explainable_ai": {
            "risk_score": triage_result.get("top_risk_score", 92.0),
            "rationale": triage_result.get(
                "explainable_rationale",
                "H01 is ranked higher because it is a critical healthcare facility with ICU dependency, high population exposure, and no evacuation tolerance, despite similar water levels at B17."
            ),
            "factor_breakdown": {
                "Water Level": 35.0,
                "Criticality": 25.0,
                "Population Impact": 20.0,
                "Weather": 10.0,
                "Historical Data": 10.0
            }
        },
        "digital_twins": digital_twin_registry.get_all_digital_twins(),
        "resource_readiness": {
            "team_name": "Rapid Response Alpha",
            "assigned_target": "Metro Hospital (H01)",
            "members_count": 5,
            "equipment": "Boats, Pumps, Medical Support",
            "eta_minutes": 12,
            "status": "DISPATCHED" if buzzer_silenced else "ASSIGNED"
        },
        "incident_timeline": [
            {"time": "14:02", "event": "Rainfall Detected (12 mm/hr)", "detail": "Basin runoff initiated", "severity": "WARNING"},
            {"time": "14:05", "event": "H01 Water Level Warning (3.0 cm)", "detail": "Yellow threshold breached", "severity": "WARNING"},
            {"time": "14:07", "event": "H01 Critical Alert (3.5 cm)", "detail": "Tie-breaker triggered Priority #1", "severity": "CRITICAL"},
            {"time": "14:08", "event": "Alpha Team Dispatched (ETA 12 min)", "detail": "High-capacity pumps mobilized", "severity": "DISPATCHED"}
        ],
        "active_nodes_count": 2,
        "total_nodes_count": 2,
        "population_impact": 15000,
        "warning_assets_count": max(1, high_count),
        "weather": {
            "temperature_c": 24.0,
            "condition": "Heavy Rain",
            "rainfall_rate_mm_hr": 12.0,
            "wind_speed_kmh": 15,
            "humidity_pct": 92,
            "location": "Chennai, Tamil Nadu"
        },
        "sensor_telemetry": {
            "selected_asset": focus_asset["asset_id"],
            "selected_asset_name": focus_asset["name"],
            "water_level_cm": focus_asset["water_level_cm"],
            "water_rise_rate": focus_asset["rise_rate_cm_min"],
            "rainfall_rate_mm_hr": 12.0 if focus_asset["water_level_cm"] > 1.0 else 2.0,
            "temperature_c": 24.0,
            "vibration_g": 0.8 if focus_asset["water_level_cm"] >= 3.0 else 0.2
        },
        "recent_alerts": [
            {"time": "14:08", "asset": "Rapid Response Alpha", "message": "Team mobilized to Metro Hospital (H01)", "detail": "ETA 12 minutes", "severity": "DISPATCHED"},
            {"time": "14:07", "asset": f"{focus_asset['name']} ({focus_asset['asset_id']})", "message": f"Water level at {focus_asset['water_level_cm']:.1f} cm", "detail": f"Risk assessed at {focus_asset['risk_score']:.0f}", "severity": focus_asset["status"]},
            {"time": "14:05", "asset": "River Bridge (B17)", "message": "Water Level Warning (3.0 cm)", "detail": "Elevated hydro scour alert", "severity": "HIGH"},
            {"time": "14:02", "asset": "Open-Meteo Ingestion", "message": "Rainfall Detected (12 mm/hr)", "detail": "Convective storm surge", "severity": "WARNING"}
        ],
        "api_status": {
            "open_meteo": weather_service.get_status(),
            "sentinel_2": satellite_service.get_status()
        },
        "device_status": get_device_heartbeat("ORACLE-ESP32-01", db),
        "assets": asset_data_list,
        "actuators": actuators_dict,
        "actions": actions_list,
        "teams": teams_list
    }


def broadcast_dashboard_state(state: dict):
    """Pushes the new state to all connected SSE clients."""
    for queue in list(subscribers):
        try:
            queue.put_nowait(state)
        except Exception:
            pass


# ==========================================
# Root & Health Endpoints
# ==========================================

@app.get("/")
def root():
    return {
        "platform": "ORACLE Edge",
        "step": "Step 2 - Real-Time Streaming & Command Center Backend",
        "status": "OPERATIONAL",
        "active_sse_subscribers": len(subscribers),
        "endpoints": [
            "POST /api/v1/sensors/telemetry",
            "GET  /api/v1/stream",
            "GET  /api/v1/dashboard/state",
            "GET  /api/v1/assets",
            "GET  /api/v1/sensors/telemetry/latest"
        ]
    }


# ==========================================
# Telemetry Ingestion & Actuator Control
# ==========================================

@app.post(
    "/api/v1/sensors/telemetry",
    response_model=TelemetryResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest multi-sensor ESP32 telemetry, command actuators, and broadcast live SSE"
)
def ingest_telemetry(payload: TelemetryPayload, db: Session = Depends(get_db)):
    """
    Ingests sensor readings from ESP32 tabletop node:
    - Computes Priority Score: (water_level_cm * 0.4) + (rise_rate_cm_min * 0.2) + (criticality * 40.0)
    - Determines Priority #1 (highest priority score)
    - Flags status as CRITICAL if water_level_cm >= 18.0 or rise_rate_cm_min >= 1.0; else SAFE
    - Buzzer = True if any asset is CRITICAL
    - Commands actuators (LEDs & Buzzer)
    - Broadcasts live state to dashboard over SSE
    """
    if not payload.readings:
        return TelemetryResponse(
            status="success",
            top_priority=None,
            buzzer=False,
            actuators={}
        )

    actuators: Dict[str, ActuatorState] = {}
    priority_scores: Dict[str, float] = {}
    any_unsilenced_critical = False

    for reading in payload.readings:
        scored = municipal_triage_engine.compute_asset_risk(
            reading.asset_id,
            reading.water_level_cm,
            reading.rise_rate_cm_min
        )
        status_str = scored["status"]
        priority_score = scored["total_risk"]
        is_critical = scored["led_critical"]
        priority_scores[reading.asset_id] = priority_score

        # Check if active incident for this asset has been silenced (team dispatched)
        active_action = db.query(Action).filter(
            Action.asset_id == reading.asset_id,
            Action.status != "COMPLETED"
        ).order_by(Action.created_at.desc()).first()

        is_silenced = bool(active_action and active_action.buzzer_silenced)
        if is_critical and not is_silenced:
            any_unsilenced_critical = True

        # Actuator states for hardware closed loop
        actuators[reading.asset_id] = ActuatorState(
            status=status_str,
            led_safe=scored["led_safe"],
            led_critical=scored["led_critical"]
        )

        # Persist telemetry reading to SQLite
        db_reading = TelemetryReading(
            device_id=payload.device_id,
            sensor_id=reading.sensor_id,
            asset_id=reading.asset_id,
            water_level_cm=reading.water_level_cm,
            rise_rate_cm_min=reading.rise_rate_cm_min,
            priority_score=round(priority_score, 4),
            status=status_str,
            timestamp=datetime.utcnow()
        )
        db.add(db_reading)

    # 5b. Update hardware watchdog heartbeat for ESP32 node
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        device = Device(
            device_id=payload.device_id,
            device_name=f"ORACLE {payload.device_id} Node",
            status="ONLINE",
            last_seen=datetime.utcnow()
        )
        db.add(device)
    else:
        device.last_seen = datetime.utcnow()
        device.status = "ONLINE"

    db.commit()

    top_priority = max(priority_scores.items(), key=lambda x: x[1])[0]
    buzzer = any_unsilenced_critical

    # 6. Broadcast updated state to all connected dashboard SSE clients
    current_state = build_dashboard_state(db)
    broadcast_dashboard_state(current_state)

    return TelemetryResponse(
        status="success",
        top_priority=top_priority,
        buzzer=buzzer,
        actuators=actuators
    )


# ==========================================
# Real-Time SSE Stream & Snapshot Endpoints
# ==========================================

@app.get("/api/v1/dashboard/state", summary="Current snapshot of dashboard state")
def get_dashboard_state(db: Session = Depends(get_db)):
    """Returns the current state snapshot for immediate UI population on load."""
    return build_dashboard_state(db)


@app.get("/api/v1/stream", summary="Server-Sent Events (SSE) live telemetry stream")
async def stream_dashboard(request: Request):
    """
    Subscribes to live Server-Sent Events (SSE):
    - Transmits initial state snapshot immediately upon connection.
    - Streams updates whenever new sensor telemetry is ingested.
    - Heartbeat ping every 15s to keep connection open.
    """
    queue: asyncio.Queue = asyncio.Queue()
    subscribers.add(queue)

    # Initial state snapshot
    db = SessionLocal()
    try:
        initial_state = build_dashboard_state(db)
        await queue.put(initial_state)
    finally:
        db.close()

    async def event_generator():
        last_heartbeat_time = asyncio.get_event_loop().time()
        try:
            while True:
                try:
                    if await request.is_disconnected():
                        break
                except Exception:
                    pass
                try:
                    time_since_last_hb = asyncio.get_event_loop().time() - last_heartbeat_time
                    wait_time = max(0.1, 2.0 - time_since_last_hb)
                    data = await asyncio.wait_for(queue.get(), timeout=wait_time)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    pass

                now_time = asyncio.get_event_loop().time()
                if now_time - last_heartbeat_time >= 2.0:
                    last_heartbeat_time = now_time
                    db_watchdog = SessionLocal()
                    try:
                        hb = get_device_heartbeat("ORACLE-ESP32-01", db_watchdog)
                        yield f"data: {json.dumps(hb)}\n\n"
                    finally:
                        db_watchdog.close()
        finally:
            subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )


@app.get("/api/v1/device/status", summary="ESP32 hardware node watchdog and heartbeat status")
def get_device_status(device_id: str = "ORACLE-ESP32-01", db: Session = Depends(get_db)):
    """Returns dynamic watchdog status for the specified ESP32 hardware device."""
    return get_device_heartbeat(device_id, db)


# ==========================================
# Auxiliary Query Endpoints
# ==========================================

@app.get("/api/v1/assets", response_model=List[AssetOut], summary="List all monitored assets")
def list_assets(db: Session = Depends(get_db)):
    return db.query(Asset).all()


@app.get("/api/v1/assets/{asset_id}", response_model=AssetOut, summary="Get asset detail")
def get_asset(asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{asset_id}' not found")
    return asset


@app.get("/api/v1/sensors/telemetry/latest", response_model=List[TelemetryReadingOut], summary="Latest telemetry readings")
def get_latest_telemetry(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(TelemetryReading).order_by(TelemetryReading.id.desc()).limit(limit).all()


# ==========================================
# Step 4: Multi-Hazard Registration & Action Engine Endpoints
# ==========================================

@app.post(
    "/api/v1/assets/register",
    response_model=AssetOut,
    status_code=status.HTTP_201_CREATED,
    summary="Dynamic edge node registration (e.g. F09 Vandalur Reserve Forest)"
)
def register_asset(payload: AssetRegisterIn, db: Session = Depends(get_db)):
    """
    Registers a new edge node on-the-fly:
    - Stores asset metadata, domain, hazard type, and coordinates.
    - Immediately fetches live weather/temperature from Open-Meteo.
    - Generates corresponding priority action in the incident dispatch queue.
    - Broadcasts updated multi-hazard state via SSE to all connected dashboards.
    """
    existing = db.query(Asset).filter(Asset.asset_id == payload.asset_id).first()
    if existing:
        existing.name = payload.name
        existing.domain = payload.domain
        existing.asset_type = payload.asset_type
        existing.target_hazard = payload.target_hazard
        existing.latitude = payload.latitude
        existing.longitude = payload.longitude
        existing.criticality = payload.criticality
        existing.population_served = payload.population_impact
        asset = existing
    else:
        asset = Asset(
            asset_id=payload.asset_id,
            name=payload.name,
            domain=payload.domain,
            asset_type=payload.asset_type,
            target_hazard=payload.target_hazard,
            latitude=payload.latitude,
            longitude=payload.longitude,
            criticality=payload.criticality,
            population_served=payload.population_impact,
            status="ACTIVE"
        )
        db.add(asset)

    # Automatically generate an actionable incident ticket for the new node
    action_id = f"ACT-{payload.asset_id}-{int(datetime.utcnow().timestamp())}"
    if payload.target_hazard == "WILDFIRE":
        rec_action = f"Deploy Forestry Fire Rangers - Rapid Brush & Thermal Containment ({payload.asset_id})"
        reasoning = f"Thermal anomaly detected at {payload.name} (GPS: {payload.latitude:.4f}, {payload.longitude:.4f}). Vegetative dryness critical."
    elif payload.target_hazard == "STRUCTURAL":
        rec_action = f"Deploy Structural Team - Ultrasonic Vibration & Pier Assessment ({payload.asset_id})"
        reasoning = f"Sensor telemetry triggered structural integrity alert for {payload.name}."
    else:
        rec_action = f"Deploy Flood Barrier Crew - Inundation & Sump Defense ({payload.asset_id})"
        reasoning = f"Hydrological risk surge warning at {payload.name}."

    action_entry = Action(
        action_id=action_id,
        asset_id=payload.asset_id,
        recommended_action=rec_action,
        priority=1 if payload.criticality >= 0.8 else 2,
        priority_score=round(payload.criticality * 92.0, 1),
        target_hazard=payload.target_hazard,
        assigned_team=None,
        target_response_time="15 mins",
        status="PENDING",
        reasoning=reasoning,
        created_at=datetime.utcnow(),
        countdown_seconds=900
    )
    db.add(action_entry)
    db.commit()
    db.refresh(asset)

    # Broadcast updated state to all SSE subscribers immediately
    current_state = build_dashboard_state(db)
    broadcast_dashboard_state(current_state)

    return asset


@app.get(
    "/api/v1/actions",
    response_model=List[ActionOut],
    summary="Active emergency incidents and action dispatch queue"
)
def list_actions(db: Session = Depends(get_db)):
    """Returns all emergency action incidents sorted by priority score."""
    return db.query(Action).order_by(Action.priority_score.desc()).all()


@app.post(
    "/api/v1/actions/{action_id}/assign",
    response_model=ActionOut,
    summary="Dispatch emergency response unit to an incident"
)
def assign_action(action_id: str, payload: Optional[ActionAssignIn] = None, db: Session = Depends(get_db)):
    """
    Assigns an emergency unit, sets buzzer_silenced = True, starts live response countdown,
    decrements available teams count, and broadcasts to dashboard.
    """
    # Look up action by action_id, or by asset_id (e.g. "H01")
    action = db.query(Action).filter(Action.action_id == action_id).first()
    if not action:
        action = db.query(Action).filter(
            Action.asset_id == action_id,
            Action.status != "COMPLETED"
        ).order_by(Action.created_at.desc()).first()

    if not action:
        # Check if action_id is a valid asset and create an incident ticket on-the-fly
        asset = db.query(Asset).filter(Asset.asset_id == action_id).first()
        if asset:
            action = Action(
                action_id=f"ACT-{asset.asset_id}-{int(datetime.utcnow().timestamp())}",
                asset_id=asset.asset_id,
                recommended_action=f"Deploy Emergency Response Team to {asset.name}",
                priority=1 if asset.criticality >= 0.8 else 2,
                priority_score=round(asset.criticality * 92.0, 1),
                target_hazard=asset.target_hazard or "FLOOD",
                status="PENDING",
                buzzer_silenced=False,
                created_at=datetime.utcnow(),
                countdown_seconds=900
            )
            db.add(action)
            db.commit()
            db.refresh(action)
        else:
            raise HTTPException(status_code=404, detail=f"Action or Asset '{action_id}' not found")

    # Determine team to assign
    requested_team_id = payload.team_id if payload else None
    requested_team_name = payload.team_name if payload else None

    team = None
    if requested_team_id or requested_team_name:
        team = db.query(Team).filter(
            (Team.team_id == requested_team_id) |
            (Team.team_name == requested_team_name) |
            (Team.team_name == requested_team_id)
        ).first()

    # If no team specified or requested not available, select next available team
    if not team or team.status != "AVAILABLE":
        team = db.query(Team).filter(Team.status == "AVAILABLE").first()

    if not team:
        raise HTTPException(
            status_code=400,
            detail="No available inspection teams. All 3 municipal teams ('Team Alpha', 'Team Bravo', 'Team Charlie') are currently deployed."
        )

    team_name = team.team_name

    action.assigned_team = team_name
    action.status = "DISPATCHED"
    action.dispatched_at = datetime.utcnow()
    action.buzzer_silenced = True
    action.countdown_seconds = 900  # 15 mins

    # Also silence any other pending/active actions for this asset
    other_actions = db.query(Action).filter(
        Action.asset_id == action.asset_id,
        Action.status != "COMPLETED"
    ).all()
    for other in other_actions:
        other.buzzer_silenced = True

    team.status = "DISPATCHED"
    team.current_assignment = action.action_id

    db.commit()
    db.refresh(action)

    # Broadcast updated dispatch status to all SSE subscribers
    current_state = build_dashboard_state(db)
    broadcast_dashboard_state(current_state)

    return action


@app.post(
    "/api/v1/actions/{action_id}/complete",
    response_model=ActionOut,
    summary="Conclude incident and release municipal unit"
)
def complete_action(action_id: str, db: Session = Depends(get_db)):
    """Marks action completed, releases team back to AVAILABLE status, and broadcasts to dashboard."""
    action = db.query(Action).filter(Action.action_id == action_id).first()
    if not action:
        action = db.query(Action).filter(
            Action.asset_id == action_id,
            Action.status == "DISPATCHED"
        ).order_by(Action.dispatched_at.desc()).first()

    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")

    action.status = "COMPLETED"
    action.completed_at = datetime.utcnow()

    if action.assigned_team:
        team = db.query(Team).filter(
            (Team.team_name == action.assigned_team) |
            (Team.team_id == action.assigned_team) |
            (Team.current_assignment == action.action_id)
        ).first()
        if team:
            team.status = "AVAILABLE"
            team.current_assignment = None

    db.commit()
    db.refresh(action)

    # Broadcast to SSE
    current_state = build_dashboard_state(db)
    broadcast_dashboard_state(current_state)

    return action


@app.get(
    "/api/v1/teams",
    response_model=List[TeamOut],
    summary="Municipal emergency response teams"
)
def list_teams(db: Session = Depends(get_db)):
    """Returns available and dispatched municipal teams."""
    return db.query(Team).all()


@app.post(
    "/api/v1/sensors/readings",
    summary="Compatibility endpoint for edge_simulator.py and firmware (PRD Section 13)"
)
def ingest_readings_alias(raw_payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Alias for /api/v1/sensors/telemetry supporting single-sensor edge simulator format."""
    device_id = raw_payload.get("device_id", "ORACLE-001")
    asset_id = raw_payload.get("asset_id", "B17")
    sensor_id = raw_payload.get("sensor_id", f"SNS-{asset_id}")
    water_level = float(raw_payload.get("water_level_cm", 20.0))
    rise_rate = float(raw_payload.get("water_rise_rate_cm_min", 0.1))

    telemetry = TelemetryPayload(
        device_id=device_id,
        readings=[
            SensorReadingIn(
                sensor_id=sensor_id,
                asset_id=asset_id,
                water_level_cm=water_level,
                rise_rate_cm_min=rise_rate
            )
        ]
    )
    res = ingest_telemetry(telemetry, db)
    state = build_dashboard_state(db)
    target_asset = next((a for a in state.get("assets", []) if a["asset_id"] == asset_id), None)
    
    res_dict = {
        "status": res.status,
        "device_id": device_id,
        "asset_id": asset_id,
        "top_priority": res.top_priority,
        "buzzer": res.buzzer,
        "physical_alert_triggered": res.buzzer,
        "actuators": {k: v.model_dump() if hasattr(v, "model_dump") else v for k, v in res.actuators.items()},
        "risk_score": calculate_risk_score_out_of_100(water_level, rise_rate, target_asset.get("criticality", 0.75) if target_asset else 0.75, res.buzzer, is_full_scale=True),
        "risk_level": target_asset.get("status") if target_asset else "MODERATE",
        "priority_score": target_asset.get("priority_score") if target_asset else 50.0,
        "recommended_action": state.get("recommended_action"),
        "factors": [
            {"factor": "Water Level", "value": f"{water_level:.1f} cm", "impact_pct": 45},
            {"factor": "Rise Rate", "value": f"{rise_rate:.1f} cm/min", "impact_pct": 35},
            {"factor": "Asset Criticality", "value": f"{target_asset.get('criticality', 0.8):.2f}" if target_asset else "0.80", "impact_pct": 20}
        ]
    }
    return res_dict


# ==========================================
# Municipal Scenario Simulation Endpoint (Offline / Standalone Mode)
# ==========================================

class ScenarioIn(BaseModel):
    stage: str = Field(..., description="Stage name: baseline, rain_start, equal_surge, emergency", example="equal_surge")


@app.post(
    "/api/v1/simulate/scenario",
    summary="Dedicated municipal scenario simulation endpoint (Offline / Standalone Mode)"
)
def simulate_scenario(payload: ScenarioIn, db: Session = Depends(get_db)):
    """
    Simulates municipal flood stages without physical hardware:
    - baseline: Normal dry conditions (0.0 cm)
    - rain_start: Moderate rain inflow (1.5 cm)
    - equal_surge: Both assets at 3.5 cm (Triggers Tie-Breaker: H01 ~95 vs B17 ~75)
    - emergency: Critical inundation (H01 4.2 cm / B17 3.8 cm) -> Red alert + Buzzer
    """
    stage = payload.stage.lower().strip()
    is_dispatch_completed = False

    if stage in ["scenario_1_normal", "baseline", "normal", "stage_1", "reset"]:
        edge_ingestion_manager.set_weather_override(rainfall_mm_hr=0.0, condition="Clear / Dry")
        readings = [
            {"sensor_id": "SNS-H01", "asset_id": "H01", "water_level_cm": 0.0, "rise_rate_cm_min": 0.0},
            {"sensor_id": "SNS-B17", "asset_id": "B17", "water_level_cm": 0.0, "rise_rate_cm_min": 0.0}
        ]
        # Reset actions to un-dispatched
        for act in db.query(Action).all():
            act.status = "PENDING"
            act.buzzer_silenced = False
            act.assigned_team = None
        for tm in db.query(Team).all():
            tm.status = "AVAILABLE"
        db.commit()

    elif stage in ["scenario_2_rain", "rain_start", "inflow", "rain", "stage_2"]:
        edge_ingestion_manager.set_weather_override(rainfall_mm_hr=12.0, condition="Heavy Rain")
        readings = [
            {"sensor_id": "SNS-H01", "asset_id": "H01", "water_level_cm": 1.5, "rise_rate_cm_min": 0.3},
            {"sensor_id": "SNS-B17", "asset_id": "B17", "water_level_cm": 1.5, "rise_rate_cm_min": 0.25}
        ]

    elif stage in ["scenario_3_tiebreaker", "equal_surge", "surge", "tie_breaker", "tiebreaker", "stage_3"]:
        edge_ingestion_manager.set_weather_override(rainfall_mm_hr=12.0, condition="Heavy Rain")
        readings = [
            {"sensor_id": "SNS-H01", "asset_id": "H01", "water_level_cm": 3.5, "rise_rate_cm_min": 0.6},
            {"sensor_id": "SNS-B17", "asset_id": "B17", "water_level_cm": 3.5, "rise_rate_cm_min": 0.6}
        ]

    elif stage in ["scenario_4_hospital_critical", "emergency", "critical", "hospital_critical", "stage_4"]:
        edge_ingestion_manager.set_weather_override(rainfall_mm_hr=15.0, condition="Severe Cloudburst")
        readings = [
            {"sensor_id": "SNS-H01", "asset_id": "H01", "water_level_cm": 4.2, "rise_rate_cm_min": 1.1},
            {"sensor_id": "SNS-B17", "asset_id": "B17", "water_level_cm": 3.8, "rise_rate_cm_min": 0.8}
        ]

    elif stage in ["scenario_5_dispatch_completed", "dispatch", "dispatch_completed", "stage_5"]:
        edge_ingestion_manager.set_weather_override(rainfall_mm_hr=12.0, condition="Heavy Rain")
        readings = [
            {"sensor_id": "SNS-H01", "asset_id": "H01", "water_level_cm": 3.5, "rise_rate_cm_min": 0.6},
            {"sensor_id": "SNS-B17", "asset_id": "B17", "water_level_cm": 3.5, "rise_rate_cm_min": 0.6}
        ]
        is_dispatch_completed = True
        act = db.query(Action).filter(Action.asset_id == "H01").first()
        if act:
            act.status = "DISPATCHED"
            act.assigned_team = "Rapid Response Alpha"
            act.buzzer_silenced = True
            act.dispatched_at = datetime.utcnow()
        team_a = db.query(Team).filter(Team.team_id == "TEAM-A").first()
        if team_a:
            team_a.status = "DISPATCHED"
            team_a.current_assignment = "Metro Hospital (H01)"
        db.commit()

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario stage '{stage}'. Choose from: scenario_1_normal, scenario_2_rain, scenario_3_tiebreaker, scenario_4_hospital_critical, scenario_5_dispatch_completed"
        )

    for r in readings:
        scored = municipal_triage_engine.compute_asset_risk(r["asset_id"], r["water_level_cm"], r["rise_rate_cm_min"])
        db_reading = TelemetryReading(
            device_id="SIMULATOR-OFFLINE",
            sensor_id=r["sensor_id"],
            asset_id=r["asset_id"],
            water_level_cm=r["water_level_cm"],
            rise_rate_cm_min=r["rise_rate_cm_min"],
            priority_score=scored["total_risk"],
            status=scored["status"],
            timestamp=datetime.utcnow()
        )
        db.add(db_reading)
    db.commit()

    current_state = build_dashboard_state(db)
    broadcast_dashboard_state(current_state)
    return current_state


# ==========================================
# PRD Section 13: Core Decision API Endpoints
# ==========================================

@app.get(
    "/api/v1/risk",
    summary="Current risk scores across all infrastructure assets (PRD Section 13)"
)
def get_risk_scores(db: Session = Depends(get_db)):
    """Returns current calculated risk scores and contributing factors for all monitored assets."""
    state = build_dashboard_state(db)
    return state.get("assets", [])


@app.get(
    "/api/v1/risk/top",
    summary="Top-ranked priority assets (PRD Section 13)"
)
def get_top_risk_assets(limit: int = 5, db: Session = Depends(get_db)):
    """Returns top-ranked priority assets sorted descending by priority score."""
    state = build_dashboard_state(db)
    assets = state.get("assets", [])
    return assets[:limit]


@app.get(
    "/api/v1/map",
    summary="GIS map layer data in GeoJSON format (PRD Section 13)"
)
def get_map_layer(db: Session = Depends(get_db)):
    """Returns GIS GeoJSON FeatureCollection with spatial locations and risk metrics."""
    state = build_dashboard_state(db)
    features = []
    for asset in state.get("assets", []):
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [asset["longitude"], asset["latitude"]]
            },
            "properties": {
                "asset_id": asset["asset_id"],
                "name": asset["name"],
                "type": asset.get("type"),
                "domain": asset.get("domain"),
                "target_hazard": asset.get("target_hazard"),
                "risk_score": asset.get("risk_score"),
                "priority_score": asset.get("priority_score"),
                "priority_rank": asset.get("priority_rank"),
                "status": asset.get("status"),
                "water_level_cm": asset.get("water_level_cm"),
                "rise_rate_cm_min": asset.get("rise_rate_cm_min"),
                "criticality": asset.get("criticality"),
                "population_served": asset.get("population_served"),
                "shap_breakdown": asset.get("shap_breakdown")
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features
    }


@app.get(
    "/api/v1/recommendations",
    summary="Recommended operational actions & dispatch queue (PRD Section 13)"
)
def get_recommendations(db: Session = Depends(get_db)):
    """Returns recommended interventions and active action dispatch queue."""
    state = build_dashboard_state(db)
    actions = db.query(Action).order_by(Action.priority_score.desc()).all()
    actions_out = [
        ActionOut(
            action_id=act.action_id,
            asset_id=act.asset_id,
            action_type=act.action_type or "DEPLOY_CREW",
            recommended_action=act.recommended_action,
            priority=act.priority,
            priority_score=act.priority_score,
            target_hazard=act.target_hazard or "FLOOD",
            assigned_team=act.assigned_team,
            target_response_time=act.target_response_time or "15 mins",
            status=act.status,
            buzzer_silenced=act.buzzer_silenced or False,
            reasoning=act.reasoning,
            created_at=act.created_at,
            dispatched_at=act.dispatched_at,
            completed_at=act.completed_at,
            countdown_seconds=act.countdown_seconds or 900
        ) for act in actions
    ]
    return {
        "top_priority": state.get("top_priority"),
        "recommended_action": state.get("recommended_action"),
        "action_level": state.get("action_level"),
        "actions": actions_out
    }


@app.get(
    "/api/v1/analytics",
    summary="System and historical analytics (PRD Section 13)"
)
def get_analytics(db: Session = Depends(get_db)):
    """Returns operational analytics and system counters."""
    state = build_dashboard_state(db)
    assets = state.get("assets", [])
    total_assets = len(assets)
    critical_assets = sum(1 for a in assets if a.get("status") == "CRITICAL")
    high_assets = sum(1 for a in assets if a.get("risk_score", 0) >= 60 and a.get("status") != "CRITICAL")
    total_telemetry_count = db.query(TelemetryReading).count()
    actions_count = db.query(Action).count()
    completed_actions = db.query(Action).filter(Action.status == "COMPLETED").count()

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_assets": total_assets,
        "critical_assets": critical_assets,
        "high_risk_assets": high_assets,
        "available_teams": state.get("available_teams_count", 3),
        "total_teams": state.get("total_teams_count", 3),
        "total_telemetry_readings": total_telemetry_count,
        "total_actions": actions_count,
        "completed_actions": completed_actions,
        "buzzer_active": state.get("buzzer", False),
        "buzzer_silenced": state.get("buzzer_silenced", False)
    }



if __name__ == "__main__":
    import uvicorn
    init_db()
    print("Starting ORACLE Edge Backend on http://0.0.0.0:8000 ...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

