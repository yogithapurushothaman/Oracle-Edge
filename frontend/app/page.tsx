"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "./components/Sidebar";
import CommandCenterMap from "./components/CommandCenterMap";
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
  Volume2Icon,
  VolumeXIcon,
  DropletsIcon,
  ThermometerIcon,
  WavesIcon,
  WindIcon,
  TrendingUpIcon,
  ClockIcon,
  SparklesIcon,
  FileTextIcon,
  EyeIcon,
  BarChart3Icon,
  ChevronRightIcon
} from "./components/Icons";
import {
  AssetMonitoringData,
  DeviceStatus,
  TeamItem,
  IncidentTimelineItem,
  WeatherData,
  ExplainableAiData,
  ResourceReadinessData,
  DigitalTwinProfile
} from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

const DEFAULT_ASSETS: AssetMonitoringData[] = [
  {
    asset_id: "H01",
    name: "Metro Hospital",
    type: "Healthcare",
    criticality: 10,
    population_served: 15000,
    icu_beds: 120,
    evacuation_tolerance: "Zero",
    elevation_risk: "Depression Basin",
    water_level_cm: 3.5,
    rise_rate_cm_min: 0.6,
    priority_score: 92.0,
    risk_score: 92.0,
    priority_rank: 1,
    status: "CRITICAL",
    led_safe: false,
    led_critical: true,
  },
  {
    asset_id: "B17",
    name: "River Bridge",
    type: "Transport",
    criticality: 6,
    population_served: 8000,
    daily_traffic: 8000,
    alternate_route: "No",
    elevation_risk: "Channel Flow",
    water_level_cm: 3.5,
    rise_rate_cm_min: 0.6,
    priority_score: 76.0,
    risk_score: 76.0,
    priority_rank: 2,
    status: "HIGH",
    led_safe: true,
    led_critical: false,
  },
  {
    asset_id: "D03",
    name: "Drain D03 (Adyar Sluice)",
    type: "Drainage",
    criticality: 7,
    population_served: 12000,
    water_level_cm: 2.2,
    rise_rate_cm_min: 0.3,
    priority_score: 64.0,
    risk_score: 64.0,
    priority_rank: 3,
    status: "MEDIUM",
    led_safe: true,
    led_critical: false,
  },
  {
    asset_id: "R08",
    name: "Road R08 (Inner Ring)",
    type: "Expressway",
    criticality: 5,
    population_served: 28000,
    water_level_cm: 1.1,
    rise_rate_cm_min: 0.1,
    priority_score: 52.0,
    risk_score: 52.0,
    priority_rank: 4,
    status: "LOW",
    led_safe: true,
    led_critical: false,
  },
];

const DEFAULT_TIMELINE: IncidentTimelineItem[] = [
  { time: "14:02", event: "Rainfall Detected (12 mm/hr)", detail: "Basin runoff initiated", severity: "WARNING" },
  { time: "14:05", event: "H01 Water Level Warning (3.0 cm)", detail: "Yellow threshold breached", severity: "WARNING" },
  { time: "14:07", event: "H01 Critical Alert (3.5 cm)", detail: "Tie-breaker triggered Priority #1", severity: "CRITICAL" },
  { time: "14:08", event: "Alpha Team Dispatched (ETA 12 min)", detail: "Dewatering pumps deployed", severity: "DISPATCHED" },
];

export default function OracleCommandCenter() {
  const [selectedAssetId, setSelectedAssetId] = useState<string>("H01");
  const [activeNavTab, setActiveNavTab] = useState<string>("dashboard");
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<string>("scenario_3_tiebreaker");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  // Modals
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [showAllAssetsModal, setShowAllAssetsModal] = useState<boolean>(false);

  // Live Backend State
  const [assets, setAssets] = useState<AssetMonitoringData[]>(DEFAULT_ASSETS);
  const [timeline, setTimeline] = useState<IncidentTimelineItem[]>(DEFAULT_TIMELINE);
  const [weather, setWeather] = useState<WeatherData>({
    temperature_c: 24.0,
    condition: "Heavy Rain",
    rainfall_rate_mm_hr: 12.0,
    wind_speed_kmh: 15.0,
    humidity_pct: 92.0,
  });
  const [explainableAi, setExplainableAi] = useState<ExplainableAiData>({
    risk_score: 92.0,
    rationale:
      "H01 is ranked higher because it is a critical healthcare facility with ICU dependency, high population exposure and no evacuation tolerance, despite similar water levels at B17.",
    factor_breakdown: {
      "Water Level": 35.0,
      "Criticality": 25.0,
      "Population Impact": 20.0,
      "Weather": 10.0,
      "Historical Data": 10.0,
    },
  });
  const [resourceReadiness, setResourceReadiness] = useState<ResourceReadinessData>({
    team_name: "Rapid Response Alpha",
    assigned_target: "Metro Hospital (H01)",
    members_count: 5,
    equipment: "Boats, Pumps, Medical Support",
    eta_minutes: 12,
    status: "ASSIGNED",
  });

  const [topPriority, setTopPriority] = useState<string>("H01");
  const [buzzer, setBuzzer] = useState<boolean>(false);
  const [buzzerSilenced, setBuzzerSilenced] = useState<boolean>(false);
  const [criticalAssetsCount, setCriticalAssetsCount] = useState<number>(1);
  const [warningAssetsCount, setWarningAssetsCount] = useState<number>(1);
  const [populationImpact, setPopulationImpact] = useState<number>(15000);
  const [activeNodesCount, setActiveNodesCount] = useState<number>(2);

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    device_id: "ORACLE-ESP32-01",
    status: "SIMULATION",
    mode: "SIMULATION",
    is_online: false,
    last_seen_sec: 9999,
  });

  const prevCriticalRef = useRef<boolean>(false);

  // Audio setup
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

  // State application
  const applyStateUpdate = useCallback((data: any) => {
    if (!data) return;

    if (data.device_status) {
      setDeviceStatus(data.device_status);
    }

    if (data.assets && Array.isArray(data.assets)) {
      setAssets(data.assets);
      const isNowCritical = data.assets.some((a: any) => a.status === "CRITICAL") || data.buzzer === true;
      if (!prevCriticalRef.current && isNowCritical) {
        playCriticalAlert();
      }
      prevCriticalRef.current = isNowCritical;
    }

    if (data.weather) setWeather(data.weather);
    if (data.incident_timeline && Array.isArray(data.incident_timeline)) {
      setTimeline(data.incident_timeline);
    }
    if (data.explainable_ai) setExplainableAi(data.explainable_ai);
    if (data.resource_readiness) setResourceReadiness(data.resource_readiness);

    if (data.top_priority) setTopPriority(data.top_priority);
    if (typeof data.buzzer === "boolean") setBuzzer(data.buzzer);
    if (typeof data.buzzer_silenced === "boolean") setBuzzerSilenced(data.buzzer_silenced);
    if (typeof data.critical_assets_count === "number") setCriticalAssetsCount(data.critical_assets_count);
    if (typeof data.warning_assets_count === "number") setWarningAssetsCount(data.warning_assets_count);
    if (typeof data.population_impact === "number") setPopulationImpact(data.population_impact);
    if (typeof data.active_nodes_count === "number") setActiveNodesCount(data.active_nodes_count);
  }, []);

  // Real-time SSE & initial state fetch
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    // Snapshot
    fetch(`${API_BASE_URL}/api/v1/dashboard/state`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data) applyStateUpdate(data);
      })
      .catch((err) => console.warn("Initial snapshot error:", err));

    // SSE Stream
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
    } catch (err) {
      console.warn("SSE init error:", err);
    }

    // Interval polling
    const pollInterval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/v1/dashboard/state`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isSubscribed && data) applyStateUpdate(data);
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
        if (stage === "scenario_1_normal" || stage === "baseline") {
          setIsDispatched(false);
        }
      }
    } catch (e) {
      console.error("Failed to trigger scenario:", e);
    } finally {
      setTimeout(() => setIsSimulating(false), 200);
    }
  };

  // Dispatch acknowledge
  const handleDispatchAction = async () => {
    setIsDispatched(true);
    setBuzzer(false);
    setBuzzerSilenced(true);
    await handleTriggerScenario("scenario_5_dispatch_completed");
  };

  // Asset Lookups
  const h01 = useMemo(
    () => assets.find((a) => a.asset_id === "H01") || DEFAULT_ASSETS[0],
    [assets]
  );
  const b17 = useMemo(
    () => assets.find((a) => a.asset_id === "B17") || DEFAULT_ASSETS[1],
    [assets]
  );

  const isHardwareOnline = deviceStatus.is_online || deviceStatus.status === "ONLINE";

  // Calculate Gauge stroke dashoffset (circumference = 2 * PI * r; r = 40; c = 251.2)
  const gaugeRadius = 40;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const riskScoreClamped = Math.min(100, Math.max(0, explainableAi.risk_score));
  const gaugeDashoffset = gaugeCircumference - (riskScoreClamped / 100) * gaugeCircumference;

  return (
    <div className="min-h-screen control-room-bg text-slate-100 flex font-sans selection:bg-cyan-500 selection:text-black">
      {/* --------------------------------------------------------------------- */}
      {/* LEFT SIDEBAR NAVIGATION                                               */}
      {/* --------------------------------------------------------------------- */}
      <Sidebar
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        onQuickAction={(act) => {
          if (act === "priority") {
            const el = document.getElementById("priority-ranking-board");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          } else if (act === "teams") {
            setShowTeamModal(true);
          }
        }}
        criticalAlertsCount={criticalAssetsCount}
        isConnected={isHardwareOnline}
      />

      {/* --------------------------------------------------------------------- */}
      {/* MAIN COMMAND CENTER VIEWPORT                                          */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* =================================================================== */}
        {/* TOP HEADER BAR                                                      */}
        {/* =================================================================== */}
        <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#1E3A5F] px-6 py-3 shadow-xl">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            {/* Left Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20 shrink-0">
                <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
                  <polygon points="12 3 21 18 3 18" stroke="currentColor" strokeWidth="2" fill="rgba(6, 182, 212, 0.2)" />
                  <polygon points="12 9 17 17 7 17" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56, 189, 248, 0.4)" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-wider text-white">ORACLE EDGE</h1>
                  <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                    Municipal Decision Platform
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Space-to-Ground Infrastructure Decision Intelligence Platform
                </p>
              </div>
            </div>

            {/* Center Status, Clock, Weather */}
            <div className="flex items-center gap-3">
              {/* Status Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F]">
                <span className={`w-2 h-2 rounded-full ${isHardwareOnline ? "bg-emerald-400 animate-ping" : "bg-emerald-400"}`} />
                <span className="text-xs font-bold text-slate-200">
                  {isHardwareOnline ? "System Online" : "System Online"}
                </span>
              </div>

              {/* Clock */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] text-xs font-mono text-cyan-300">
                <ClockIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>12 Sep 2026, 14:32</span>
              </div>

              {/* Weather Widget Header */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] text-xs">
                <span className="text-base">🌧️</span>
                <span className="font-bold text-slate-200">
                  {Math.round(weather.temperature_c)}°C {weather.condition}
                </span>
              </div>
            </div>

            {/* Right User chip & Audio */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] cursor-pointer hover:border-cyan-500/40 transition-all">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                  🏛️
                </div>
                <span className="text-xs font-bold text-slate-200">Municipal Authority</span>
                <span className="text-[10px] text-slate-400">∨</span>
              </div>

              <button
                onClick={handleToggleAudio}
                className="p-2 rounded-xl bg-[#132238] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-slate-300 transition-all cursor-pointer"
                title={isAudioMuted ? "Unmute Alarm" : "Mute Alarm"}
              >
                {isAudioMuted ? <VolumeXIcon className="w-4 h-4 text-rose-400" /> : <Volume2Icon className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Sub-header / Dev Demo Bar: 5 structured stages */}
          <div className="mt-2.5 pt-2 border-t border-[#1E3A5F]/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="text-cyan-400 font-bold">Dev Demo Controls:</span>
              <span>Select demonstration stage to verify closed-loop triage:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleTriggerScenario("scenario_1_normal")}
                disabled={isSimulating}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeStage === "scenario_1_normal" || activeStage === "baseline"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "bg-[#132238] text-slate-300 hover:text-white border border-[#1E3A5F]"
                }`}
              >
                <span>🟢</span>
                <span>1: Normal</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("scenario_2_rain")}
                disabled={isSimulating}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeStage === "scenario_2_rain" || activeStage === "rain_start"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                    : "bg-[#132238] text-slate-300 hover:text-white border border-[#1E3A5F]"
                }`}
              >
                <span>💧</span>
                <span>2: Rain Start</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("scenario_3_tiebreaker")}
                disabled={isSimulating}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeStage === "scenario_3_tiebreaker" || activeStage === "equal_surge"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "bg-[#132238] text-slate-300 hover:text-white border border-[#1E3A5F]"
                }`}
              >
                <span>🟡</span>
                <span>3: Equal Surge (Tie-Breaker)</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("scenario_4_hospital_critical")}
                disabled={isSimulating}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  activeStage === "scenario_4_hospital_critical" || activeStage === "emergency"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse"
                    : "bg-[#132238] text-slate-300 hover:text-white border border-[#1E3A5F]"
                }`}
              >
                <span>🔴</span>
                <span>4: Critical H01</span>
              </button>

              <button
                onClick={() => handleTriggerScenario("scenario_1_normal")}
                disabled={isSimulating}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#132238] hover:bg-[#1E3A5F] text-slate-400 hover:text-white border border-[#1E3A5F] transition-all cursor-pointer"
              >
                <span>↺</span>
                <span>5: Reset</span>
              </button>
            </div>
          </div>
        </header>

        {/* =================================================================== */}
        {/* MAIN BODY DASHBOARD                                                 */}
        {/* =================================================================== */}
        <main className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* ================================================================= */}
          {/* TOP STATS CARDS (Executive Summary)                               */}
          {/* ================================================================= */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Critical Assets */}
            <div className="bg-[#132238] border border-rose-500/30 hover:border-rose-500/60 rounded-xl p-4 shadow-lg shadow-rose-500/5 transition-all relative overflow-hidden flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Critical Assets
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-rose-400 font-mono">
                    {criticalAssetsCount}
                  </span>
                  <span className="text-xs font-bold text-rose-300">Immediate Action</span>
                </div>
              </div>
              {/* Hexagon Red Alert Icon */}
              <div className="w-12 h-12 flex items-center justify-center text-rose-500 shrink-0">
                <svg className="w-11 h-11" viewBox="0 0 100 100" fill="currentColor">
                  <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="4" />
                  <text x="50" y="60" textAnchor="middle" fontSize="32" fontWeight="900" fill="#ef4444">!</text>
                </svg>
              </div>
            </div>

            {/* Card 2: Warning Assets */}
            <div className="bg-[#132238] border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-4 shadow-lg shadow-amber-500/5 transition-all relative overflow-hidden flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Warning Assets
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-400 font-mono">
                    {warningAssetsCount}
                  </span>
                  <span className="text-xs font-bold text-amber-300">Monitor</span>
                </div>
              </div>
              {/* Hexagon Amber Warning Icon */}
              <div className="w-12 h-12 flex items-center justify-center text-amber-400 shrink-0">
                <svg className="w-11 h-11" viewBox="0 0 100 100" fill="currentColor">
                  <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="4" />
                  <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="900" fill="#f59e0b">▲</text>
                </svg>
              </div>
            </div>

            {/* Card 3: Population Impact */}
            <div className="bg-[#132238] border border-blue-500/30 hover:border-blue-500/60 rounded-xl p-4 shadow-lg shadow-blue-500/5 transition-all relative overflow-hidden flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Population Impact
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-blue-400 font-mono">
                    {populationImpact.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-blue-300">(Estimated)</span>
                </div>
              </div>
              {/* Blue Shield Icon */}
              <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
                <ShieldIcon className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Active Nodes */}
            <div className="bg-[#132238] border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-4 shadow-lg shadow-emerald-500/5 transition-all relative overflow-hidden flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Active Nodes
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    {activeNodesCount}/2
                  </span>
                  <span className="text-xs font-bold text-emerald-300">(Online)</span>
                </div>
              </div>
              {/* Green Check Icon */}
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
                <CheckCircle2Icon className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* MIDDLE SECTION: HERO MAP + TOP & MIDDLE RIGHT PANELS              */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* HERO MAP: City Digital Twin - Live View (7 cols) */}
            <div className="lg:col-span-7 bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-2xl flex flex-col">
              <CommandCenterMap
                assets={assets}
                selectedAssetId={selectedAssetId}
                onSelectAsset={setSelectedAssetId}
              />
            </div>

            {/* RIGHT COLUMN (5 cols): WEATHER, DISPATCH, SENSORS, RANKING, TIMELINE */}
            <div className="lg:col-span-5 space-y-4">
              {/* TOP RIGHT PANELS: Live Weather & Dispatch Recommendation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Panel 1: Live Weather (Open-Meteo) */}
                <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      Live Weather (Open-Meteo)
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-[#0B132B] px-1.5 py-0.5 rounded border border-[#1E3A5F]">
                      LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-3 my-1">
                    <span className="text-3xl">🌧️</span>
                    <div>
                      <div className="text-2xl font-black text-white font-mono">
                        {Math.round(weather.temperature_c)}°C
                      </div>
                      <span className="text-xs font-bold text-cyan-300">{weather.condition}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#1E3A5F] text-[11px] font-mono text-slate-300">
                    <div>
                      Rainfall: <strong className="text-white">{weather.rainfall_rate_mm_hr} mm/hr ↑</strong>
                    </div>
                    <div>
                      Wind: <strong className="text-white">{weather.wind_speed_kmh} km/h</strong>
                    </div>
                    <div>
                      Humidity: <strong className="text-white">{weather.humidity_pct}%</strong>
                    </div>
                    <div>
                      Temp: <strong className="text-white">{Math.round(weather.temperature_c)}°C</strong>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Dispatch Recommendation */}
                <div className="bg-[#132238] border border-rose-500/40 rounded-xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500 text-white uppercase tracking-wider">
                        🚨 Emergency Dispatch
                      </span>
                      <span className="text-[11px] font-mono text-cyan-300 font-bold">
                        ETA: 12 mins
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white mt-1">
                      Rapid Response Alpha ({isDispatched ? "Deployed" : "Assigned"})
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Target: <strong className="text-rose-400">Metro Hospital (H01)</strong>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Equipment: Boats, Pumps, Medical Support
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#1E3A5F] flex items-center justify-between">
                    <button
                      onClick={() => setShowTeamModal(true)}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
                    >
                      <span>View Team Details</span>
                      <span>→</span>
                    </button>
                    <button
                      onClick={handleDispatchAction}
                      disabled={isDispatched}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide cursor-pointer ${
                        isDispatched
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                      }`}
                    >
                      {isDispatched ? "✓ Dispatched" : "Dispatch Alpha"}
                    </button>
                  </div>
                </div>
              </div>

              {/* MIDDLE RIGHT: LIVE SENSOR DATA DUAL CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* H01 Card */}
                <div
                  onClick={() => setSelectedAssetId("H01")}
                  className={`bg-[#132238] border p-3.5 rounded-xl shadow-md cursor-pointer transition-all ${
                    selectedAssetId === "H01"
                      ? "border-rose-500 shadow-rose-500/10"
                      : "border-[#1E3A5F] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🏥</span>
                      <h4 className="text-xs font-bold text-white">H01 - Metro Hospital</h4>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Warning
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-xl font-black text-white font-mono">
                      {h01.water_level_cm.toFixed(1)}{" "}
                      <span className="text-xs font-normal text-slate-400">cm</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300">
                      Rise Rate: +{h01.rise_rate_cm_min.toFixed(1)} cm/min
                    </span>
                  </div>
                </div>

                {/* B17 Card */}
                <div
                  onClick={() => setSelectedAssetId("B17")}
                  className={`bg-[#132238] border p-3.5 rounded-xl shadow-md cursor-pointer transition-all ${
                    selectedAssetId === "B17"
                      ? "border-amber-500 shadow-amber-500/10"
                      : "border-[#1E3A5F] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🌉</span>
                      <h4 className="text-xs font-bold text-white">B17 - River Bridge</h4>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Warning
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="text-xl font-black text-white font-mono">
                      {b17.water_level_cm.toFixed(1)}{" "}
                      <span className="text-xs font-normal text-slate-400">cm</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300">
                      Rise Rate: +{b17.rise_rate_cm_min.toFixed(1)} cm/min
                    </span>
                  </div>
                </div>
              </div>

              {/* PRIORITY RANKING BOARD & INCIDENT TIMELINE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Priority Ranking Board */}
                <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-lg flex flex-col justify-between" id="priority-ranking-board">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2 mb-2">
                      <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider">
                        Priority Ranking Board
                      </span>
                      <button
                        onClick={() => setShowAllAssetsModal(true)}
                        className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                      >
                        View All →
                      </button>
                    </div>

                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[10px] font-mono uppercase text-slate-400 border-b border-[#1E3A5F]">
                          <th className="py-1 px-1">#</th>
                          <th className="py-1 px-1">Asset</th>
                          <th className="py-1 px-1 text-right">Score</th>
                          <th className="py-1 px-1 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E3A5F]/50 font-mono">
                        <tr
                          onClick={() => setSelectedAssetId("H01")}
                          className="cursor-pointer hover:bg-[#0B132B]/60 transition-colors"
                        >
                          <td className="py-2 px-1 font-bold text-rose-400">1</td>
                          <td className="py-2 px-1 text-white font-bold flex items-center gap-1">
                            <span>🏥</span>
                            <span>H01 - Metro Hospital</span>
                          </td>
                          <td className="py-2 px-1 text-right font-black text-rose-400">
                            {Math.round(h01.risk_score)}
                          </td>
                          <td className="py-2 px-1 text-right">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              Critical
                            </span>
                          </td>
                        </tr>

                        <tr
                          onClick={() => setSelectedAssetId("B17")}
                          className="cursor-pointer hover:bg-[#0B132B]/60 transition-colors"
                        >
                          <td className="py-2 px-1 font-bold text-amber-400">2</td>
                          <td className="py-2 px-1 text-slate-200 font-bold flex items-center gap-1">
                            <span>🌉</span>
                            <span>B17 - River Bridge</span>
                          </td>
                          <td className="py-2 px-1 text-right font-black text-amber-400">
                            {Math.round(b17.risk_score)}
                          </td>
                          <td className="py-2 px-1 text-right">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              High
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[10px] text-cyan-300 font-mono pt-2 border-t border-[#1E3A5F] text-center">
                    Tie-breaker: H01 (92) prioritized over B17 (76)
                  </p>
                </div>

                {/* Incident Timeline (Vertical Stepper) */}
                <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2 mb-2">
                      <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider">
                        Incident Timeline
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">UTC</span>
                    </div>

                    <div className="space-y-2 mt-2">
                      {timeline.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <div className="flex flex-col items-center">
                            <span
                              className={`w-2 h-2 rounded-full mt-1 ${
                                item.severity === "CRITICAL"
                                  ? "bg-rose-500 animate-ping"
                                  : item.severity === "DISPATCHED"
                                  ? "bg-emerald-400"
                                  : "bg-amber-400"
                              }`}
                            />
                            {idx < timeline.length - 1 && (
                              <div className="w-0.5 h-6 bg-[#1E3A5F] my-0.5" />
                            )}
                          </div>
                          <div className="flex-1 font-mono text-[11px]">
                            <div className="flex items-center justify-between">
                              <strong className="text-white">{item.time}</strong>
                              <span
                                className={`text-[9px] font-bold ${
                                  item.severity === "CRITICAL"
                                    ? "text-rose-400"
                                    : item.severity === "DISPATCHED"
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }`}
                              >
                                {item.event}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* BOTTOM WORKSPACE ROW                                              */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* ASSET DETAILS DUAL CARDS (4 cols) */}
            <div className="lg:col-span-4 space-y-3.5">
              {/* Card 1: H01 - Metro Hospital */}
              <div className="bg-[#132238] border border-rose-500/40 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏥</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">H01 - Metro Hospital</h4>
                      <p className="text-[10px] text-rose-300 font-mono">Type: Healthcare (Critical)</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-rose-400 font-mono">
                    Risk: {Math.round(h01.risk_score)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 mt-2 pt-2 border-t border-[#1E3A5F]">
                  <div>Water Level: <strong className="text-white">{h01.water_level_cm.toFixed(1)} cm</strong></div>
                  <div>Rise Rate: <strong className="text-white">+{h01.rise_rate_cm_min.toFixed(1)} cm/min</strong></div>
                  <div>Pop Served: <strong className="text-white">15,000</strong></div>
                  <div>ICU Beds: <strong className="text-white">120 (Zero Tol.)</strong></div>
                </div>
              </div>

              {/* Card 2: B17 - River Bridge */}
              <div className="bg-[#132238] border border-amber-500/40 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌉</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">B17 - River Bridge</h4>
                      <p className="text-[10px] text-amber-300 font-mono">Type: Transport (High)</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-400 font-mono">
                    Risk: {Math.round(b17.risk_score)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 mt-2 pt-2 border-t border-[#1E3A5F]">
                  <div>Water Level: <strong className="text-white">{b17.water_level_cm.toFixed(1)} cm</strong></div>
                  <div>Rise Rate: <strong className="text-white">+{b17.rise_rate_cm_min.toFixed(1)} cm/min</strong></div>
                  <div>Daily Traffic: <strong className="text-white">8,000 Veh.</strong></div>
                  <div>Alt Route: <strong className="text-white">No (Arterial)</strong></div>
                </div>
              </div>
            </div>

            {/* EXPLAINABLE AI - WHY H01? CENTERPIECE (5 cols) */}
            <div className="lg:col-span-5 bg-[#132238] border border-[#1E3A5F] rounded-xl p-5 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <CpuIcon className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                      Explainable AI — Why H01?
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 bg-[#0B132B] px-2 py-0.5 rounded border border-[#1E3A5F]">
                    Multi-Factor Weights
                  </span>
                </div>

                {/* Circular Gauge & Horizontal Bars Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mb-3">
                  {/* Circular Gauge (5 cols) */}
                  <div className="sm:col-span-5 flex flex-col items-center justify-center">
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {/* Background track */}
                        <circle
                          cx="50"
                          cy="50"
                          r={gaugeRadius}
                          stroke="#1E3A5F"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        {/* Glowing progress stroke */}
                        <circle
                          cx="50"
                          cy="50"
                          r={gaugeRadius}
                          stroke={explainableAi.risk_score >= 85 ? "#ef4444" : "#f59e0b"}
                          strokeWidth="8"
                          strokeDasharray={gaugeCircumference}
                          strokeDashoffset={gaugeDashoffset}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-white font-mono leading-none">
                          {Math.round(explainableAi.risk_score)}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-1">
                          Risk / 100
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-rose-400 font-bold mt-1">
                      Tier 1 Priority
                    </span>
                  </div>

                  {/* Horizontal Factor Contribution Bars (7 cols) */}
                  <div className="sm:col-span-7 space-y-2 text-xs font-mono">
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-300">Sensor Water Level:</span>
                        <strong className="text-blue-400">35%</strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: "35%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-300">Infrastructure Criticality:</span>
                        <strong className="text-amber-400">25%</strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "25%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-300">Population Impact:</span>
                        <strong className="text-purple-400">20%</strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: "20%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-300">Weather & Inflow:</span>
                        <strong className="text-cyan-400">10%</strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: "10%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-300">Historical Vulnerability:</span>
                        <strong className="text-slate-400">10%</strong>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-400 rounded-full" style={{ width: "10%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision Rationale Callout Box with lightbulb */}
                <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2.5">
                  <span className="text-base">💡</span>
                  <p className="leading-relaxed">
                    <strong className="text-white">Decision Rationale:</strong>{" "}
                    {explainableAi.rationale}
                  </p>
                </div>
              </div>
            </div>

            {/* RESOURCE READINESS & RECENT ALERTS (3 cols) */}
            <div className="lg:col-span-3 space-y-3.5">
              {/* Resource & Team Readiness Card */}
              <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider">
                      Resource Readiness
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      {isDispatched ? "EN ROUTE" : "ASSIGNED"}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white">
                    {resourceReadiness.team_name}
                  </h4>
                  <p className="text-[11px] text-cyan-300 font-mono mt-0.5">
                    Target: {resourceReadiness.assigned_target}
                  </p>
                  <div className="text-[11px] font-mono text-slate-300 space-y-1 mt-2">
                    <div>Team Members: <strong className="text-white">{resourceReadiness.members_count} Officers</strong></div>
                    <div>Equipment: <strong className="text-white">{resourceReadiness.equipment}</strong></div>
                    <div>Live ETA Countdown: <strong className="text-emerald-400 font-bold">12 minutes</strong></div>
                  </div>
                </div>

                <button
                  onClick={() => setShowTeamModal(true)}
                  className="mt-3 w-full py-1.5 rounded-lg bg-[#0B132B] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-bold text-slate-300 transition-all cursor-pointer"
                >
                  Manage Deployment
                </button>
              </div>

              {/* Recent Alerts Feed */}
              <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-2 mb-2">
                  <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider">
                    Recent Alerts Feed
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Live</span>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span className="text-rose-400 font-bold">14:07</span>
                    <span className="text-slate-200 truncate">H01 Critical Alert (3.5 cm)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-amber-400 font-bold">14:05</span>
                    <span className="text-slate-200 truncate">B17 Warning Level (3.0 cm)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-blue-400 font-bold">14:02</span>
                    <span className="text-slate-200 truncate">Rainfall Detected (12 mm/hr)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* =================================================================== */}
        {/* FOOTER BAR                                                          */}
        {/* =================================================================== */}
        <footer className="mt-8 border-t border-[#1E3A5F] bg-[#0d1b2a] px-6 py-4 text-slate-400">
          <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-xs tracking-wider">ORACLE EDGE</span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-300 font-semibold">
                Municipal Emergency Control Room
              </span>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              GovTech Mission: Space-to-Ground Infrastructure Flood Triage & Closed-Loop Resource Allocation
            </p>

            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[#132238] border border-[#1E3A5F] text-emerald-400">
                ● Live Data
              </span>
              <span className="px-2 py-0.5 rounded bg-[#132238] border border-[#1E3A5F] text-cyan-300">
                Digital Twin
              </span>
              <span className="px-2 py-0.5 rounded bg-[#132238] border border-[#1E3A5F] text-purple-300">
                AI Decisions
              </span>
              <span className="px-2 py-0.5 rounded bg-[#132238] border border-[#1E3A5F] text-slate-300">
                Safer Tomorrow
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: TEAM DISPATCH DETAILS                                          */}
      {/* ===================================================================== */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#132238] border border-cyan-500/50 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Rapid Response Team Alpha Profile
                </h3>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0B132B] border border-[#1E3A5F] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Unit ID:</span>
                  <span className="text-cyan-300 font-bold">UNIT-ALPHA-01</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Assignment:</span>
                  <span className="text-rose-400 font-bold">Metro Hospital (H01)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Personnel:</span>
                  <span className="text-white">5 High-Hazard Rescue Officers</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Primary Kit:</span>
                  <span className="text-white">Mobile Dewatering Pumps, Inflatable Boats, ICU Grid Stabilizers</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Arrival:</span>
                  <span className="text-emerald-400 font-bold">12 minutes</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Objective: Secure perimeter floodgates, deploy high-volume water extraction units at ICU power
                substation, and establish auxiliary oxygen supply backup lines.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handleDispatchAction}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Dispatch
              </button>
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 rounded-lg bg-[#0B132B] hover:bg-[#1E3A5F] text-slate-300 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: VIEW ALL RANKED ASSETS                                         */}
      {/* ===================================================================== */}
      {showAllAssetsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#132238] border border-[#1E3A5F] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2">
                <BarChart3Icon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  All Monitored Municipal Assets & Triage Hierarchy
                </h3>
              </div>
              <button
                onClick={() => setShowAllAssetsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-mono uppercase text-slate-400 border-b border-[#1E3A5F]">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Asset Name</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2">Water Depth</th>
                    <th className="py-2 px-2 text-right">Risk Score</th>
                    <th className="py-2 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3A5F]/50 font-mono">
                  {assets.map((asset, idx) => (
                    <tr
                      key={asset.asset_id}
                      onClick={() => {
                        setSelectedAssetId(asset.asset_id);
                        setShowAllAssetsModal(false);
                      }}
                      className="cursor-pointer hover:bg-[#0B132B]/60 transition-colors"
                    >
                      <td className="py-2.5 px-2 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-2 text-white font-bold">{asset.name} ({asset.asset_id})</td>
                      <td className="py-2.5 px-2 text-slate-400">{asset.type}</td>
                      <td className="py-2.5 px-2 text-cyan-300">{asset.water_level_cm.toFixed(1)} cm</td>
                      <td className="py-2.5 px-2 text-right font-black">
                        {Math.round(asset.risk_score)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            asset.status === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : asset.status === "HIGH"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}
                        >
                          {asset.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowAllAssetsModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
