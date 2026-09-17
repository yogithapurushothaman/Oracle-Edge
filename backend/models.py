"""
ORACLE Edge - Core Models & Database Configuration
SQLAlchemy ORM Models & Pydantic Validation Schemas for Step 1
"""

import os
from datetime import datetime
from typing import List, Dict, Optional, Literal
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel, Field

# SQLite Database Setup
DB_PATH = os.path.join(os.path.dirname(__file__), "oracle_edge.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ==========================================
# SQLAlchemy ORM Models
# ==========================================

class Asset(Base):
    __tablename__ = "assets"

    asset_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    asset_type = Column(String, default="Infrastructure", nullable=True)
    latitude = Column(Float, default=13.0405, nullable=True)
    longitude = Column(Float, default=80.2450, nullable=True)
    criticality = Column(Float, nullable=False)
    population_served = Column(Integer, nullable=False, default=0)
    nearest_hospital = Column(String, default="YES", nullable=True)
    historical_risk = Column(String, default="MODERATE", nullable=True)
    elevation = Column(Float, default=10.0, nullable=True)
    slope = Column(Float, default=2.0, nullable=True)
    distance_to_water = Column(Float, default=50.0, nullable=True)
    domain = Column(String, default="URBAN_INFRASTRUCTURE", nullable=True)
    target_hazard = Column(String, default="FLOOD", nullable=True)
    status = Column(String, default="ACTIVE", nullable=True)

    @property
    def population(self) -> int:
        return self.population_served

    @population.setter
    def population(self, val: int):
        self.population_served = val


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    device_id = Column(String, index=True, nullable=False)
    sensor_id = Column(String, nullable=False)
    asset_id = Column(String, ForeignKey("assets.asset_id"), index=True, nullable=False)
    water_level_cm = Column(Float, nullable=False)
    rise_rate_cm_min = Column(Float, nullable=False)
    priority_score = Column(Float, nullable=False)
    status = Column(String, nullable=False)  # "CRITICAL" | "SAFE"
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class Action(Base):
    __tablename__ = "actions"

    action_id = Column(String, primary_key=True, index=True)
    asset_id = Column(String, ForeignKey("assets.asset_id"), index=True, nullable=False)
    action_type = Column(String, default="DEPLOY_CREW", nullable=False)
    recommended_action = Column(String, nullable=False)
    priority = Column(Integer, default=1)
    priority_score = Column(Float, default=50.0)
    target_hazard = Column(String, default="FLOOD")
    assigned_team = Column(String, nullable=True)
    target_response_time = Column(String, default="15 mins")
    status = Column(String, default="PENDING")  # "PENDING" | "DISPATCHED" | "COMPLETED"
    buzzer_silenced = Column(Boolean, default=False)
    reasoning = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    dispatched_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    countdown_seconds = Column(Integer, default=900)

    @property
    def id(self) -> str:
        return self.action_id


class Team(Base):
    __tablename__ = "teams"

    team_id = Column(String, primary_key=True, index=True)
    team_name = Column(String, nullable=False)
    specialty = Column(String, nullable=False)
    hazard_domain = Column(String, default="FLOOD")
    status = Column(String, default="AVAILABLE")  # "AVAILABLE" | "DISPATCHED"
    current_assignment = Column(String, nullable=True)


class Device(Base):
    __tablename__ = "devices"

    device_id = Column(String, primary_key=True, index=True)
    device_name = Column(String, default="ORACLE Edge ESP32 Node", nullable=True)
    status = Column(String, default="ONLINE")  # "ONLINE" | "OFFLINE"
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=False)

    def is_online(self) -> bool:
        if not self.last_seen:
            return False
        return (datetime.utcnow() - self.last_seen).total_seconds() <= 8.0

    def last_seen_seconds(self) -> int:
        if not self.last_seen:
            return 999999
        return max(0, int((datetime.utcnow() - self.last_seen).total_seconds()))

    def get_status(self) -> str:
        return "ONLINE" if self.is_online() else "OFFLINE"


# ==========================================
# Pydantic Schemas (Request / Response)
# ==========================================

class SensorReadingIn(BaseModel):
    sensor_id: str = Field(..., description="Unique identifier of sensor", example="SNS-H01")
    asset_id: str = Field(..., description="Target asset ID", example="H01")
    water_level_cm: float = Field(..., description="Current water level in centimeters", example=19.5)
    rise_rate_cm_min: float = Field(..., description="Water rise rate in cm per minute", example=0.8)


class TelemetryPayload(BaseModel):
    device_id: str = Field(..., description="Hardware device identifier", example="ORACLE-ESP32-01")
    readings: List[SensorReadingIn] = Field(..., description="List of sensor measurements")


class ActuatorState(BaseModel):
    status: str = Field("SAFE", description="Asset alert status (CRITICAL, HIGH, MODERATE, SAFE)")
    led_safe: bool = Field(..., description="Green safe LED control signal")
    led_critical: bool = Field(..., description="Red critical LED control signal")


class TelemetryResponse(BaseModel):
    status: str = Field("success", example="success")
    top_priority: Optional[str] = Field(None, description="Asset ID with highest priority score", example="H01")
    buzzer: bool = Field(..., description="Hardware buzzer trigger signal", example=True)
    actuators: Dict[str, ActuatorState] = Field(..., description="Actuator instructions per asset")


class AssetRegisterIn(BaseModel):
    asset_id: str = Field(..., description="Asset identifier, e.g. F09", example="F09")
    name: str = Field(..., description="Full Asset Name", example="Vandalur Reserve Forest")
    domain: str = Field("FORESTRY", description="URBAN_INFRASTRUCTURE, FORESTRY, or INDUSTRIAL")
    asset_type: str = Field("Forest_Reserve", description="Hospital, Bridge, Forest_Reserve, Substation")
    target_hazard: str = Field("WILDFIRE", description="FLOOD, WILDFIRE, or STRUCTURAL")
    latitude: float = Field(..., description="Latitude coordinate", example=12.8797)
    longitude: float = Field(..., description="Longitude coordinate", example=80.0815)
    criticality: float = Field(..., ge=0.0, le=1.0, description="Criticality index between 0.0 and 1.0", example=0.82)
    population_impact: int = Field(..., ge=0, description="Population impact count", example=32000)


class AssetOut(BaseModel):
    asset_id: str
    name: str
    asset_type: Optional[str] = "Infrastructure"
    domain: Optional[str] = "URBAN_INFRASTRUCTURE"
    target_hazard: Optional[str] = "FLOOD"
    latitude: Optional[float] = 13.0405
    longitude: Optional[float] = 80.2450
    criticality: float
    population_served: int
    status: Optional[str] = "ACTIVE"

    class Config:
        from_attributes = True


class ActionAssignIn(BaseModel):
    team_id: Optional[str] = Field(None, description="Team ID to assign, e.g. TEAM-ALPHA", example="TEAM-ALPHA")
    team_name: Optional[str] = Field(None, description="Team name to assign, e.g. Team Alpha", example="Team Alpha")


class ActionOut(BaseModel):
    action_id: str
    asset_id: str
    action_type: Optional[str] = "DEPLOY_CREW"
    recommended_action: str
    priority: int
    priority_score: float
    target_hazard: Optional[str] = "FLOOD"
    assigned_team: Optional[str] = None
    target_response_time: str
    status: str
    buzzer_silenced: bool = False
    reasoning: Optional[str] = None
    created_at: datetime
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    countdown_seconds: int

    class Config:
        from_attributes = True


class TeamOut(BaseModel):
    team_id: str
    team_name: str
    specialty: str
    hazard_domain: str
    status: str
    current_assignment: Optional[str] = None

    class Config:
        from_attributes = True


class TelemetryReadingOut(BaseModel):
    id: int
    device_id: str
    sensor_id: str
    asset_id: str
    water_level_cm: float
    rise_rate_cm_min: float
    priority_score: float
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ==========================================
# Helper & Dependency Functions
# ==========================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they do not exist, run column migrations, and seed default assets and teams."""
    from sqlalchemy import text
    with engine.connect() as conn:
        for col_stmt in [
            "ALTER TABLE assets ADD COLUMN domain VARCHAR DEFAULT 'URBAN_INFRASTRUCTURE'",
            "ALTER TABLE assets ADD COLUMN target_hazard VARCHAR DEFAULT 'FLOOD'",
            "ALTER TABLE teams ADD COLUMN hazard_domain VARCHAR DEFAULT 'FLOOD'",
            "ALTER TABLE actions ADD COLUMN action_type VARCHAR DEFAULT 'DEPLOY_CREW'",
            "ALTER TABLE actions ADD COLUMN target_hazard VARCHAR DEFAULT 'FLOOD'",
            "ALTER TABLE actions ADD COLUMN countdown_seconds INTEGER DEFAULT 900",
            "ALTER TABLE actions ADD COLUMN dispatched_at TIMESTAMP",
            "ALTER TABLE actions ADD COLUMN priority_score FLOAT DEFAULT 50.0",
            "ALTER TABLE actions ADD COLUMN buzzer_silenced BOOLEAN DEFAULT 0",
        ]:
            try:
                conn.execute(text(col_stmt))
                conn.commit()
            except Exception:
                pass

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_assets(db)
        seed_teams(db)
        seed_devices(db)



def seed_assets(db: Session):
    """
    Seed full reference infrastructure network:
    - H01: Metro Hospital (Physical Node 1)
    - B17: Bridge B17 (Physical Node 2)
    - D03: Drain D03 (Velachery Canal Outlet)
    - R08: Road R08 (GST Arterial Underpass)
    - B21: Bridge B21 (Kotturpuram Bridge)
    - D07: Drain D07 (Adyar Sluice Channel)
    - S05: School S05 (St. Mary's School)
    """
    initial_assets = [
        {
            "asset_id": "H01",
            "name": "Metro Hospital",
            "criticality": 0.95,
            "population_served": 45000,
            "asset_type": "Hospital",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 13.0405,
            "longitude": 80.2450,
            "status": "ACTIVE"
        },
        {
            "asset_id": "B17",
            "name": "Bridge B17",
            "criticality": 0.95,
            "population_served": 12000,
            "asset_type": "Bridge",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 13.0827,
            "longitude": 80.2707,
            "status": "ACTIVE"
        },
        {
            "asset_id": "D03",
            "name": "Drain D03",
            "criticality": 0.85,
            "population_served": 8500,
            "asset_type": "Drain",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 12.9815,
            "longitude": 80.2180,
            "status": "ACTIVE"
        },
        {
            "asset_id": "R08",
            "name": "Road R08",
            "criticality": 0.75,
            "population_served": 25000,
            "asset_type": "Road",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 13.0102,
            "longitude": 80.2158,
            "status": "ACTIVE"
        },
        {
            "asset_id": "B21",
            "name": "Bridge B21",
            "criticality": 0.65,
            "population_served": 18000,
            "asset_type": "Bridge",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 13.0210,
            "longitude": 80.2410,
            "status": "ACTIVE"
        },
        {
            "asset_id": "D07",
            "name": "Drain D07",
            "criticality": 0.55,
            "population_served": 6000,
            "asset_type": "Drain",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 13.0080,
            "longitude": 80.2520,
            "status": "ACTIVE"
        },
        {
            "asset_id": "S05",
            "name": "School S05",
            "criticality": 0.40,
            "population_served": 4000,
            "asset_type": "School",
            "domain": "URBAN_INFRASTRUCTURE",
            "target_hazard": "FLOOD",
            "latitude": 13.0320,
            "longitude": 80.2310,
            "status": "ACTIVE"
        }
    ]

    for item in initial_assets:
        asset = db.query(Asset).filter(Asset.asset_id == item["asset_id"]).first()
        if not asset:
            asset = Asset(**item)
            db.add(asset)
        else:
            asset.name = item["name"]
            asset.criticality = item["criticality"]
            asset.population_served = item["population_served"]
            asset.asset_type = item["asset_type"]
            asset.domain = item.get("domain", "URBAN_INFRASTRUCTURE")
            asset.target_hazard = item.get("target_hazard", "FLOOD")
            asset.latitude = item.get("latitude")
            asset.longitude = item.get("longitude")
    db.commit()


def seed_teams(db: Session):
    """
    Seed municipal response teams per official command-center UI:
    - TEAM-A: Team A -> Hospital H01 (or Bridge B17) (High Priority)
    - TEAM-B: Team B -> Drain D03 (High Priority)
    - TEAM-C: Team C -> Road R08 (Medium Priority)
    """
    initial_teams = [
        {
            "team_id": "TEAM-A",
            "team_name": "Team A",
            "specialty": "Rapid Response & ICU Protection",
            "hazard_domain": "FLOOD",
            "status": "DISPATCHED",
            "current_assignment": "Hospital H01"
        },
        {
            "team_id": "TEAM-B",
            "team_name": "Team B",
            "specialty": "Canal Desiltation & Flow Defense",
            "hazard_domain": "FLOOD",
            "status": "DISPATCHED",
            "current_assignment": "Drain D03"
        },
        {
            "team_id": "TEAM-C",
            "team_name": "Team C",
            "specialty": "Arterial Road Diversion & Traffic Patrol",
            "hazard_domain": "FLOOD",
            "status": "AVAILABLE",
            "current_assignment": "Road R08"
        }
    ]

    for item in initial_teams:
        team = db.query(Team).filter(Team.team_id == item["team_id"]).first()
        if not team:
            team = Team(**item)
            db.add(team)
        else:
            team.team_name = item["team_name"]
            team.specialty = item["specialty"]
            team.hazard_domain = item["hazard_domain"]
            team.current_assignment = item["current_assignment"]
    db.commit()


def seed_devices(db: Session):
    """
    Seed tabletop ESP32 hardware device node:
    - ORACLE-ESP32-01: ESP32 Hardware Node
    """
    default_device_id = "ORACLE-ESP32-01"
    dev = db.query(Device).filter(Device.device_id == default_device_id).first()
    if not dev:
        dev = Device(
            device_id=default_device_id,
            device_name="ESP32 Tabletop Hardware Node (Dual HC-SR04 & MPU6050)",
            status="ONLINE",
            last_seen=datetime.utcnow()
        )
        db.add(dev)
        db.commit()
