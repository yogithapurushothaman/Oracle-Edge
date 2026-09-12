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
        Action, Team, TelemetryPayload, TelemetryResponse, ActuatorState,
        AssetRegisterIn, AssetOut, ActionAssignIn, ActionOut, TeamOut, TelemetryReadingOut
    )
    from backend.services.decision_engine import decision_engine
    from backend.services.weather_service import weather_service
except ImportError:
    from models import (
        init_db, get_db, SessionLocal, Asset, TelemetryReading,
        Action, Team, TelemetryPayload, TelemetryResponse, ActuatorState,
        AssetRegisterIn, AssetOut, ActionAssignIn, ActionOut, TeamOut, TelemetryReadingOut
    )
    from services.decision_engine import decision_engine
    from services.weather_service import weather_service


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

def calculate_risk_score_out_of_100(water_level_cm: float, rise_rate_cm_min: float, criticality: float, is_critical: bool) -> float:
    """Calculates an intuitive 0-100 risk score aligned with critical thresholds."""
    if is_critical:
        # 80 - 99 scale for Critical events
        base = 82.0 + (water_level_cm - 18.0) * 1.5 + (rise_rate_cm_min * 4.0) + (criticality * 6.0)
        return min(99.0, max(82.0, round(base, 1)))
    elif water_level_cm >= 12.0 or rise_rate_cm_min >= 0.5:
        # 45 - 79 scale for Moderate events
        base = 45.0 + (water_level_cm - 12.0) * 3.5 + (rise_rate_cm_min * 15.0) + (criticality * 10.0)
        return min(79.0, max(45.0, round(base, 1)))
    else:
        # 5 - 44 scale for Safe baseline
        base = (water_level_cm / 12.0) * 30.0 + (rise_rate_cm_min * 10.0) + (criticality * 5.0)
        return min(44.0, max(5.0, round(base, 1)))


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
            # FLOOD (Default)
            latest = db.query(TelemetryReading).filter(
                TelemetryReading.asset_id == asset.asset_id
            ).order_by(TelemetryReading.id.desc()).first()

            if latest:
                water_level = latest.water_level_cm
                rise_rate = latest.rise_rate_cm_min
                priority_score = latest.priority_score
                status_str = latest.status
                timestamp = latest.timestamp.isoformat()
                is_critical = (status_str == "CRITICAL")
            else:
                water_level = 8.5 if asset.asset_id == "H01" else 6.2
                rise_rate = 0.1 if asset.asset_id == "H01" else 0.05
                criticality = asset.criticality or 0.75
                priority_score = (water_level * 0.4) + (rise_rate * 0.2) + (criticality * 40.0)
                is_critical = False
                status_str = "SAFE"
                timestamp = datetime.utcnow().isoformat()

            risk_score = calculate_risk_score_out_of_100(water_level, rise_rate, asset.criticality, is_critical)
            shap_factors = {
                "Water Level Impact": 40.0,
                "Rapid Rise Rate": 35.0,
                "Facility Vulnerability": 25.0
            }
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

    top_priority_asset = asset_data_list[0] if asset_data_list else None
    top_priority_id = top_priority_asset["asset_id"] if top_priority_asset else "H01"

    # Formulate Recommended Action
    h01_item = next((a for a in asset_data_list if a["asset_id"] == "H01"), None)
    b17_item = next((a for a in asset_data_list if a["asset_id"] == "B17"), None)

    h01_crit = h01_item and h01_item["status"] == "CRITICAL"
    b17_crit = b17_item and b17_item["status"] == "CRITICAL"

    if h01_crit and b17_crit:
        recommended_action = f"DUAL CRISIS: Deploy Emergency Team to Metro Hospital ({top_priority_id}) & Alert Bridge Operations"
        action_level = "CRITICAL"
    elif h01_crit:
        recommended_action = "Deploy Emergency Team to Hospital (H01)"
        action_level = "CRITICAL"
    elif b17_crit:
        recommended_action = "Immediate Bridge Deck Closure & Inspection Team Dispatch (B17)"
        action_level = "CRITICAL"
    elif any(a["risk_score"] >= 45.0 for a in asset_data_list):
        recommended_action = "Elevated Alert: Monitor Drainage Inlets & Standby Rapid Response Unit"
        action_level = "MODERATE"
    else:
        recommended_action = "Routine Monitoring: All flood barriers & drainage baseline nominal."
        action_level = "SAFE"

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
                assigned_team="Team Alpha - Flood Barrier Crew",
                target_response_time="10 mins",
                status="DISPATCHED",
                reasoning="Water level surge near ICU basement inlet.",
                created_at=datetime.utcnow(),
                dispatched_at=datetime.utcnow(),
                countdown_seconds=780
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
                reasoning="Hydrodynamic current rise on Adyar causeway.",
                created_at=datetime.utcnow(),
                countdown_seconds=1200
            )
        ]
        db.add_all(baseline_actions)
        db.commit()
        actions_in_db = db.query(Action).all()

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

    return {
        "status": "OPERATIONAL",
        "timestamp": datetime.utcnow().isoformat(),
        "device_id": "ORACLE-ESP32-01",
        "top_priority": top_priority_id,
        "buzzer": any_critical,
        "action_level": action_level,
        "recommended_action": recommended_action,
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
    any_critical = False

    for reading in payload.readings:
        # 1. Fetch asset criticality from database
        asset = db.query(Asset).filter(Asset.asset_id == reading.asset_id).first()
        criticality = asset.criticality if asset else 0.5

        # 3. Critical threshold evaluation
        is_critical = (reading.water_level_cm >= 18.0) or (reading.rise_rate_cm_min >= 1.0)
        status_str = "CRITICAL" if is_critical else "SAFE"
        if is_critical:
            any_critical = True

        # 2. Priority Logic aligned with MultiHazard Decision Engine
        if is_critical:
            priority_score = min(99.0, max(82.0, 75.0 + (reading.water_level_cm * 0.5) + (criticality * 15.0)))
        elif reading.water_level_cm >= 12.0 or reading.rise_rate_cm_min >= 0.5:
            priority_score = min(79.0, max(45.0, 35.0 + (reading.water_level_cm * 1.5) + (criticality * 20.0)))
        else:
            priority_score = (reading.water_level_cm * 0.4) + (reading.rise_rate_cm_min * 0.2) + (criticality * 40.0)
        priority_scores[reading.asset_id] = priority_score


        # 4. Actuator states
        actuators[reading.asset_id] = ActuatorState(
            status=status_str,
            led_safe=not is_critical,
            led_critical=is_critical
        )

        # 5. Persist telemetry reading to SQLite
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

    db.commit()

    top_priority = max(priority_scores.items(), key=lambda x: x[1])[0]
    buzzer = any_critical

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
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection alive
                    yield ": ping\n\n"
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
def assign_action(action_id: str, payload: ActionAssignIn, db: Session = Depends(get_db)):
    """Assigns an emergency unit, starts the live response countdown, and broadcasts to dashboard."""
    action = db.query(Action).filter(Action.action_id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")

    team = db.query(Team).filter(Team.team_id == payload.team_id).first()
    team_name = team.team_name if team else payload.team_id

    action.assigned_team = team_name
    action.status = "DISPATCHED"
    action.dispatched_at = datetime.utcnow()
    action.countdown_seconds = 900  # 15 mins

    if team:
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
    """Marks action completed and returns team to available status."""
    action = db.query(Action).filter(Action.action_id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")

    action.status = "COMPLETED"
    action.completed_at = datetime.utcnow()

    if action.assigned_team:
        team = db.query(Team).filter(Team.team_name == action.assigned_team).first()
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
    summary="Compatibility endpoint for edge_simulator.py and firmware"
)
def ingest_readings_alias(raw_payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Alias for /api/v1/sensors/telemetry supporting single-sensor edge simulator format."""
    device_id = raw_payload.get("device_id", "ORACLE-001")
    water_level = float(raw_payload.get("water_level_cm", 20.0))
    rise_rate = float(raw_payload.get("water_rise_rate_cm_min", 0.1))

    telemetry = TelemetryPayload(
        device_id=device_id,
        readings=[
            SensorReadingIn(
                sensor_id="SNS-B17",
                asset_id="B17",
                water_level_cm=water_level,
                rise_rate_cm_min=rise_rate
            )
        ]
    )
    return ingest_telemetry(telemetry, db)


if __name__ == "__main__":
    import uvicorn
    init_db()
    print("Starting ORACLE Edge Backend on http://0.0.0.0:8000 ...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

