"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import CommandCenterMap from "./components/CommandCenterMap";
import AnimatedHeading from "./components/animations/AnimatedHeading";
import Sidebar from "./components/Sidebar";
import {
  playCriticalAlert,
  getAudioMuted,
  setAudioMuted,
  initAudioContext,
} from "./utils/audioAlert";
import {
  ShieldIcon,
  CheckCircle2Icon,
  Volume2Icon,
  VolumeXIcon,
  ClockIcon,
} from "./components/Icons";
import {
  AssetMonitoringData,
  DeviceStatus,
  IncidentTimelineItem,
  WeatherData,
  ExplainableAiData,
  ResourceReadinessData,
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
  const [activeNavTab, setActiveNavTab] = useState<string>("overview");
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<string>("scenario_3_tiebreaker");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  // Modal
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);

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
        if (stage === "scenario_1_normal" || stage === "baseline" || stage === "scenario_5_dispatch_completed") {
          if (stage === "scenario_1_normal") setIsDispatched(false);
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
    await handleTriggerScenario("scenario_5_dispatch_completed");
    setShowTeamModal(false);
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

  // Calculate Gauge stroke dashoffset (circumference = 2 * PI * r; r = 36; c = 226.19)
  const gaugeRadius = 36;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const riskScoreClamped = Math.min(100, Math.max(0, explainableAi.risk_score));
  const gaugeDashoffset = gaugeCircumference - (riskScoreClamped / 100) * gaugeCircumference;

  return (
    <div className="page flex flex-col min-h-screen relative z-10 p-3 md:p-4 lg:p-5 space-y-4 max-w-[1920px] mx-auto w-full">
      {/* ===================================================================== */}
      {/* 1. TOP HEADER (Shrink 0)                                              */}
      {/* ===================================================================== */}
      <header className="header-anim liquid-glass px-4 py-2.5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 shrink-0">
        {/* Left: Circular Logo Button + Glowing Cyan Glyph + ORACLE EDGE in --font-display */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none">
              <polygon points="12 3 21 18 3 18" stroke="currentColor" strokeWidth="2" fill="rgba(6, 182, 212, 0.25)" />
              <polygon points="12 9 17 17 7 17" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56, 189, 248, 0.5)" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-base font-black tracking-wider text-white"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em" }}
              >
                ORACLE EDGE
              </span>
              <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Municipal AI
              </span>
            </div>
            <p className="text-[11px] text-gray-300 font-normal tracking-wide">
              Space-to-Ground Infrastructure Decision Intelligence Platform
            </p>
          </div>
        </div>

        {/* Center: Floating Pill Nav (Inter 500, active indicator with 3 micro-dots) */}
        <div className="hidden lg:flex items-center gap-1 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-lg">
          {(["Overview", "Digital Twin", "Risk Intelligence", "Dispatch"] as const).map((tab) => {
            const tabKey = tab.toLowerCase().replace(" ", "_");
            const isActive = activeNavTab === tabKey;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveNavTab(tabKey);
                  if (tab === "Dispatch") setShowTeamModal(true);
                  if (tab === "Digital Twin") {
                    const el = document.getElementById("digital-twin-map");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                  if (tab === "Risk Intelligence") {
                    const el = document.getElementById("risk-intelligence-workspace");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                <span>{tab}</span>
                {isActive && (
                  <span className="flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-cyan-600" />
                    <span className="w-1 h-1 rounded-full bg-cyan-600" />
                    <span className="w-1 h-1 rounded-full bg-cyan-600" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Status Badge, Quick Demonstration Buttons, User Profile Pill */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Demonstration Buttons */}
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/10">
            {[
              { id: "scenario_1_normal", label: "1: Baseline" },
              { id: "scenario_2_rain", label: "2: Rain (12mm/hr)" },
              { id: "scenario_3_tiebreaker", label: "3: Tie-Breaker (Both 3.5cm)" },
              { id: "scenario_4_hospital_critical", label: "4: Critical H01" },
              { id: "scenario_5_dispatch_completed", label: "5: Reset" },
            ].map((stg) => (
              <button
                key={stg.id}
                onClick={() => handleTriggerScenario(stg.id)}
                disabled={isSimulating}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all cursor-pointer ${
                  activeStage === stg.id
                    ? "bg-white text-black font-bold shadow-sm"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {stg.label}
              </button>
            ))}
          </div>

          {/* Status Badge: "● System Online" (green pulse) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-xs">
            <span className={`w-2 h-2 rounded-full ${isHardwareOnline ? "bg-emerald-400 animate-ping" : "bg-emerald-400"}`} />
            <span className="font-medium text-white text-[11px]">System Online</span>
          </div>

          {/* Audio Siren Toggle */}
          <button
            onClick={handleToggleAudio}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-white/10 border border-white/10 text-gray-300 transition-all cursor-pointer"
            title={isAudioMuted ? "Unmute Alarm" : "Mute Alarm"}
          >
            {isAudioMuted ? (
              <VolumeXIcon className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2Icon className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          {/* Municipal Authority ∨ User Profile Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-xs text-white cursor-pointer hover:border-white/30 transition-all">
            <span className="text-sm">🏛️</span>
            <span className="font-semibold text-[11px]">Municipal Authority</span>
            <span className="text-[9px] text-gray-400">∨</span>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* WORKSPACE ROW: Left Sidebar Navigation + Main Dashboard Content Area */}
      {/* ===================================================================== */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full flex-1">
        {/* RESTORED LEFT SIDEBAR NAVIGATION */}
        <Sidebar
          activeTab={activeNavTab}
          onSelectTab={(tab) => {
            setActiveNavTab(tab);
            if (tab === "dashboard") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else if (tab === "map") {
              const el = document.getElementById("digital-twin-map");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            } else if (tab === "assets") {
              const el = document.getElementById("asset-profile-registry");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            } else if (tab === "risk") {
              const el = document.getElementById("explainable-ai-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            } else if (tab === "priority") {
              const el = document.getElementById("priority-ranking-board");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            } else if (tab === "dispatch") {
              setShowTeamModal(true);
            } else if (tab === "timeline") {
              const el = document.getElementById("incident-timeline");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            } else if (tab === "reports") {
              window.print();
            }
          }}
          onQuickAction={(act) => {
            if (act === "priority") {
              const el = document.getElementById("priority-ranking-board");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            } else if (act === "teams") {
              setShowTeamModal(true);
            } else if (act === "report") {
              window.print();
            }
          }}
          criticalAlertsCount={criticalAssetsCount}
          isConnected={isHardwareOnline}
        />

        {/* MAIN DASHBOARD CONTENT AREA */}
        <main className="flex-1 flex flex-col space-y-4 min-w-0 w-full">

      {/* ===================================================================== */}
      {/* 2. EXECUTIVE SUMMARY (TOP STATS ROW - 4 CARDS)                        */}
      {/* ===================================================================== */}
      <section className="anim grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" style={{ "--d": "0.1s" } as React.CSSProperties}>
        {/* Card 1: Critical Assets */}
        <div className="liquid-glass p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
              Critical Assets
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-2xl font-black text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {criticalAssetsCount}
              </span>
              <span className="text-[11px] font-bold text-rose-400">(Immediate Action)</span>
            </div>
          </div>
          <div className="w-10 h-10 flex items-center justify-center text-rose-500 shrink-0">
            <svg className="w-9 h-9" viewBox="0 0 100 100" fill="currentColor">
              <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="4" />
              <text x="50" y="60" textAnchor="middle" fontSize="32" fontWeight="900" fill="#ef4444">!</text>
            </svg>
          </div>
        </div>

        {/* Card 2: Warning Assets */}
        <div className="liquid-glass p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
              Warning Assets
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-2xl font-black text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {warningAssetsCount}
              </span>
              <span className="text-[11px] font-bold text-amber-400">(Monitor)</span>
            </div>
          </div>
          <div className="w-10 h-10 flex items-center justify-center text-amber-400 shrink-0">
            <svg className="w-9 h-9" viewBox="0 0 100 100" fill="currentColor">
              <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="4" />
              <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="900" fill="#f59e0b">▲</text>
            </svg>
          </div>
        </div>

        {/* Card 3: Population Impact */}
        <div className="liquid-glass p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
              Population Impact
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-2xl font-black text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {populationImpact.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-blue-300">(Estimated)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
            <ShieldIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Active Nodes */}
        <div className="liquid-glass p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
              Active Nodes
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-2xl font-black text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {activeNodesCount}/2
              </span>
              <span className="text-[11px] font-bold text-emerald-400">(Online)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
            <CheckCircle2Icon className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. CENTRAL WORKSPACE (DIGITAL TWIN & LIVE INTEL)                      */}
      {/* ===================================================================== */}
      <section className="anim grid grid-cols-1 lg:grid-cols-12 gap-4 items-start" style={{ "--d": "0.2s" } as React.CSSProperties}>
        {/* Center-Left Hero: City Digital Twin - Live View (7 cols) */}
        <div id="digital-twin-map" className="lg:col-span-7 liquid-glass p-3 flex flex-col">
          <CommandCenterMap
            assets={assets}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
          />
        </div>

        {/* Center-Right & Far-Right Modules (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* Top Row: Live Weather & Dispatch Recommendation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Live Weather (Open-Meteo) */}
            <div className="liquid-glass p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase text-gray-300">Live Weather (Open-Meteo)</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-gray-300 border border-white/20">LIVE</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌧️</span>
                <div>
                  <div className="text-lg font-black text-white font-mono">{Math.round(weather.temperature_c)}°C</div>
                  <div className="text-[11px] text-gray-300">{weather.condition}</div>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10 text-center">
                <div className="neumorphic-well p-1">
                  <span className="text-[8px] text-gray-400 block">Rainfall</span>
                  <span className="text-[11px] font-black text-white font-mono">{weather.rainfall_rate_mm_hr} mm/h</span>
                </div>
                <div className="neumorphic-well p-1">
                  <span className="text-[8px] text-gray-400 block">Wind</span>
                  <span className="text-[11px] font-black text-white font-mono">{weather.wind_speed_kmh} km/h</span>
                </div>
                <div className="neumorphic-well p-1">
                  <span className="text-[8px] text-gray-400 block">Humidity</span>
                  <span className="text-[11px] font-black text-white font-mono">{weather.humidity_pct}%</span>
                </div>
              </div>
            </div>

            {/* Dispatch Recommendation (Red emergency beacon border) */}
            <div className="liquid-glass p-3.5 border border-rose-500/50 shadow-[0_0_20px_rgba(239,68,68,0.25)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-rose-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    Dispatch Directive
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    ETA 12m
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{resourceReadiness.team_name}</h4>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  Target: <strong className="text-white">{resourceReadiness.assigned_target}</strong>
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5 truncate">{resourceReadiness.equipment}</p>
              </div>
              <button
                onClick={() => setShowTeamModal(true)}
                className="mt-2 w-full btn-liquid text-[11px] py-1 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{isDispatched ? "✓ Dispatched (View)" : "View Team Details →"}</span>
              </button>
            </div>
          </div>

          {/* Live Sensor Data: Dual .neumorphic-well telemetry tiles for H01 and B17 */}
          <div className="liquid-glass p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-gray-300">Live Sensor Data</span>
                <span className="text-[9px] font-mono text-gray-400">(Dual ESP32 Telemetry)</span>
              </div>
              <span className="text-[9px] text-emerald-400 font-medium">● Streaming Active</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Node 1: H01 Metro Hospital */}
              <div className="neumorphic-well p-2.5 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-white flex items-center gap-1">
                      🏥 Metro Hospital (H01)
                    </span>
                    <span className="text-[9px] text-gray-400">Sensor Pin 36 (VP)</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      h01.status === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {h01.status}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-black text-white font-mono">
                      {h01.water_level_cm.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1">cm</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-gray-400 block">Rise Rate</span>
                    <span className="text-[10px] font-mono text-rose-400 font-bold">
                      +{h01.rise_rate_cm_min.toFixed(1)} cm/min
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 text-[9px] text-gray-400 flex items-center justify-between border-t border-white/5 pt-1">
                  <span>
                    Risk: <strong className="text-rose-400">{Math.round(h01.risk_score)}</strong>/100
                  </span>
                  <span>
                    Priority: <strong className="text-white">#1</strong>
                  </span>
                </div>
              </div>

              {/* Node 2: B17 River Bridge */}
              <div className="neumorphic-well p-2.5 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-white flex items-center gap-1">
                      🌉 River Bridge (B17)
                    </span>
                    <span className="text-[9px] text-gray-400">Sensor Pin 32</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      b17.status === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {b17.status}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-black text-white font-mono">
                      {b17.water_level_cm.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-1">cm</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-gray-400 block">Rise Rate</span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                      +{b17.rise_rate_cm_min.toFixed(1)} cm/min
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 text-[9px] text-gray-400 flex items-center justify-between border-t border-white/5 pt-1">
                  <span>
                    Risk: <strong className="text-amber-400">{Math.round(b17.risk_score)}</strong>/100
                  </span>
                  <span>
                    Priority: <strong className="text-white">#2</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Far-Right Middle: Priority Ranking & Incident Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Priority Ranking Table */}
            <div id="priority-ranking-board" className="liquid-glass p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase text-gray-300">Priority Ranking</span>
                  <span className="text-[9px] text-gray-400 font-mono">Tie-Breaker Active</span>
                </div>
                <div className="space-y-1.5">
                  <div className="neumorphic-well p-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px]">
                        1
                      </span>
                      <span className="text-[10px] font-bold text-white">🏥 Metro Hospital (H01)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono font-bold text-rose-400">92</span>
                      <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-400">
                        CRITICAL
                      </span>
                    </div>
                  </div>
                  <div className="neumorphic-well p-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">
                        2
                      </span>
                      <span className="text-[10px] font-bold text-white">🌉 River Bridge (B17)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono font-bold text-amber-400">76</span>
                      <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-400">
                        HIGH
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 p-1.5 rounded bg-black/40 border border-white/10 text-[9px] text-gray-300">
                <strong>Tie-Breaker:</strong> Both nodes at 3.5 cm. H01 prioritized due to ICU beds & zero evacuation tolerance.
              </div>
            </div>

            {/* Incident Timeline Stepper */}
            <div id="incident-timeline" className="liquid-glass p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase text-gray-300">Incident Timeline</span>
                <span className="text-[9px] text-gray-400 font-mono">UTC +05:30</span>
              </div>
              <div className="space-y-1.5">
                {timeline.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs">
                    <span className="font-mono text-[9px] text-gray-400 shrink-0 mt-0.5">{item.time}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        item.severity === "CRITICAL"
                          ? "bg-rose-500 animate-ping"
                          : item.severity === "DISPATCHED"
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-white text-[10px] leading-tight truncate">{item.event}</p>
                      <p className="text-[9px] text-gray-400 leading-tight truncate">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. BOTTOM ANALYTICS ROW                                               */}
      {/* ===================================================================== */}
      <section id="risk-intelligence-workspace" className="anim grid grid-cols-1 lg:grid-cols-12 gap-4 items-start" style={{ "--d": "0.3s" } as React.CSSProperties}>
        {/* Asset Details (4 cols) */}
        <div id="asset-profile-registry" className="lg:col-span-4 liquid-glass p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-300">Asset Profile Registry</span>
            <span className="text-[9px] text-gray-400 font-mono">Layer 3 Digital Twin</span>
          </div>

          <div className="neumorphic-well p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white">🏥 Metro Hospital (H01)</span>
              <span className="text-[9px] font-bold text-rose-400">Criticality: 10/10</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-300">
              <div>
                Pop: <strong className="text-white">{h01.population_served?.toLocaleString()}</strong>
              </div>
              <div>
                ICU Beds: <strong className="text-white">{h01.icu_beds || 120}</strong>
              </div>
              <div>
                Evacuation: <strong className="text-rose-300">{h01.evacuation_tolerance || "Zero"}</strong>
              </div>
              <div>
                Basin: <strong className="text-white">{h01.elevation_risk || "Depression Basin"}</strong>
              </div>
            </div>
          </div>

          <div className="neumorphic-well p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white">🌉 River Bridge (B17)</span>
              <span className="text-[9px] font-bold text-amber-400">Criticality: 6/10</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-300">
              <div>
                Daily Traffic: <strong className="text-white">{b17.daily_traffic?.toLocaleString() || "8,000"}</strong>
              </div>
              <div>
                Alt Route: <strong className="text-white">{b17.alternate_route || "No"}</strong>
              </div>
              <div>
                Elevation: <strong className="text-white">{b17.elevation_risk || "Channel Flow"}</strong>
              </div>
              <div>
                Water: <strong className="text-white">{b17.water_level_cm.toFixed(1)} cm</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Explainable AI - "Why H01?" (.liquid-glass container, 4 cols) */}
        <div id="explainable-ai-section" className="lg:col-span-4 liquid-glass p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase text-gray-300">Explainable AI — "Why H01?"</span>
              <span className="text-[9px] text-gray-400 font-mono">SHAP Weights</span>
            </div>

            <div className="flex items-center gap-3.5 mb-3">
              {/* Circular Radial Gauge */}
              <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                <svg className="w-18 h-18 -rotate-90">
                  <circle
                    cx="36"
                    cy="36"
                    r={gaugeRadius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r={gaugeRadius}
                    fill="transparent"
                    stroke="#ef4444"
                    strokeWidth="5"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span
                    className="text-base font-black text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {Math.round(explainableAi.risk_score)}
                  </span>
                  <span className="text-[8px] uppercase text-gray-400 font-bold">Risk</span>
                </div>
              </div>

              {/* Factor Contribution Bars */}
              <div className="flex-1 space-y-1 text-[9px]">
                {Object.entries(explainableAi.factor_breakdown).map(([factor, weight]) => (
                  <div key={factor}>
                    <div className="flex justify-between text-gray-300 mb-0.5">
                      <span>{factor}</span>
                      <span className="font-mono text-white font-semibold">{weight}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-white h-1 rounded-full transition-all duration-500"
                        style={{ width: `${weight * 2.5}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rationale Box */}
          <div className="neumorphic-well p-2.5 text-[10px] text-gray-300 leading-relaxed border-l-2 border-l-rose-500">
            <strong className="text-white block mb-0.5">Decision Rationale:</strong>
            "{explainableAi.rationale}"
          </div>
        </div>

        {/* Resource & Team Readiness + Recent Alerts (4 cols) */}
        <div className="lg:col-span-4 liquid-glass p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-gray-300">Resource & Team Readiness</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                {resourceReadiness.status}
              </span>
            </div>

            <div className="neumorphic-well p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white">{resourceReadiness.team_name}</span>
                <span className="text-[10px] font-mono text-gray-300">{resourceReadiness.members_count} Personnel</span>
              </div>
              <p className="text-[10px] text-gray-300">
                Assigned: <strong className="text-white">{resourceReadiness.assigned_target}</strong>
              </p>
              <p className="text-[9px] text-gray-400">Kit: {resourceReadiness.equipment}</p>
              <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Target ETA</span>
                <span className="font-bold text-emerald-400 font-mono">{resourceReadiness.eta_minutes} mins</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts Feed */}
          <div>
            <span className="text-[11px] font-bold uppercase text-gray-300 block mb-1.5">Recent Alerts Feed</span>
            <div className="space-y-1 max-h-[90px] overflow-y-auto pr-1">
              {timeline.map((item, idx) => (
                <div key={idx} className="neumorphic-well p-1.5 flex items-center justify-between text-[9px]">
                  <span className="text-gray-300 truncate max-w-[210px]">{item.event}</span>
                  <span className="font-mono text-gray-400">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
        </main>
      </div>

      {/* ===================================================================== */}
      {/* 5. EMERGENCY DISPATCH DIRECTIVE MODAL                                 */}
      {/* ===================================================================== */}
      {showTeamModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="liquid-glass rounded-2xl max-w-md w-full p-5 border border-white/20 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-sm font-bold text-white">Emergency Dispatch Directive</h3>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="text-gray-400 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="neumorphic-well p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Assigned Unit:</span>
                  <strong className="text-white">{resourceReadiness.team_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Facility:</span>
                  <strong className="text-rose-400">{resourceReadiness.assigned_target}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Personnel:</span>
                  <strong className="text-white">{resourceReadiness.members_count} High-Hazard Rescue Officers</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Equipment Load:</span>
                  <strong className="text-white">{resourceReadiness.equipment}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Projected ETA:</span>
                  <strong className="text-emerald-400 font-mono font-bold">{resourceReadiness.eta_minutes} Minutes</strong>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 italic">
                Notice: Executing this dispatch will notify the municipal field radio, silence station sirens, and log deployment telemetry to municipal incident records.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchAction}
                className="btn-liquid text-xs py-1.5 px-3.5 flex items-center gap-1.5 bg-rose-600 hover:bg-white hover:text-black border border-rose-500 font-bold"
              >
                <span>Confirm & Dispatch Alpha</span>
                <span>🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
