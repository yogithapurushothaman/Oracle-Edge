"""
ORACLE Edge - SQLite Database & Schema Manager
Implements PRD Section 12 Data Model:
- assets
- sensors
- sensor_readings
- risk_scores
- actions
- teams
"""

import sqlite3
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "oracle_edge.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Assets table (PRD 12.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        asset_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        criticality REAL NOT NULL,
        population_served INTEGER NOT NULL,
        nearest_hospital TEXT NOT NULL,
        historical_risk TEXT NOT NULL,
        elevation REAL NOT NULL,
        slope REAL NOT NULL,
        distance_to_water REAL NOT NULL,
        status TEXT DEFAULT 'ACTIVE'
    );
    """)

    # 2. Sensors table (PRD 12.2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sensors (
        sensor_id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        sensor_type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        installation_date TEXT,
        status TEXT DEFAULT 'ONLINE',
        FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
    );
    """)

    # 3. Sensor readings table (PRD 12.3)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sensor_readings (
        reading_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        water_level REAL NOT NULL,
        water_rise_rate REAL NOT NULL,
        rainfall_1h REAL DEFAULT 0.0,
        rainfall_3h REAL DEFAULT 0.0,
        rainfall_24h REAL DEFAULT 0.0,
        rain_detected INTEGER DEFAULT 0,
        battery_voltage REAL DEFAULT 4.1,
        FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
    );
    """)

    # 4. Risk scores table (PRD 12.4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS risk_scores (
        risk_id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        hazard_score REAL NOT NULL,
        exposure_score REAL NOT NULL,
        vulnerability_score REAL NOT NULL,
        risk_score REAL NOT NULL,
        priority_score REAL NOT NULL,
        risk_level TEXT NOT NULL,
        model_version TEXT NOT NULL,
        factors_json TEXT,
        FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
    );
    """)

    # 5. Teams table (PRD 9.3 & 12)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS teams (
        team_id TEXT PRIMARY KEY,
        team_name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        status TEXT DEFAULT 'AVAILABLE',
        current_assignment TEXT
    );
    """)

    # 6. Actions table (PRD 9 & 12.5)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS actions (
        action_id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        risk_id INTEGER,
        recommended_action TEXT NOT NULL,
        priority INTEGER NOT NULL,
        assigned_team TEXT,
        target_response_time TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        reasoning TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
    );
    """)

    conn.commit()

    # Seed initial assets if empty
    cursor.execute("SELECT COUNT(*) FROM assets")
    if cursor.fetchone()[0] == 0:
        seed_data(cursor, conn)

    conn.close()

def seed_data(cursor: sqlite3.Cursor, conn: sqlite3.Connection):
    """Seeds baseline infrastructure assets, sensors, and teams per PRD."""
    assets = [
        ("B17", "Bridge B17 (Kadal Causeway)", "Bridge", 13.0827, 80.2707, 0.95, 12000, "YES", "HIGH", 12.0, 3.0, 15.0, "ACTIVE"),
        ("D03", "Drain D03 (Velachery Canal Outlet)", "Drain", 12.9815, 80.2180, 0.85, 8500, "NO", "CRITICAL", 8.5, 1.5, 5.0, "ACTIVE"),
        ("R08", "Road R08 (GST Arterial Underpass)", "Road", 13.0102, 80.2158, 0.75, 25000, "YES", "HIGH", 9.0, 2.0, 45.0, "ACTIVE"),
        ("H02", "Hospital Access Corridor H02", "Facility", 13.0405, 80.2450, 0.98, 45000, "YES", "MODERATE", 14.0, 4.0, 95.0, "ACTIVE"),
        ("S05", "School Basin Zone S05", "School", 12.9750, 80.2210, 0.80, 4200, "NO", "MODERATE", 7.0, 1.0, 35.0, "ACTIVE")
    ]
    cursor.executemany("""
        INSERT INTO assets (asset_id, name, asset_type, latitude, longitude, criticality, population_served, nearest_hospital, historical_risk, elevation, slope, distance_to_water, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, assets)

    sensors = [
        ("SEN-B17", "B17", "ORACLE-001", "Ultrasonic+Rain", 13.0827, 80.2707, "2026-08-01", "ONLINE"),
        ("SEN-D03", "D03", "ORACLE-002", "Ultrasonic Water Flow", 12.9815, 80.2180, "2026-08-05", "ONLINE"),
        ("SEN-R08", "R08", "ORACLE-003", "Submergence Detector", 13.0102, 80.2158, "2026-08-10", "ONLINE"),
        ("SEN-H02", "H02", "ORACLE-004", "Optical Stream Sensor", 13.0405, 80.2450, "2026-08-12", "ONLINE"),
        ("SEN-S05", "S05", "ORACLE-005", "Ultrasonic Water Level", 12.9750, 80.2210, "2026-08-15", "ONLINE")
    ]
    cursor.executemany("""
        INSERT INTO sensors (sensor_id, asset_id, device_id, sensor_type, latitude, longitude, installation_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, sensors)

    teams = [
        ("TEAM-A", "Team Alpha (Bridge Inspection)", "Structural & Bridge Assessment", "AVAILABLE", None),
        ("TEAM-B", "Team Bravo (Rapid Drainage)", "High-Capacity Pump Maintenance", "AVAILABLE", None),
        ("TEAM-C", "Team Charlie (Traffic & Emergency)", "Arterial Diversion & Evacuation", "AVAILABLE", None)
    ]
    cursor.executemany("""
        INSERT INTO teams (team_id, team_name, specialty, status, current_assignment)
        VALUES (?, ?, ?, ?, ?)
    """, teams)

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized and seeded successfully.")
