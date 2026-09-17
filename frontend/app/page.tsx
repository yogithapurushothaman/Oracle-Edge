"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import CommandCenterMap from "./components/CommandCenterMap";
import { useTheme } from "./context/ThemeContext";
import {
  playCriticalAlert,
  getAudioMuted,
  setAudioMuted,
  initAudioContext,
} from "./utils/audioAlert";
import {
  ShieldIcon,
  CpuIcon,
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  UsersIcon,
  SunIcon,
  MoonIcon,
  Volume2Icon,
  VolumeXIcon,
} from "./components/Icons";
import { AssetMonitoringData, DeviceStatus, TeamItem } from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

const DEFAULT_ASSETS: AssetMonitoringData[] = [
  {
    asset_id: "H01",
    name: "Metro Hospital",
    type: "Hospital",
    domain: "URBAN_INFRASTRUCTURE",
    target_hazard: "FLOOD",
    criticality: 35.0,
    population_served: 45000,
    water_level_cm: 0.0,
    rise_rate_cm_min: 0.0,
    priority_score: 0.0,
    risk_score: 0.0,
    priority_rank: 1,
    status: "SAFE",
    led_safe: true,
    led_critical: false,
    shap_breakdown: {
      "IoT Depth & Rise Rate": 0,
      "Infrastructure Criticality": 0,
      "Population Exposure": 0,
      "Satellite GIS Risk": 0,
      "Historical Baseline": 0,
    },
  },
  {
    asset_id: "B17",
    name: "River Bridge B17",
    type: "Bridge",
    domain: "URBAN_INFRASTRUCTURE",
    target_hazard: "FLOOD",
    criticality: 20.0,
    population_served: 15000,
    water_level_cm: 0.0,
    rise_rate_cm_min: 0.0,
    priority_score: 0.0,
    risk_score: 0.0,
    priority_rank: 2,
    status: "SAFE",
    led_safe: true,
    led_critical: false,
    shap_breakdown: {
      "IoT Depth & Rise Rate": 0,
      "Infrastructure Criticality": 0,
      "Population Exposure": 0,
      "Satellite GIS Risk": 0,
      "Historical Baseline": 0,
    },
  },
];

const DEFAULT_TEAMS: TeamItem[] = [
  {
    team_id: "TEAM-ALPHA",
    team_name: "Rapid Response Team Alpha",
    specialty: "ICU Life-Support & Inundation Defense",
    hazard_domain: "FLOOD",
    status: "AVAILABLE",
  },
  {
    team_id: "TEAM-BETA",
    team_name: "Rescue Unit Beta",
    specialty: "Bridge Arterial Transit & Structural Evacuation",
    hazard_domain: "FLOOD",
    status: "AVAILABLE",
  },
];

export default function OracleCommandCenter() {
  const { theme, toggleTheme } = useTheme();
  const [selectedAssetId, setSelectedAssetId] = useState<string>("H01");
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<string>("baseline");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  // Live Backend State
  const [assets, setAssets] = useState<AssetMonitoringData[]>(DEFAULT_ASSETS);
  const [topPriority, setTopPriority] = useState<string>("H01");
  const [buzzer, setBuzzer] = useState<boolean>(false);
  const [buzzerSilenced, setBuzzerSilenced] = useState<boolean>(false);
  const [recommendedAction, setRecommendedAction] = useState<string>(
    "MONITORING ACTIVE: All regional assets within nominal limits. Response units staged on standby."
  );
  const [actionLevel, setActionLevel] = useState<"CRITICAL" | "MODERATE" | "SAFE">("SAFE");
  const [teams, setTeams] = useState<TeamItem[]>(DEFAULT_TEAMS);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    device_id: "ORACLE-ESP32-01",
    status: "SIMULATION",
    mode: "SIMULATION",
    is_online: false,
    last_seen_sec: 9999,
  });
  const [lastTelemetryTime, setLastTelemetryTime] = useState<string>("Active Feed");
  const prevCriticalRef = React.useRef<boolean>(false);

  // Sound initialization
  useEffect(() => {
    setIsAudioMuted(getAudioMuted());
    const handleMuteChange = (e: any) => {
      if (typeof e.detail?.muted === "boolean") {
        setIsAudioMuted(e.detail.muted);
      }
    };
    window.addEventListener("oracle-audio-mute-change", handleMuteChange);
    return () => window.removeEventListener("oracle-audio-mute-change", handleMuteChange);
  }, []);

  const handleToggleAudio = () => {
    initAudioContext();
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    setAudioMuted(nextMuted);
  };

  // State application helper
  const applyStateUpdate = useCallback((data: any) => {
    if (!data) return;

    if (data.device_status) {
      setDeviceStatus(data.device_status);
    } else if (data.status && typeof data.last_seen_sec === "number") {
      setDeviceStatus({
        device_id: data.device_id || "ORACLE-ESP32-01",
        status: data.status,
        mode: data.mode || (data.status === "ONLINE" ? "HARDWARE" : "SIMULATION"),
        is_online: data.status === "ONLINE",
        last_seen_sec: data.last_seen_sec,
      });
    }

    if (data.assets && Array.isArray(data.assets)) {
      setAssets(data.assets);
      const isNowCritical = data.assets.some((a: any) => a.status === "CRITICAL") || data.buzzer === true;
      if (!prevCriticalRef.current && isNowCritical) {
        playCriticalAlert();
      }
      prevCriticalRef.current = isNowCritical;
    }

    if (data.top_priority) setTopPriority(data.top_priority);
    if (typeof data.buzzer === "boolean") setBuzzer(data.buzzer);
    if (typeof data.buzzer_silenced === "boolean") setBuzzerSilenced(data.buzzer_silenced);
    if (data.recommended_action) setRecommendedAction(data.recommended_action);
    if (data.action_level) setActionLevel(data.action_level);

    if (data.teams && Array.isArray(data.teams)) {
      setTeams(data.teams);
    }

    if (data.timestamp) {
      const d = new Date(data.timestamp);
      setLastTelemetryTime(d.toLocaleTimeString());
    }
  }, []);

  // Connect to live SSE Stream and fetch initial snapshot
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    // 1. Initial snapshot fetch
    fetch(`${API_BASE_URL}/api/v1/dashboard/state`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data) {
          applyStateUpdate(data);
        }
      })
      .catch((err) => {
        console.warn("Initial state fetch error:", err);
      });

    // 2. Real-time Server-Sent Events
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/stream`);
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          applyStateUpdate(parsed);
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };
      eventSource.onerror = () => {
        // SSE automatic reconnection will handle retry
      };
    } catch (err) {
      console.warn("SSE connection init error:", err);
    }

    // 3. Fallback polling every 3s
    const pollInterval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/v1/dashboard/state`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isSubscribed && data) {
            applyStateUpdate(data);
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      isSubscribed = false;
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [applyStateUpdate]);

  // Handle Simulation Scenario Trigger
  const handleTriggerScenario = async (stage: string) => {
    setActiveStage(stage);
    setIsSimulating(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/simulate/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (resp.ok) {
        const data = await resp.json();
        applyStateUpdate(data);
        if (stage === "baseline") {
          setIsDispatched(false);
        }
      }
    } catch (e) {
      console.error("Failed to trigger simulation scenario:", e);
    } finally {
      setTimeout(() => setIsSimulating(false), 200);
    }
  };

  // Handle Dispatch Action
  const handleAcknowledgeDispatch = async () => {
    setIsDispatched(true);
    setBuzzer(false);
    setBuzzerSilenced(true);

    try {
      await fetch(`${API_BASE_URL}/api/v1/actions/ACT-H01-INIT/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: "TEAM-ALPHA" }),
      });
    } catch (e) {
      console.warn("Assign endpoint fallback:", e);
    }

    setTeams((prev) =>
      prev.map((t) =>
        t.team_id === "TEAM-ALPHA"
          ? { ...t, status: "DISPATCHED", current_assignment: "Metro Hospital (H01)" }
          : t
      )
    );
  };

  // Memoized asset lookups
  const h01 = useMemo(() => assets.find((a) => a.asset_id === "H01") || DEFAULT_ASSETS[0], [assets]);
  const b17 = useMemo(() => assets.find((a) => a.asset_id === "B17") || DEFAULT_ASSETS[1], [assets]);

  const isHardwareOnline = deviceStatus.is_online || deviceStatus.status === "ONLINE";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* ========================================================================= */}
      {/* TOP EXECUTIVE HEADER & SIMULATION BAR                                     */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Brand & Mode Status */}
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
              <ShieldIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-black tracking-tight text-white">
                  ORACLE Edge <span className="text-cyan-400 font-medium">| Municipal Decision Platform</span>
                </h1>
                {/* Physical Hardware vs Standalone Simulation Mode Badge */}
                {isHardwareOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    ESP32 Node: ONLINE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    SIMULATION MODE: ACTIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Space-to-Ground Infrastructure Flood Triage & Closed-Loop Resource Allocation
              </p>
            </div>
          </div>

          {/* Top Header Simulation Bar & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 hidden sm:inline">
                Simulate:
              </span>
              <button
                onClick={() => handleTriggerScenario("baseline")}
                disabled={isSimulating}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeStage === "baseline"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>🟢</span>
                <span>Normal Baseline (0.0 cm)</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("rain_start")}
                disabled={isSimulating}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeStage === "rain_start"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>💧</span>
                <span>Rain Inflow (1.5 cm)</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("equal_surge")}
                disabled={isSimulating}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeStage === "equal_surge"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>🟡</span>
                <span>Tie-Breaker Surge (Both 3.5 cm)</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("emergency")}
                disabled={isSimulating}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeStage === "emergency"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <span>🔴</span>
                <span>Critical Emergency</span>
              </button>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleAudio}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-all cursor-pointer"
              title={isAudioMuted ? "Unmute Alarm Audio" : "Mute Alarm Audio"}
            >
              {isAudioMuted ? <VolumeXIcon className="w-4 h-4 text-rose-400" /> : <Volume2Icon className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 5-PANEL MUNICIPAL COMMAND CENTER BODY                                      */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* ROW 1: PANEL 1 (Live Edge Telemetry) & PANEL 2 (Geospatial Context) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* --------------------------------------------------------------------- */}
          {/* PANEL 1: LIVE EDGE NODE TELEMETRY (7 Cols)                            */}
          {/* --------------------------------------------------------------------- */}
          <section className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <ActivityIcon className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                  Panel 1: Live Edge Node Telemetry
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Thresholds: Dry &lt; 0.2cm | Yellow &ge; 3.0cm | Red &ge; 4.0cm
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {/* Node 1: Metro Hospital (H01) */}
              <div
                onClick={() => setSelectedAssetId("H01")}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedAssetId === "H01"
                    ? "bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏥</span>
                      <div>
                        <h3 className="text-sm font-bold text-white">Metro Hospital</h3>
                        <p className="text-[10px] text-cyan-400 font-mono">Node 1 (H01) | Pin 36 (VP)</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        h01.status === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                          : h01.status === "ELEVATED"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {h01.status === "CRITICAL" ? "🔴 CRITICAL RED" : h01.status === "ELEVATED" ? "🟡 YELLOW ALERT" : "🟢 SAFE"}
                    </span>
                  </div>

                  {/* Depth & Rise Rate */}
                  <div className="my-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-black text-white">{h01.water_level_cm.toFixed(1)}</span>
                      <span className="text-xs text-slate-400 font-bold ml-1">cm</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-300">
                        {h01.rise_rate_cm_min >= 0 ? `+${h01.rise_rate_cm_min.toFixed(2)}` : h01.rise_rate_cm_min.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">cm/min</span>
                    </div>
                  </div>

                  {/* Visual Depth Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>0cm (Dry)</span>
                      <span>3.0cm</span>
                      <span>4.0cm (Alert)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          h01.water_level_cm >= 4.0
                            ? "bg-rose-500"
                            : h01.water_level_cm >= 3.0
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, (h01.water_level_cm / 5.0) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Hardware Actuator State Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Hardware Actuators:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${h01.led_safe ? "bg-emerald-400" : "bg-slate-700"}`} title="Pin 21 (Green)" />
                    <span className={`w-2 h-2 rounded-full ${h01.water_level_cm >= 3.0 && h01.water_level_cm < 4.0 ? "bg-amber-400" : "bg-slate-700"}`} title="Pin 19 (Yellow)" />
                    <span className={`w-2 h-2 rounded-full ${h01.led_critical ? "bg-rose-500 animate-ping" : "bg-slate-700"}`} title="Pin 18 (Red)" />
                    <span className={`text-[10px] font-bold ${buzzer && !buzzerSilenced ? "text-rose-400 animate-pulse" : "text-slate-600"}`}>
                      🔊 {buzzer && !buzzerSilenced ? "ON (Pin 25)" : "SILENCED"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Node 2: River Bridge (B17) */}
              <div
                onClick={() => setSelectedAssetId("B17")}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedAssetId === "B17"
                    ? "bg-slate-800/90 border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌉</span>
                      <div>
                        <h3 className="text-sm font-bold text-white">River Bridge</h3>
                        <p className="text-[10px] text-cyan-400 font-mono">Node 2 (B17) | Pin 32 (ADC1)</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        b17.status === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                          : b17.status === "ELEVATED"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {b17.status === "CRITICAL" ? "🔴 CRITICAL RED" : b17.status === "ELEVATED" ? "🟡 YELLOW ALERT" : "🟢 SAFE"}
                    </span>
                  </div>

                  {/* Depth & Rise Rate */}
                  <div className="my-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-black text-white">{b17.water_level_cm.toFixed(1)}</span>
                      <span className="text-xs text-slate-400 font-bold ml-1">cm</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-300">
                        {b17.rise_rate_cm_min >= 0 ? `+${b17.rise_rate_cm_min.toFixed(2)}` : b17.rise_rate_cm_min.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">cm/min</span>
                    </div>
                  </div>

                  {/* Visual Depth Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>0cm (Dry)</span>
                      <span>3.0cm</span>
                      <span>4.0cm (Alert)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          b17.water_level_cm >= 4.0
                            ? "bg-rose-500"
                            : b17.water_level_cm >= 3.0
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, (b17.water_level_cm / 5.0) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Hardware Actuator State Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Hardware Actuators:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${b17.led_safe ? "bg-emerald-400" : "bg-slate-700"}`} title="Pin 13 (Green)" />
                    <span className={`w-2 h-2 rounded-full ${b17.water_level_cm >= 3.0 && b17.water_level_cm < 4.0 ? "bg-amber-400" : "bg-slate-700"}`} title="Pin 23 (Yellow)" />
                    <span className={`w-2 h-2 rounded-full ${b17.led_critical ? "bg-rose-500 animate-ping" : "bg-slate-700"}`} title="Pin 22 (Red)" />
                    <span className={`text-[10px] font-bold ${buzzer && !buzzerSilenced ? "text-rose-400" : "text-slate-600"}`}>
                      🔊 {buzzer && !buzzerSilenced ? "ON (Pin 26)" : "SILENCED"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* PANEL 2: GEOSPATIAL & INFRASTRUCTURE CONTEXT (5 Cols)                 */}
          {/* --------------------------------------------------------------------- */}
          <section className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 text-base">🗺️</span>
                <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                  Panel 2: Geospatial & Infrastructure Context
                </h2>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">Adyar Basin GIS</span>
            </div>

            <div className="flex-1 min-h-[260px] rounded-xl overflow-hidden border border-slate-800 relative">
              <CommandCenterMap
                assets={assets}
                selectedAssetId={selectedAssetId}
                onSelectAsset={setSelectedAssetId}
              />
            </div>
          </section>
        </div>

        {/* ROW 2: PANEL 3 (Explainable Risk Matrix) & PANEL 4 (Priority Ranking Board) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* --------------------------------------------------------------------- */}
          {/* PANEL 3: EXPLAINABLE RISK MATRIX (7 Cols)                             */}
          {/* --------------------------------------------------------------------- */}
          <section className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CpuIcon className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                  Panel 3: Explainable Multi-Factor Risk Matrix
                </h2>
              </div>
              <span className="text-[11px] font-mono text-cyan-400">Total Risk (0 - 100)</span>
            </div>

            {/* Stacked Bars Comparison */}
            <div className="space-y-4 flex-1">
              {/* H01 Stacked Bar */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏥</span>
                    <span className="text-xs font-bold text-white">Metro Hospital (H01)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    Total: {h01.risk_score.toFixed(1)} / 100
                  </span>
                </div>
                {/* Segmented Visual Stack */}
                <div className="h-4 w-full bg-slate-800 rounded-lg overflow-hidden flex">
                  <div style={{ width: `${(h01.shap_breakdown?.["IoT Depth & Rise Rate"] || 0) * 0.9}%` }} className="bg-blue-500 h-full" title="IoT Depth & Rise Rate" />
                  <div style={{ width: `${(h01.shap_breakdown?.["Infrastructure Criticality"] || 0) * 0.9}%` }} className="bg-amber-500 h-full" title="Infrastructure Criticality (35)" />
                  <div style={{ width: `${(h01.shap_breakdown?.["Population Exposure"] || 0) * 0.9}%` }} className="bg-purple-500 h-full" title="Population Exposure (25)" />
                  <div style={{ width: `${(h01.shap_breakdown?.["Satellite GIS Risk"] || 0) * 0.9}%` }} className="bg-cyan-500 h-full" title="Satellite GIS Risk (15)" />
                  <div style={{ width: `${(h01.shap_breakdown?.["Historical Baseline"] || 0) * 0.9}%` }} className="bg-slate-400 h-full" title="Historical Baseline (10)" />
                </div>
                {/* Factor Values Grid */}
                <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] font-mono text-slate-400 text-center">
                  <span className="text-blue-400">IoT: {(h01.shap_breakdown?.["IoT Depth & Rise Rate"] || 0).toFixed(0)}</span>
                  <span className="text-amber-400">Infra: {(h01.shap_breakdown?.["Infrastructure Criticality"] || 0).toFixed(0)}</span>
                  <span className="text-purple-400">Pop: {(h01.shap_breakdown?.["Population Exposure"] || 0).toFixed(0)}</span>
                  <span className="text-cyan-400">GIS: {(h01.shap_breakdown?.["Satellite GIS Risk"] || 0).toFixed(0)}</span>
                  <span className="text-slate-400">Hist: {(h01.shap_breakdown?.["Historical Baseline"] || 0).toFixed(0)}</span>
                </div>
              </div>

              {/* B17 Stacked Bar */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌉</span>
                    <span className="text-xs font-bold text-white">River Bridge (B17)</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    Total: {b17.risk_score.toFixed(1)} / 100
                  </span>
                </div>
                {/* Segmented Visual Stack */}
                <div className="h-4 w-full bg-slate-800 rounded-lg overflow-hidden flex">
                  <div style={{ width: `${(b17.shap_breakdown?.["IoT Depth & Rise Rate"] || 0) * 0.9}%` }} className="bg-blue-500 h-full" title="IoT Depth & Rise Rate" />
                  <div style={{ width: `${(b17.shap_breakdown?.["Infrastructure Criticality"] || 0) * 0.9}%` }} className="bg-amber-500 h-full" title="Infrastructure Criticality (20)" />
                  <div style={{ width: `${(b17.shap_breakdown?.["Population Exposure"] || 0) * 0.9}%` }} className="bg-purple-500 h-full" title="Population Exposure (15)" />
                  <div style={{ width: `${(b17.shap_breakdown?.["Satellite GIS Risk"] || 0) * 0.9}%` }} className="bg-cyan-500 h-full" title="Satellite GIS Risk (10)" />
                  <div style={{ width: `${(b17.shap_breakdown?.["Historical Baseline"] || 0) * 0.9}%` }} className="bg-slate-400 h-full" title="Historical Baseline (10)" />
                </div>
                {/* Factor Values Grid */}
                <div className="grid grid-cols-5 gap-1 mt-2 text-[10px] font-mono text-slate-400 text-center">
                  <span className="text-blue-400">IoT: {(b17.shap_breakdown?.["IoT Depth & Rise Rate"] || 0).toFixed(0)}</span>
                  <span className="text-amber-400">Infra: {(b17.shap_breakdown?.["Infrastructure Criticality"] || 0).toFixed(0)}</span>
                  <span className="text-purple-400">Pop: {(b17.shap_breakdown?.["Population Exposure"] || 0).toFixed(0)}</span>
                  <span className="text-cyan-400">GIS: {(b17.shap_breakdown?.["Satellite GIS Risk"] || 0).toFixed(0)}</span>
                  <span className="text-slate-400">Hist: {(b17.shap_breakdown?.["Historical Baseline"] || 0).toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Tie-Breaker Explanation Banner */}
            <div className="mt-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2">
              <span className="text-base">💡</span>
              <p>
                <strong className="text-white">Tie-Breaker Formulation:</strong> When both assets experience identical flood depth (e.g. 3.5 cm),
                Metro Hospital triggers Tier 1 priority (~95.0) over River Bridge (~75.0) because critical ICU power systems
                and bedridden patient vulnerability supersede arterial road traffic.
              </p>
            </div>
          </section>

          {/* --------------------------------------------------------------------- */}
          {/* PANEL 4: PRIORITY RANKING BOARD (5 Cols)                              */}
          {/* --------------------------------------------------------------------- */}
          <section className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                  Panel 4: Priority Ranking Board
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Dynamic Triage Hierarchy</span>
            </div>

            <div className="space-y-3 flex-1">
              {/* Priority #1 Card */}
              <div className="p-4 rounded-xl border bg-slate-950/80 border-rose-500/50 shadow-md shadow-rose-500/10">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-rose-500 text-white shadow">
                      RANK #1
                    </span>
                    <h3 className="text-sm font-black text-white">Metro Hospital (H01)</h3>
                  </div>
                  <span className="text-xl font-black text-rose-400 font-mono">
                    {h01.risk_score.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                  <span>Tier 1: Immediate Intervention</span>
                  <span className="text-rose-300 font-semibold font-mono">ICU Life-Support Grid</span>
                </div>
              </div>

              {/* Priority #2 Card */}
              <div className="p-4 rounded-xl border bg-slate-950/80 border-slate-800 hover:border-slate-700">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-xs font-black bg-slate-700 text-slate-300">
                      RANK #2
                    </span>
                    <h3 className="text-sm font-black text-slate-300">River Bridge (B17)</h3>
                  </div>
                  <span className="text-xl font-black text-slate-400 font-mono">
                    {b17.risk_score.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                  <span>Tier 2: Monitor & Pre-Stage</span>
                  <span className="text-slate-400 font-mono">Pier Scour Transit Corridor</span>
                </div>
              </div>

              {/* Delta Callout */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Priority Score Delta:{" "}
                  <strong className="text-cyan-400 font-mono">
                    +{(h01.risk_score - b17.risk_score).toFixed(1)} pts
                  </strong>{" "}
                  (Decisive Hospital Lead)
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ROW 3: PANEL 5 (Municipal Resource Allocation & Operational Action Panel) */}
        {/* ------------------------------------------------------------------------- */}
        {/* PANEL 5: RESOURCE ALLOCATION & ACTION PANEL                               */}
        {/* ------------------------------------------------------------------------- */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                Panel 5: Municipal Resource Allocation & Operational Action Panel
              </h2>
            </div>
            <span className="text-[11px] font-mono text-cyan-400">Closed-Loop Dispatch Protocol</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Action Directive Recommendation (7 Cols) */}
            <div className="lg:col-span-7 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    actionLevel === "CRITICAL"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : actionLevel === "MODERATE"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {actionLevel === "CRITICAL" ? "🔴 HIGH PRIORITY DIRECTIVE" : actionLevel === "MODERATE" ? "🟡 ADVISORY ALERT" : "🟢 STANDBY"}
                </span>
                <span className="text-xs text-slate-400 font-mono">Response ETA: 15 Mins</span>
              </div>
              <p className="text-sm font-bold text-white leading-relaxed">
                {recommendedAction}
              </p>
            </div>

            {/* Response Units & Dispatch Action (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {teams.map((team) => (
                  <div
                    key={team.team_id}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                      team.status === "DISPATCHED" || (team.team_id === "TEAM-ALPHA" && isDispatched)
                        ? "bg-amber-950/30 border-amber-500/40"
                        : "bg-slate-950/60 border-slate-800"
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-white text-[11px]">{team.team_name}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{team.specialty}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-2 font-mono ${
                        team.status === "DISPATCHED" || (team.team_id === "TEAM-ALPHA" && isDispatched)
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {team.status === "DISPATCHED" || (team.team_id === "TEAM-ALPHA" && isDispatched)
                        ? "• EN ROUTE"
                        : "• AVAILABLE"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Acknowledge & Dispatch Button */}
              <button
                onClick={handleAcknowledgeDispatch}
                disabled={isDispatched || actionLevel === "SAFE"}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  isDispatched
                    ? "bg-slate-800 text-emerald-400 border border-emerald-500/40 cursor-default"
                    : actionLevel === "SAFE"
                    ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-600/30 active:scale-98 animate-pulse"
                }`}
              >
                {isDispatched ? (
                  <>
                    <CheckCircle2Icon className="w-4 h-4 text-emerald-400" />
                    <span>✓ Team Alpha En Route (Buzzer Silenced)</span>
                  </>
                ) : (
                  <>
                    <span>🚨</span>
                    <span>Acknowledge & Dispatch Rapid Response Team Alpha</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
