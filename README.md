# ORACLE Edge 🛰️⚡🌊
### Space-to-Ground Infrastructure Decision Intelligence Platform

> **"Prediction is an input, not the product."**
> A decision-support and action-prioritization system that fuses satellite observations (Sentinel-2 MSI), weather forecasts (Open-Meteo), GIS infrastructure criticality, and real-time edge IoT sensing (ESP32) to rank vulnerable infrastructure by urgency and recommend operational interventions for resource-constrained municipal teams.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Space & Ground Sensing
        S2[Sentinel-2 Optical MSI L2A<br/>NDWI Anomaly Delta] --> APISync[Resilient Circuit Breaker<br/>2.0s Strict Timeout]
        OM[Open-Meteo ERA5 Reanalysis<br/>Precipitation, Temp, Wind] --> APISync
        ESP[ESP32 Hardware Tabletop Node<br/>Dual Ultrasonic HC-SR04 & MPU6050] -->|HTTP POST / Telemetry| FastAPIIngest[FastAPI Telemetry Ingestion<br/>/api/v1/sensors/telemetry]
    end

    subgraph Intelligence & Priority Core
        APISync --> FastAPIIngest
        FastAPIIngest --> Watchdog[Hardware Watchdog<br/>8.0s Timeout Boundary]
        FastAPIIngest --> Fusion[Multi-Hazard Decision Engine<br/>Flood • Wildfire • Structural]
        Fusion --> ML[XGBoost & SHAP Inference<br/>Risk 0-100 & Priority 0-100]
        ML --> ActionEngine[Closed-Loop Action Engine<br/>3 Municipal Teams Pool]
    end

    subgraph Actuation & Spatial Command
        ActionEngine -->|SSE Stream /api/v1/stream| Dashboard[Next.js GIS Command Center<br/>Dual Monitoring • SHAP • Action Queue]
        ActionEngine -->|Actuator Signals| ESP
        Dashboard -->|POST /api/v1/actions/assign| ActionEngine
        Note[Operator Dispatches Team<br/>Buzzer Silenced | Warning LED Remains Lit]
    end
```

---

## 🌟 Core System Highlights

1. **Multi-Hazard Decision Engine**:
   - **Flood**: Sensor water level & rise rate, rolling rainfall (1h, 3h, 24h), Sentinel-2 NDWI anomaly delta.
   - **Wildfire**: Real-time Open-Meteo ambient temperature, low relative humidity, wind velocity, and vegetative fuel dry indices.
   - **Structural**: Ultrasonic tilt degrees, vibration acceleration ($g$), and river pier scour risk.

2. **Explainable AI & ML Benchmark**:
   - Primary: **XGBoost Classifier & Regressor** ($R^2 = 0.965$, ROC-AUC = $0.981$, **100% Priority Agreement** with Spearman $\rho = 1.000$).
   - Baselines: Logistic Regression & Random Forest comparison.
   - Real-time **SHAP factor attribution** answering *"Why this risk?"*.

3. **Closed-Loop Action Engine with Buzzer Silence**:
   - 3 Municipal Response Units (`Team Alpha`, `Team Bravo`, `Team Charlie`).
   - Incident assignment (`POST /api/v1/actions/{id}/assign`) immediately acknowledges the emergency and silences the 2.4kHz hardware buzzer while keeping the red critical warning LED illuminated on the physical asset.
   - Incident completion (`POST /api/v1/actions/{id}/complete`) returns teams to `AVAILABLE` status.

4. **Hardware Node Watchdog**:
   - Hardware ping monitored against an **8.0-second threshold boundary**.
   - Node status dynamically toggles between `ONLINE` and `OFFLINE/RECONNECTING`.
   - Heartbeat updates broadcast across SSE stream every 2 seconds.

5. **External API Circuit Breakers**:
   - Open-Meteo & Sentinel-2 queries run with **strict 2.0-second timeouts**.
   - In-memory fallback caching serves last-known valid observations or nominal defaults (`rainfall_1h: 4.2mm`, `ndwi_delta: 0.12`).
   - Telemetry ingestion is immune to external network hanging or cloud API outages.

6. **Interactive Next.js Command Center**:
   - Real-time Server-Sent Events (SSE) live grid ingestion.
   - Dual Monitoring Cards comparing Tabletop Physical Node (`Bridge B17`) against Urban Facility (`Metro Hospital H01`).
   - Interactive GIS Map with color-coded risk markers.
   - Evaluator Demo Bar triggering PRD Steps 1–4, Wildfire incident, and External API outage simulation.
   - Dark and Light mode toggle with sleek glassmorphism aesthetic.

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup & Run
```bash
# From repository root
pip install fastapi uvicorn sqlalchemy pydantic httpx scikit-learn xgboost pandas numpy scipy

# Launch FastAPI Server
python main.py
# Server runs on http://127.0.0.1:8000 (Swagger docs at /docs)
```

### 2. Frontend Setup & Run
```bash
# Navigate to Next.js app
cd my-app
npm install

# Launch Next.js Development Server
npm run dev
# Command Center runs on http://localhost:3000
```

### 3. Edge Simulator / Demonstration
```bash
# Run PRD Steps 1 through 4 demonstration simulation
python edge/test_edge_simulator.py

# Or run the mock ESP32 hardware client
python test_mock_esp32.py
```

---

## 🧪 Comprehensive Test Suite

All tests can be executed locally:

| Test Suite | Purpose | Execution Command |
| :--- | :--- | :--- |
| **All Backend Unit & Integration Tests** | Full pytest regression suite | `python -m pytest backend/ -v` |
| **Closed-Loop Action Engine** | Team dispatch, buzzer silence, and team release | `python backend/test_action_engine.py` |
| **Circuit Breakers & API Fallbacks** | 2.0s timeouts, in-memory caching, ingestion immunity | `python backend/test_circuit_breakers.py` |
| **Hardware Node Watchdog** | 8.0s timeout boundary, heartbeat SSE broadcast | `python backend/test_watchdog.py` |
| **Multi-Hazard & Dynamic Nodes** | Flood, Wildfire, Structural scoring, dynamic registration | `python backend/test_step4_multihazard.py` |
| **ESP32 Edge Simulator** | PRD demonstration scenarios 1 through 4 | `python edge/test_edge_simulator.py` |
| **Next.js Production Build** | TypeScript validation and Turbopack bundle | `cd my-app && npm run build` |

---

## 📋 PRD Tabletop Demonstration Scenario

| Step | Scenario Condition | Water Level | Risk Score | Status | Physical Actuators & Operational Response |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | Normal Baseline | 20.0 cm | 24 / 100 | `SAFE` | Green Safe LED `[ON]`, Red Critical LED `[OFF]`, Buzzer `[SILENT]` |
| **2** | Rising Water | 40.0 cm | 48 / 100 | `MODERATE` | Green Safe LED `[ON]`, Increased sensor polling rate |
| **3** | Rapid Rise Flash Flood | 65.0 cm | 80 / 100 | `HIGH` | Pre-alert notification, standby inspection crews |
| **4** | Critical Inundation | 75.0 cm | 99 / 100 | `CRITICAL` | Red Critical LED `[RED ON]`, Buzzer `[ALARM ON 2.4kHz]`, Team Alpha Dispatched |
| **4b**| Operator Acknowledged | 75.0 cm | 99 / 100 | `CRITICAL` | Red Critical LED `[RED ON]`, Buzzer `[SILENCED]`, Countdown active |

---

## 📄 License
MIT License. Developed for ORACLE Edge Space-to-Ground Infrastructure Decision Intelligence Platform.