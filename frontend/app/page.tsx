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
  TrendingUpIcon,
  VideoIcon,
  ClockIcon,
  SparklesIcon,
  FileTextIcon,
  DownloadIcon,
  PrinterIcon,
  EyeIcon,
  MapPinIcon,
  BarChart3Icon
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
    priority_score: 95.0,
    risk_score: 95.0,
    priority_rank: 1,
    status: "CRITICAL",
    led_safe: false,
    led_critical: true,
    shap_breakdown: {
      "IoT Depth & Rise Rate": 20,
      "Infrastructure Criticality": 35,
      "Population Exposure": 25,
      "Satellite GIS Risk": 10,
      "Historical Baseline": 5,
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
    priority_score: 75.0,
    risk_score: 75.0,
    priority_rank: 2,
    status: "HIGH",
    led_safe: true,
    led_critical: false,
    shap_breakdown: {
      "IoT Depth & Rise Rate": 20,
      "Infrastructure Criticality": 20,
      "Population Exposure": 15,
      "Satellite GIS Risk": 10,
      "Historical Baseline": 10,
    },
  },
  {
    asset_id: "D03",
    name: "Drain D03 (Adyar Sluice)",
    type: "Drain",
    criticality: 22.0,
    population_served: 12000,
    water_level_cm: 2.2,
    rise_rate_cm_min: 0.3,
    priority_score: 74.0,
    risk_score: 74.0,
    priority_rank: 3,
    status: "HIGH",
    led_safe: true,
    led_critical: false,
  },
  {
    asset_id: "R08",
    name: "Inner Ring Expressway (R08)",
    type: "Road",
    criticality: 18.0,
    population_served: 28000,
    water_level_cm: 1.1,
    rise_rate_cm_min: 0.1,
    priority_score: 61.0,
    risk_score: 61.0,
    priority_rank: 4,
    status: "MEDIUM",
    led_safe: true,
    led_critical: false,
  },
  {
    asset_id: "S05",
    name: "Central Substation (S05)",
    type: "Substation",
    criticality: 24.0,
    population_served: 32000,
    water_level_cm: 0.8,
    rise_rate_cm_min: 0.05,
    priority_score: 52.0,
    risk_score: 52.0,
    priority_rank: 5,
    status: "MEDIUM",
    led_safe: true,
    led_critical: false,
  },
  {
    asset_id: "B21",
    name: "Port Bridge (B21)",
    type: "Bridge",
    criticality: 15.0,
    population_served: 8000,
    water_level_cm: 0.3,
    rise_rate_cm_min: 0.0,
    priority_score: 48.0,
    risk_score: 48.0,
    priority_rank: 6,
    status: "LOW",
    led_safe: true,
    led_critical: false,
  },
  {
    asset_id: "D07",
    name: "Primary Drain (D07)",
    type: "Drain",
    criticality: 12.0,
    population_served: 6000,
    water_level_cm: 0.2,
    rise_rate_cm_min: 0.0,
    priority_score: 42.0,
    risk_score: 42.0,
    priority_rank: 7,
    status: "LOW",
    led_safe: true,
    led_critical: false,
  },
];

const DEFAULT_TEAMS: TeamItem[] = [
  {
    team_id: "TEAM-A",
    team_name: "Team Alpha",
    specialty: "Rapid Response & ICU Protection",
    hazard_domain: "FLOOD",
    status: "DISPATCHED",
    current_assignment: "Metro Hospital (H01)",
  },
  {
    team_id: "TEAM-B",
    team_name: "Team Beta",
    specialty: "Canal Desiltation & Flow Defense",
    hazard_domain: "FLOOD",
    status: "DISPATCHED",
    current_assignment: "Drain D03",
  },
  {
    team_id: "TEAM-C",
    team_name: "Team Gamma",
    specialty: "Arterial Road Diversion & Traffic Patrol",
    hazard_domain: "FLOOD",
    status: "AVAILABLE",
    current_assignment: "Ring Road (R08)",
  },
];

export default function OracleCommandCenter() {
  const [selectedAssetId, setSelectedAssetId] = useState<string>("H01");
  const [activeNavTab, setActiveNavTab] = useState<string>("dashboard");
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<string>("equal_surge");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isDispatched, setIsDispatched] = useState<boolean>(false);

  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);

  // Dynamic Live Clock
  const [currentUtcTime, setCurrentUtcTime] = useState<string>("");

  // Live Backend State
  const [assets, setAssets] = useState<AssetMonitoringData[]>(DEFAULT_ASSETS);
  const [topPriority, setTopPriority] = useState<string>("H01");
  const [buzzer, setBuzzer] = useState<boolean>(false);
  const [buzzerSilenced, setBuzzerSilenced] = useState<boolean>(false);
  const [recommendedAction, setRecommendedAction] = useState<string>(
    "PRIORITY 1 DIRECTIVE: Dispatch Rapid Response Team Alpha with mobile high-capacity dewatering pumps to Metro Hospital (H01) basement substation."
  );
  const [actionLevel, setActionLevel] = useState<"CRITICAL" | "MODERATE" | "SAFE">("CRITICAL");
  const [teams, setTeams] = useState<TeamItem[]>(DEFAULT_TEAMS);
  const [criticalAssetsCount, setCriticalAssetsCount] = useState<number>(1);
  const [highRiskAssetsCount, setHighRiskAssetsCount] = useState<number>(3);
  const [totalMonitoredCount, setTotalMonitoredCount] = useState<number>(27);
  const [systemStatusLabel, setSystemStatusLabel] = useState<string>("ACTION DISPATCHED");
  const [systemStatusSubtext, setSystemStatusSubtext] = useState<string>("ESP32 IoT + Sentinel-2 Stream Live");

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    device_id: "ORACLE-ESP32-01",
    status: "SIMULATION",
    mode: "SIMULATION",
    is_online: false,
    last_seen_sec: 9999,
  });

  const prevCriticalRef = useRef<boolean>(false);

  // Dynamic live clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC",
      };
      setCurrentUtcTime(`${now.toLocaleDateString("en-GB", options)} UTC`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

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

    if (typeof data.critical_assets_count === "number") {
      setCriticalAssetsCount(data.critical_assets_count);
    }
    if (typeof data.high_risk_assets_count === "number") {
      setHighRiskAssetsCount(data.high_risk_assets_count);
    }
    if (typeof data.total_monitored_assets_count === "number") {
      setTotalMonitoredCount(data.total_monitored_assets_count);
    }

    if (data.system_status_label) {
      setSystemStatusLabel(data.system_status_label);
    }
    if (data.system_status_subtext) {
      setSystemStatusSubtext(data.system_status_subtext);
    }

    if (data.teams && Array.isArray(data.teams)) {
      setTeams(data.teams);
    }
  }, []);

  // SSE Stream & fallback snapshot polling
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    // Initial snapshot fetch
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

    // Real-time SSE
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
      console.warn("SSE connection init error:", err);
    }

    // Fallback polling
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
        body: JSON.stringify({ team_id: "TEAM-A" }),
      });
    } catch (e) {
      console.warn("Assign endpoint fallback:", e);
    }

    setTeams((prev) =>
      prev.map((t) =>
        t.team_id === "TEAM-A"
          ? { ...t, status: "DISPATCHED", current_assignment: "Metro Hospital (H01) - En Route" }
          : t
      )
    );
  };

  // Quick Action Handler from Sidebar
  const handleQuickAction = (action: "priority" | "teams" | "report") => {
    if (action === "priority") {
      const el = document.getElementById("priority-ranking-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (action === "teams") {
      setShowTeamModal(true);
    } else if (action === "report") {
      setShowReportModal(true);
    }
  };

  // Asset Lookups
  const selectedAsset = useMemo(
    () => assets.find((a) => a.asset_id === selectedAssetId) || assets[0] || DEFAULT_ASSETS[0],
    [assets, selectedAssetId]
  );
  const h01 = useMemo(() => assets.find((a) => a.asset_id === "H01") || DEFAULT_ASSETS[0], [assets]);
  const b17 = useMemo(() => assets.find((a) => a.asset_id === "B17") || DEFAULT_ASSETS[1], [assets]);

  const isHardwareOnline = deviceStatus.is_online || deviceStatus.status === "ONLINE";

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex font-sans selection:bg-cyan-500 selection:text-black">
      {/* --------------------------------------------------------------------- */}
      {/* LEFT SIDEBAR NAVIGATION & QUICK ACTIONS                               */}
      {/* --------------------------------------------------------------------- */}
      <Sidebar
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        onQuickAction={handleQuickAction}
        criticalAlertsCount={criticalAssetsCount}
        isConnected={isHardwareOnline}
      />

      {/* --------------------------------------------------------------------- */}
      {/* MAIN COMMAND CENTER INTERFACE                                         */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* =================================================================== */}
        {/* TOP HEADER BAR                                                      */}
        {/* =================================================================== */}
        <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#1E3A5F] px-6 py-3 shadow-2xl">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            {/* Left: Brand & Subtitle */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10 shrink-0">
                <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
                  <polygon points="12 3 21 18 3 18" stroke="currentColor" strokeWidth="2" fill="rgba(6, 182, 212, 0.2)" />
                  <polygon points="12 9 17 17 7 17" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56, 189, 248, 0.4)" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-wider text-white">ORACLE EDGE</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 uppercase">
                    Command Center
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium tracking-tight">
                  Space-to-Ground Infrastructure Decision Intelligence Platform
                </p>
              </div>
            </div>

            {/* Right: Status, Live Clock, Admin Profile & Simulation Stage Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Simulation Quick-Click Buttons */}
              <div className="flex items-center gap-1 bg-[#132238] p-1 rounded-xl border border-[#1E3A5F]">
                <button
                  onClick={() => handleTriggerScenario("baseline")}
                  disabled={isSimulating}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeStage === "baseline"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : "text-slate-400 hover:text-white hover:bg-[#1E3A5F]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>1. Baseline (0.0 cm)</span>
                </button>

                <button
                  onClick={() => handleTriggerScenario("rain_start")}
                  disabled={isSimulating}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeStage === "rain_start"
                      ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                      : "text-slate-400 hover:text-white hover:bg-[#1E3A5F]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>2. Rain Inflow (1.5 cm)</span>
                </button>

                <button
                  onClick={() => handleTriggerScenario("equal_surge")}
                  disabled={isSimulating}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeStage === "equal_surge"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                      : "text-slate-400 hover:text-white hover:bg-[#1E3A5F]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>3. Equal Surge (3.5 cm)</span>
                </button>

                <button
                  onClick={() => handleTriggerScenario("emergency")}
                  disabled={isSimulating}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeStage === "emergency"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse"
                      : "text-slate-400 hover:text-white hover:bg-[#1E3A5F]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>4. Emergency Alert</span>
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F]">
                <span className={`w-2 h-2 rounded-full ${isHardwareOnline ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`} />
                <span className="text-[11px] font-bold text-slate-300">
                  {isHardwareOnline ? "System Online" : "Simulation Active"}
                </span>
              </div>

              {/* Live Ticking Clock */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] text-[11px] font-mono text-cyan-300">
                <ClockIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentUtcTime || "12 Oct 2024, 14:32:08 UTC"}</span>
              </div>

              {/* User Profile Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F]">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px] border border-cyan-500/40">
                  🏛️
                </div>
                <span className="text-[11px] font-bold text-slate-200">
                  Chennai Municipal Admin
                </span>
              </div>

              {/* Audio Alarm Mute Toggle */}
              <button
                onClick={handleToggleAudio}
                className="p-2 rounded-xl bg-[#132238] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-slate-300 transition-all cursor-pointer"
                title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {isAudioMuted ? <VolumeXIcon className="w-4 h-4 text-rose-400" /> : <Volume2Icon className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>
        </header>

        {/* =================================================================== */}
        {/* MAIN BODY WORKSPACE                                                 */}
        {/* =================================================================== */}
        <main className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* ================================================================= */}
          {/* TOP 4 METRIC STAT CARDS (Executive Summary Strip)                 */}
          {/* ================================================================= */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Critical Assets */}
            <div className="bg-[#132238] border border-rose-500/30 rounded-xl p-4.5 shadow-lg shadow-rose-500/5 relative overflow-hidden group hover:border-rose-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Critical Assets
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-400 font-mono">
                  {criticalAssetsCount}
                </span>
                <span className="text-xs font-bold text-rose-300/80">Asset</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Requires Immediate Intervention</p>
              <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:bg-rose-500/20 transition-all" />
            </div>

            {/* Card 2: High Risk Assets */}
            <div className="bg-[#132238] border border-amber-500/30 rounded-xl p-4.5 shadow-lg shadow-amber-500/5 relative overflow-hidden group hover:border-amber-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  High Risk Assets
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400 font-mono">
                  {highRiskAssetsCount}
                </span>
                <span className="text-xs font-bold text-amber-300/80">Assets</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Under Active Escalation Monitoring</p>
              <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
            </div>

            {/* Card 3: Total Monitored Assets */}
            <div className="bg-[#132238] border border-cyan-500/30 rounded-xl p-4.5 shadow-lg shadow-cyan-500/5 relative overflow-hidden group hover:border-cyan-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Monitored Assets
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-cyan-400 font-mono">
                  {totalMonitoredCount}
                </span>
                <span className="text-xs font-bold text-cyan-300/80">Network Nodes</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Regional Basin Coverage (Bridge, Drain, Road, Facilities)
              </p>
              <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all" />
            </div>

            {/* Card 4: System Status */}
            <div className="bg-[#132238] border border-emerald-500/30 rounded-xl p-4.5 shadow-lg shadow-emerald-500/5 relative overflow-hidden group hover:border-emerald-500/60 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  System Status
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-black text-emerald-400 font-mono tracking-tight uppercase">
                  {isDispatched ? "ACTION DISPATCHED" : criticalAssetsCount > 0 ? "ESCALATION DETECTED" : "ALL SYSTEMS NOMINAL"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                ESP32 IoT + Sentinel-2 Stream Live
              </p>
              <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
            </div>
          </section>

          {/* ================================================================= */}
          {/* CENTRAL WORKSPACE: ROW 1 (Map + 4 Real-Time Sensors + Banner)    */}
          {/* ================================================================= */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* MODULE A: Live Infrastructure Map (8 cols) */}
              <div className="lg:col-span-8 bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-xl flex flex-col justify-between">
                <CommandCenterMap
                  assets={assets}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={setSelectedAssetId}
                />
              </div>

              {/* MODULE B: Real-Time Sensor Metrics (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-3.5">
                {/* Header for Sensor Block */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <ActivityIcon className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Real-Time Sensor Telemetry
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-400 bg-[#132238] px-2 py-0.5 rounded border border-[#1E3A5F]">
                    Node: {selectedAsset.asset_id} ({selectedAsset.name.split(" ")[0]})
                  </span>
                </div>

                {/* Sensor Tile 1: Water Level */}
                <div className="bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 p-3.5 rounded-xl shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <DropletsIcon className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-slate-200">Water Level</span>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        selectedAsset.water_level_cm >= 4.0
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                          : selectedAsset.water_level_cm >= 3.0
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {selectedAsset.water_level_cm >= 4.0
                        ? "CRITICAL SURGE >= 4.0 cm"
                        : selectedAsset.water_level_cm >= 3.0
                        ? "YELLOW ALERT >= 3.0 cm"
                        : "< 30 cm Nominal"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <div className="text-2xl font-black text-white font-mono">
                      {selectedAsset.water_level_cm.toFixed(1)}{" "}
                      <span className="text-xs font-bold text-slate-400">cm</span>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-300">
                      Rise: {selectedAsset.rise_rate_cm_min >= 0 ? `+${selectedAsset.rise_rate_cm_min.toFixed(2)}` : selectedAsset.rise_rate_cm_min.toFixed(2)} cm/min
                    </span>
                  </div>
                  {/* Mini visual trend bar */}
                  <div className="h-1.5 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedAsset.water_level_cm >= 4.0
                          ? "bg-rose-500"
                          : selectedAsset.water_level_cm >= 3.0
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                      }`}
                      style={{ width: `${Math.min(100, (selectedAsset.water_level_cm / 5.0) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Sensor Tile 2: Rainfall Rate */}
                <div className="bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 p-3.5 rounded-xl shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <WavesIcon className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-slate-200">Rainfall Rate</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {selectedAsset.water_level_cm > 0.5 ? "Heavy Inflow Active" : "< 5 mm/hr Safe"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <div className="text-2xl font-black text-white font-mono">
                      {selectedAsset.water_level_cm > 0.5 ? "12.4" : "0.0"}{" "}
                      <span className="text-xs font-bold text-slate-400">mm/hr</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Catchment: Adyar</span>
                  </div>
                </div>

                {/* Sensor Tile 3: Temperature */}
                <div className="bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 p-3.5 rounded-xl shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <ThermometerIcon className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-slate-200">Ambient Surface Temp</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Normal Range
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <div className="text-2xl font-black text-white font-mono">
                      28.6 <span className="text-xs font-bold text-slate-400">°C</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Sensor Pin 36</span>
                  </div>
                </div>

                {/* Sensor Tile 4: Vibration / Scour */}
                <div className="bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 p-3.5 rounded-xl shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <CpuIcon className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-slate-200">Structural Vibration</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {selectedAsset.water_level_cm >= 3.0 ? "Wave Scour Waveform" : "Nominal Stability"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <div className="text-2xl font-black text-white font-mono">
                      {selectedAsset.water_level_cm >= 3.0 ? "0.82" : "0.04"}{" "}
                      <span className="text-xs font-bold text-slate-400">g</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">3-Axis Piezo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MODULE C: Recommended Action Banner (Spanning full width under Map/Sensors) */}
            <div className="bg-[#132238] border border-rose-500/40 rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3.5 flex-1">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-rose-500/10">
                  <span className="text-lg">🚨</span>
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-rose-500 text-white uppercase tracking-wider">
                      Priority 1 Directive
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                      Risk Score: {h01.risk_score.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono text-slate-300 bg-[#0B132B] px-2 py-0.5 rounded border border-[#1E3A5F]">
                      Est. Impact: 45,000 Persons
                    </span>
                    <span className="text-xs font-mono text-cyan-300 bg-[#0B132B] px-2 py-0.5 rounded border border-[#1E3A5F]">
                      Response ETA: 15 Mins
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                    {recommendedAction}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Assigned Unit: <strong className="text-slate-200">Team Alpha (ICU Inundation Defense)</strong> — Staged for rapid floodgate & pump deployment.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setShowDetailsModal(true)}
                  className="px-3.5 py-2.5 rounded-lg text-xs font-bold text-cyan-300 bg-[#0B132B] hover:bg-[#1E3A5F] border border-cyan-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <EyeIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>View Details →</span>
                </button>

                <button
                  onClick={handleAcknowledgeDispatch}
                  disabled={isDispatched}
                  className={`px-4 py-2.5 rounded-lg text-xs font-black tracking-wide transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
                    isDispatched
                      ? "bg-slate-800 text-emerald-400 border border-emerald-500/40 cursor-default"
                      : "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-600/30 active:scale-95 animate-pulse"
                  }`}
                >
                  {isDispatched ? (
                    <>
                      <CheckCircle2Icon className="w-4 h-4 text-emerald-400" />
                      <span>✓ Team Alpha Dispatched (Buzzer Silenced)</span>
                    </>
                  ) : (
                    <>
                      <span>🚨</span>
                      <span>Acknowledge & Dispatch Team Alpha</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* MIDDLE ROW: PRIORITY RANKING BOARD & TEAM ALLOCATION              */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" id="priority-ranking-section">
            {/* MODULE D: Priority Ranking Board (7 cols) */}
            <div className="lg:col-span-7 bg-[#132238] border border-[#1E3A5F] rounded-xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3Icon className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Priority Ranking Board
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-300 bg-[#0B132B] px-2 py-0.5 rounded border border-[#1E3A5F]">
                    Multi-Factor AI Triage
                  </span>
                </div>

                {/* Crucial Tie-Breaker Feature Banner */}
                <div className="mb-4 p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-200 flex items-start gap-2">
                  <span className="text-sm">⚖️</span>
                  <div>
                    <strong className="text-white">Crucial Multi-Factor Tie-Breaker:</strong> When both{" "}
                    <strong>Metro Hospital (H01)</strong> and <strong>River Bridge (B17)</strong> experience identical flood depth (3.5 cm),
                    H01 is definitively prioritized as <strong>#1 (Score 95.0)</strong> over B17 <strong>#2 (Score 75.0)</strong> because
                    hospital ICU bedridden patient vulnerability and critical life-support power supersede arterial bridge traffic.
                  </div>
                </div>

                {/* Ranked Assets Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1E3A5F] text-[10px] font-mono uppercase text-slate-400">
                        <th className="py-2 px-2 font-bold"># Rank</th>
                        <th className="py-2 px-2 font-bold">Asset Name</th>
                        <th className="py-2 px-2 font-bold">Type</th>
                        <th className="py-2 px-2 font-bold">Depth</th>
                        <th className="py-2 px-2 font-bold text-right">Risk Score</th>
                        <th className="py-2 px-2 font-bold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E3A5F]/60">
                      {assets.map((asset, idx) => {
                        const isH01 = asset.asset_id === "H01";
                        const isB17 = asset.asset_id === "B17";
                        const isSelected = selectedAssetId === asset.asset_id;

                        return (
                          <tr
                            key={asset.asset_id}
                            onClick={() => setSelectedAssetId(asset.asset_id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-cyan-500/15 text-white"
                                : isH01
                                ? "bg-rose-500/10 hover:bg-rose-500/15"
                                : "hover:bg-[#0B132B]/60"
                            }`}
                          >
                            <td className="py-2.5 px-2 font-mono font-bold">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  idx === 0
                                    ? "bg-rose-500 text-white font-black"
                                    : idx === 1
                                    ? "bg-amber-500/30 text-amber-300 font-bold"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{asset.asset_id === "H01" ? "🏥" : asset.asset_id === "B17" ? "🌉" : asset.asset_id === "D03" ? "🌊" : "📍"}</span>
                              <span>{asset.name}</span>
                              {isH01 && <span className="text-[9px] text-rose-400 font-mono">(ICU Life-Support)</span>}
                              {isB17 && <span className="text-[9px] text-amber-400 font-mono">(Pier Scour)</span>}
                            </td>
                            <td className="py-2.5 px-2 text-slate-400">{asset.type}</td>
                            <td className="py-2.5 px-2 font-mono text-cyan-300">
                              {asset.water_level_cm.toFixed(1)} cm
                            </td>
                            <td className="py-2.5 px-2 font-mono font-black text-right">
                              <span
                                className={`${
                                  asset.risk_score >= 85
                                    ? "text-rose-400"
                                    : asset.risk_score >= 60
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {asset.risk_score.toFixed(1)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  asset.status === "CRITICAL"
                                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                    : asset.status === "HIGH" || asset.status === "ELEVATED"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : asset.status === "MEDIUM"
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                }`}
                              >
                                {asset.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* MODULE E: Team Allocation Matrix (5 cols) */}
            <div className="lg:col-span-5 bg-[#132238] border border-[#1E3A5F] rounded-xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Active Resource Allocation
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowTeamModal(true)}
                    className="text-[10px] font-mono text-cyan-400 hover:text-white bg-[#0B132B] px-2 py-0.5 rounded border border-[#1E3A5F] cursor-pointer"
                  >
                    Rebalance Teams
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Team Alpha */}
                  <div className="p-3 rounded-lg bg-[#0B132B] border border-amber-500/40 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Team Alpha</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {isDispatched ? "En Route (High-Capacity Pump)" : "Deployed / En Route"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Assigned: <strong className="text-cyan-300">Metro Hospital (H01)</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        4 Members | ICU Inundation Defense & Dewatering Pump Kit
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold block">
                        ETA 12m
                      </span>
                    </div>
                  </div>

                  {/* Team Beta */}
                  <div className="p-3 rounded-lg bg-[#0B132B] border border-[#1E3A5F] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Team Beta</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          On Standby
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Assigned: <strong className="text-slate-200">Adyar Sluice (D03)</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        3 Members | Sluice Barrier Gate & Desiltation Kit
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                        Standby
                      </span>
                    </div>
                  </div>

                  {/* Team Gamma */}
                  <div className="p-3 rounded-lg bg-[#0B132B] border border-[#1E3A5F] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Team Gamma</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Available
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Assigned: <strong className="text-slate-200">Ring Road (R08)</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        2 Members | Traffic Diversion & Barricade Kit
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold block">
                        Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fast Reallocate Action */}
              <div className="mt-4 pt-3 border-t border-[#1E3A5F] flex items-center justify-between text-xs text-slate-400">
                <span>Total Response Personnel: <strong className="text-white">9 Officers</strong></span>
                <button
                  onClick={() => setShowTeamModal(true)}
                  className="text-cyan-400 hover:text-white font-bold cursor-pointer"
                >
                  Manage Deployments →
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* BOTTOM ROW: 4 ANALYTICS & INSIGHT MODULES                         */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MODULE F: Multi-Factor Risk Trend Chart */}
            <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <TrendingUpIcon className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold uppercase text-slate-200">
                      Risk Score Projection
                    </h4>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">Past 4h &rarr; +2h</span>
                </div>

                {/* SVG Line Chart */}
                <div className="h-32 w-full mt-2 relative">
                  <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    {/* Threshold 90 (Critical) line */}
                    <line x1="0" y1="15" x2="200" y2="15" stroke="#f43f5e" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                    {/* Threshold 75 (High) line */}
                    <line x1="0" y1="35" x2="200" y2="35" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />

                    {/* H01 Curve (Surging to 95) */}
                    <path
                      d="M 10 80 Q 50 75, 90 55 T 140 25 T 190 12"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {/* B17 Curve (Plateauing at 75) */}
                    <path
                      d="M 10 85 Q 50 82, 90 65 T 140 45 T 190 38"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />

                    {/* Peak Point for H01 */}
                    <circle cx="190" cy="12" r="3.5" fill="#f43f5e" />
                    {/* Peak Point for B17 */}
                    <circle cx="190" cy="38" r="3" fill="#38bdf8" />
                  </svg>
                  <div className="absolute top-1 right-2 text-[9px] font-mono text-rose-400">
                    Crit 90+
                  </div>
                  <div className="absolute top-7 right-2 text-[9px] font-mono text-amber-400">
                    High 75+
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-[#1E3A5F]">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-slate-300">H01 (95.0)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-slate-300">B17 (75.0)</span>
                </div>
              </div>
            </div>

            {/* MODULE G: Live CCTV / Camera Feed Frame */}
            <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <VideoIcon className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs font-bold uppercase text-slate-200">
                      Live CCTV: Cam-04
                    </h4>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    LIVE
                  </span>
                </div>

                {/* Video / Synthetic CCTV Frame */}
                <div className="h-32 w-full rounded-lg bg-slate-950 relative overflow-hidden border border-[#1E3A5F] flex items-center justify-center">
                  {/* Cyber Grid & Channel Graphics */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1E3A5F_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-cyan-950/60 to-transparent flex items-end justify-center pb-2">
                    <div className="text-[9px] font-mono text-cyan-300 bg-[#0B132B]/80 px-2 py-0.5 rounded border border-cyan-500/30">
                      WATER ACCUMULATION: 98.4%
                    </div>
                  </div>
                  {/* Cyber Bounding Box */}
                  <div className="absolute top-4 left-6 right-6 bottom-8 border border-dashed border-cyan-400/60 rounded flex items-start justify-between p-1 text-[8px] font-mono text-cyan-300">
                    <span>Adyar Sluice Basin</span>
                    <span>30 FPS | 1080p</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-[#1E3A5F] flex justify-between">
                <span>AI Optical Sensor</span>
                <span className="text-emerald-400">FEED STABLE</span>
              </div>
            </div>

            {/* MODULE H: Timestamped Recent Alerts Feed */}
            <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangleIcon className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase text-slate-200">
                      Recent Alerts
                    </h4>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">Live Log</span>
                </div>

                <div className="space-y-2 text-[11px] font-mono max-h-32 overflow-y-auto custom-scrollbar">
                  <div className="p-1.5 rounded bg-[#0B132B]/80 border-l-2 border-rose-500">
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span className="text-rose-400 font-bold">14:31:05</span>
                      <span>H01 Hospital</span>
                    </div>
                    <p className="text-[10px] text-slate-200 truncate">Rise rate exceeded +0.4 cm/min (CRITICAL)</p>
                  </div>

                  <div className="p-1.5 rounded bg-[#0B132B]/80 border-l-2 border-amber-400">
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span className="text-amber-400 font-bold">14:28:40</span>
                      <span>Triage Engine</span>
                    </div>
                    <p className="text-[10px] text-slate-200 truncate">Re-triaged H01 to Priority #1 (Score: 95.0)</p>
                  </div>

                  <div className="p-1.5 rounded bg-[#0B132B]/80 border-l-2 border-amber-400">
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span className="text-amber-400 font-bold">14:25:12</span>
                      <span>B17 River Bridge</span>
                    </div>
                    <p className="text-[10px] text-slate-200 truncate">Sensor entered Yellow Advisory (3.0 cm)</p>
                  </div>

                  <div className="p-1.5 rounded bg-[#0B132B]/80 border-l-2 border-cyan-400">
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span className="text-cyan-400 font-bold">14:20:00</span>
                      <span>Sentinel-2</span>
                    </div>
                    <p className="text-[10px] text-slate-200 truncate">NDWI refreshed: Basin Moisture 82%</p>
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono text-cyan-400 pt-2 border-t border-[#1E3A5F] text-right">
                <span>Auto-Archived to SQLite</span>
              </div>
            </div>

            {/* MODULE I: Chennai Weather Forecast & Basin Conditions */}
            <div className="bg-[#132238] border border-[#1E3A5F] rounded-xl p-4 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <WavesIcon className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold uppercase text-slate-200">
                      Chennai Weather & Basin
                    </h4>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">Open-Meteo</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-white font-mono">29°C</span>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Thunderstorm Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Humidity: <strong className="text-white">94%</strong> | Wind: <strong className="text-white">18 km/h NE</strong>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    3-Hour Forecast: <strong className="text-cyan-300">+25 mm expected</strong>
                  </p>
                  <p className="text-[10px] text-rose-300 font-mono">
                    Flood Hazard Index: Level 4/5 (Severe)
                  </p>
                </div>
              </div>

              <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-[#1E3A5F] flex justify-between">
                <span>Adyar Catchment</span>
                <span className="text-cyan-400">SAT FEED SYNCED</span>
              </div>
            </div>
          </div>
        </main>

        {/* =================================================================== */}
        {/* FOOTER: MISSION & UN SUSTAINABLE DEVELOPMENT GOALS                  */}
        {/* =================================================================== */}
        <footer className="mt-8 border-t border-[#1E3A5F] bg-[#0d1b2a] px-6 py-6 text-slate-400">
          <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="font-extrabold text-white text-sm tracking-wider">ORACLE EDGE</span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  v2.4 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Space-to-Ground Infrastructure Flood Triage & Closed-Loop Resource Allocation System
              </p>
              <p className="text-[11px] text-slate-400">
                Built for Smart Cities Mission & Municipal Disaster Management Authorities
              </p>
            </div>

            {/* UN SDG Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* SDG 9 */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 transition-all">
                <div className="w-6 h-6 rounded bg-[#F36D25] text-white flex items-center justify-center font-black text-xs">
                  9
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-black text-white block">SDG 9</span>
                  <span className="text-[9px] text-slate-400 block">Industry, Innovation & Infra</span>
                </div>
              </div>

              {/* SDG 11 */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 transition-all">
                <div className="w-6 h-6 rounded bg-[#F99D26] text-white flex items-center justify-center font-black text-xs">
                  11
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-black text-white block">SDG 11</span>
                  <span className="text-[9px] text-slate-400 block">Sustainable Cities & Comm.</span>
                </div>
              </div>

              {/* SDG 13 */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#132238] border border-[#1E3A5F] hover:border-cyan-500/40 transition-all">
                <div className="w-6 h-6 rounded bg-[#3F7E44] text-white flex items-center justify-center font-black text-xs">
                  13
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-black text-white block">SDG 13</span>
                  <span className="text-[9px] text-slate-400 block">Climate Action</span>
                </div>
              </div>
            </div>

            <div className="text-center md:text-right text-[11px] font-mono text-slate-400">
              <p>&copy; 2024 Oracle-Edge | All Systems Operational</p>
              <p className="text-cyan-400">Multi-Hazard Municipal Triage</p>
            </div>
          </div>
        </footer>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: VIEW DETAILS & MULTI-FACTOR SHAP BREAKDOWN                     */}
      {/* ===================================================================== */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#132238] border border-cyan-500/50 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🏥</span>
                <div>
                  <h3 className="text-base font-black text-white">
                    {selectedAsset.name} ({selectedAsset.asset_id}) - Multi-Factor Triage Matrix
                  </h3>
                  <p className="text-xs text-cyan-400 font-mono">
                    Type: {selectedAsset.type} | Population Impact: {selectedAsset.population_served.toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1E3A5F] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#0B132B] p-3 rounded-xl border border-[#1E3A5F]">
                <span className="text-xs font-bold text-slate-300">Composite Risk Score</span>
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {selectedAsset.risk_score.toFixed(1)} / 100
                </span>
              </div>

              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                Explainable Multi-Layer Point Contribution (SHAP Analysis):
              </h4>

              <div className="space-y-2 text-xs font-mono">
                <div className="bg-[#0B132B] p-2.5 rounded-lg border border-[#1E3A5F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500" />
                    <span>IoT Depth & Rate of Rise:</span>
                  </div>
                  <span className="font-bold text-blue-400">
                    +{((selectedAsset.shap_breakdown?.["IoT Depth & Rise Rate"] ?? 20.0)).toFixed(1)} pts
                  </span>
                </div>

                <div className="bg-[#0B132B] p-2.5 rounded-lg border border-[#1E3A5F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                    <span>Infrastructure Criticality (ICU Lifeline):</span>
                  </div>
                  <span className="font-bold text-amber-400">
                    +{((selectedAsset.shap_breakdown?.["Infrastructure Criticality"] ?? 35.0)).toFixed(1)} pts
                  </span>
                </div>

                <div className="bg-[#0B132B] p-2.5 rounded-lg border border-[#1E3A5F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-purple-500" />
                    <span>Population Exposure:</span>
                  </div>
                  <span className="font-bold text-purple-400">
                    +{((selectedAsset.shap_breakdown?.["Population Exposure"] ?? 25.0)).toFixed(1)} pts
                  </span>
                </div>

                <div className="bg-[#0B132B] p-2.5 rounded-lg border border-[#1E3A5F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-500" />
                    <span>Satellite NDWI GIS Drainage Risk:</span>
                  </div>
                  <span className="font-bold text-cyan-400">
                    +{((selectedAsset.shap_breakdown?.["Satellite GIS Risk"] ?? 10.0)).toFixed(1)} pts
                  </span>
                </div>

                <div className="bg-[#0B132B] p-2.5 rounded-lg border border-[#1E3A5F] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-slate-400" />
                    <span>Historical Vulnerability Baseline:</span>
                  </div>
                  <span className="font-bold text-slate-300">
                    +{((selectedAsset.shap_breakdown?.["Historical Baseline"] ?? 5.0)).toFixed(1)} pts
                  </span>
                </div>
              </div>

              {/* Formulation Callout */}
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200">
                <strong>Algorithmic Guarantee:</strong> Even if water level is identical across bridge and hospital,
                the hospital's higher vulnerability weighting guarantees prioritized dispatch of high-capacity pumps
                to secure power and oxygen generators.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: INCIDENT TRIAGE REPORT                                         */}
      {/* ===================================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#132238] border border-[#1E3A5F] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2">
                <FileTextIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Incident Triage Situation Report
                </h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1E3A5F] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0B132B] border border-[#1E3A5F] space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Report ID:</span>
                  <span className="text-cyan-300">RPT-2024-CHN-0089</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-white">{currentUtcTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Authority:</span>
                  <span className="text-white">Chennai Disaster Management Cell</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Priority 1 Target:</span>
                  <span className="text-rose-400 font-bold">Metro Hospital (H01) - 95.0 Risk</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dispatched Team:</span>
                  <span className="text-amber-400 font-bold">Rapid Response Team Alpha</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Summary: Inundation risk model triggered Tier 1 emergency protocol following +0.4 cm/min rise rate
                in the Adyar Basin. Rapid dewatering units mobilized to prevent ICU power grid disruption.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-3.5 py-2 rounded-lg bg-[#0B132B] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <PrinterIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Print PDF</span>
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TEAM ALLOCATION MANAGEMENT                                     */}
      {/* ===================================================================== */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#132238] border border-[#1E3A5F] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Municipal Team Allocation & Dispatch
                </h3>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1E3A5F] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {teams.map((team) => (
                <div
                  key={team.team_id}
                  className="p-3 rounded-lg bg-[#0B132B] border border-[#1E3A5F] flex items-center justify-between text-xs"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm">{team.team_name}</h4>
                    <p className="text-[11px] text-slate-400">{team.specialty}</p>
                    <p className="text-[10px] text-cyan-300 font-mono mt-0.5">
                      Current Target: {team.current_assignment || "Unassigned"}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      team.status === "DISPATCHED"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    }`}
                  >
                    {team.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
