"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import CommandCenterMap from "./components/CommandCenterMap";
import PriorityPanel from "./components/PriorityPanel";
import DualMonitoringCards from "./components/DualMonitoringCards";
import NodeRegistrationModal from "./components/NodeRegistrationModal";
import ActionCenter from "./components/ActionCenter";
import CursorGlow, { triggerHaptic } from "./components/CursorGlow";
import ShapExplainabilityPanel from "./components/ShapExplainabilityPanel";
import TelemetryRiskTrendChart, { TelemetryPoint } from "./components/TelemetryRiskTrendChart";
import { useTheme } from "./context/ThemeContext";
import IncidentReportModal from "./components/IncidentReportModal";
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
  FlameIcon,
  HammerIcon,
  UsersIcon,
  SlidersIcon,
  BarChart3Icon,
  SunIcon,
  MoonIcon,
  Volume2Icon,
  VolumeXIcon,
  FileTextIcon,
} from "./components/Icons";
import { AssetMonitoringData, ActionItem, TeamItem, DeviceStatus } from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

const DEFAULT_ASSETS: AssetMonitoringData[] = [
  {
    asset_id: "H01",
    name: "Metro Hospital",
    type: "Hospital",
    domain: "URBAN_INFRASTRUCTURE",
    target_hazard: "FLOOD",
    criticality: 0.95,
    population_served: 45000,
    water_level_cm: 21.5,
    rise_rate_cm_min: 1.8,
    priority_score: 46.2,
    risk_score: 92.0,
    priority_rank: 1,
    status: "CRITICAL",
    led_safe: false,
    led_critical: true,
  },
  {
    asset_id: "B17",
    name: "Adyar River Bridge",
    type: "Bridge",
    domain: "URBAN_INFRASTRUCTURE",
    target_hazard: "FLOOD",
    criticality: 0.75,
    population_served: 15000,
    water_level_cm: 16.0,
    rise_rate_cm_min: 0.6,
    priority_score: 36.5,
    risk_score: 76.0,
    priority_rank: 2,
    status: "SAFE",
    led_safe: true,
    led_critical: false,
  },
];

// Helper to generate a realistic initial 15-minute rolling window leading up to live state
const generateInitialTelemetryHistory = (): TelemetryPoint[] => {
  const points: TelemetryPoint[] = [];
  const now = Date.now();
  for (let i = 14; i >= 0; i--) {
    const d = new Date(now - i * 60 * 1000);
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const progress = (14 - i) / 14;
    const water = Number((8.0 + progress * 13.5).toFixed(1));
    const risk = Number(Math.round(35.0 + progress * 57.0));
    points.push({ time: timeStr, waterLevel: water, riskScore: risk });
  }
  return points;
};

export default function OracleCommandCenter() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("H01");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(3);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

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
    triggerHaptic([20]);
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    setAudioMuted(nextMuted);
  };

  // Live Dashboard State
  const [assets, setAssets] = useState<AssetMonitoringData[]>(DEFAULT_ASSETS);
  const [topPriority, setTopPriority] = useState<string>("H01");
  const [buzzer, setBuzzer] = useState<boolean>(true);
  const [recommendedAction, setRecommendedAction] = useState<string>(
    "Dispatch Flood Barriers & Emergency Crew to H01 Hospital"
  );
  const [actionLevel, setActionLevel] = useState<"CRITICAL" | "MODERATE" | "SAFE">("CRITICAL");
  const [lastTelemetryTime, setLastTelemetryTime] = useState<string>("Active Feed");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [availableTeamsCount, setAvailableTeamsCount] = useState<number>(3);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(3);
  const [buzzerSilenced, setBuzzerSilenced] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<{ open_meteo: string; sentinel_2: string }>({
    open_meteo: "LIVE",
    sentinel_2: "FALLBACK",
  });
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    device_id: "ORACLE-ESP32-01",
    status: "ONLINE",
    last_seen_sec: 0,
  });
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(generateInitialTelemetryHistory);
  const prevCriticalRef = React.useRef<boolean>(true);

  // Apply new state from backend snapshot / SSE event
  const applyStateUpdate = useCallback((data: any) => {
    if (!data) return;

    if (data.device_status) {
      setDeviceStatus(data.device_status);
    } else if (
      data.device_id &&
      (data.status === "ONLINE" || data.status === "OFFLINE") &&
      typeof data.last_seen_sec === "number"
    ) {
      setDeviceStatus({
        device_id: data.device_id,
        status: data.status,
        last_seen_sec: data.last_seen_sec,
        last_seen: data.last_seen,
      });
    }

    if (data.assets && Array.isArray(data.assets)) {
      setAssets(data.assets);
      const isNowCritical = data.assets.some((a: any) => a.status === "CRITICAL") || data.buzzer === true;
      if (!prevCriticalRef.current && isNowCritical) {
        triggerHaptic([30, 20, 30]);
        playCriticalAlert();
      }
      prevCriticalRef.current = isNowCritical;

      // Update rolling telemetry history for active asset
      const active = data.assets.find((a: any) => a.asset_id === selectedAssetId) || data.assets[0];
      if (active) {
        const timeStr = data.timestamp
          ? new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const waterVal = Number((active.water_level_cm ?? active.surface_temp_c ?? active.tilt_deg ?? 0).toFixed(1));
        const riskVal = Number(Math.round(active.risk_score ?? 0));
        setTelemetryHistory((prev) => [...prev.slice(1), { time: timeStr, waterLevel: waterVal, riskScore: riskVal }]);
      }
    }
    if (data.actions && Array.isArray(data.actions)) {
      setActions(data.actions);
    }
    if (data.teams && Array.isArray(data.teams)) {
      setTeams(data.teams);
    }
    if (typeof data.available_teams_count === "number") {
      setAvailableTeamsCount(data.available_teams_count);
    }
    if (typeof data.total_teams_count === "number") {
      setTotalTeamsCount(data.total_teams_count);
    }
    if (typeof data.buzzer_silenced === "boolean") {
      setBuzzerSilenced(data.buzzer_silenced);
    }
    if (data.top_priority) {
      setTopPriority(data.top_priority);
    }
    if (typeof data.buzzer === "boolean") {
      setBuzzer(data.buzzer);
    }
    if (data.recommended_action) {
      setRecommendedAction(data.recommended_action);
    }
    if (data.action_level) {
      setActionLevel(data.action_level);
    }
    if (data.api_status) {
      setApiStatus({
        open_meteo: data.api_status.open_meteo || "LIVE",
        sentinel_2: data.api_status.sentinel_2 || "FALLBACK",
      });
    }
    if (data.timestamp) {
      const date = new Date(data.timestamp);
      setLastTelemetryTime(date.toLocaleTimeString());
    }
  }, [selectedAssetId]);

  // 1. Initial State Fetch + 2. Real-Time SSE Stream Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    // Fetch initial snapshot immediately
    fetch(`${API_BASE_URL}/api/v1/dashboard/state`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data) {
          applyStateUpdate(data);
        }
      })
      .catch((err) => {
        console.warn("Backend snapshot initial fetch:", err);
      });

    // Establish live SSE stream
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/stream`);

      eventSource.onopen = () => {
        if (isSubscribed) {
          setIsConnected(true);
        }
      };

      eventSource.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const parsed = JSON.parse(event.data);
          applyStateUpdate(parsed);
          setIsConnected(true);
        } catch (e) {
          console.error("SSE JSON parsing error:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection error / reconnecting...", err);
        if (isSubscribed) {
          setIsConnected(false);
        }
      };
    } catch (err) {
      console.error("Failed to initialize SSE EventSource:", err);
      setIsConnected(false);
    }

    // Polling fallback every 3.5 seconds
    const interval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/state`);
        if (res.ok) {
          const snapshot = await res.json();
          if (isSubscribed) {
            applyStateUpdate(snapshot);
            setIsConnected(true);
          }
        }
      } catch {
        // SSE handles live communication
      }
    }, 3500);

    return () => {
      isSubscribed = false;
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [applyStateUpdate]);

  // Evaluator Step Trigger (Safe -> Rise -> Critical)
  const handleEvaluatorStep = async (step: 1 | 2 | 3) => {
    setActiveStep(step);
    setIsTransmitting(true);
    triggerHaptic([30, 20, 30]);

    let readings: any[] = [];
    if (step === 1) {
      // Step 1: Safe baseline
      prevCriticalRef.current = false;
      setBuzzer(false);
      setActionLevel("SAFE");
      setAssets((prev) =>
        prev.map((a) => ({
          ...a,
          status: "SAFE",
          water_level_cm: a.asset_id === "H01" ? 6.2 : 5.8,
          rise_rate_cm_min: 0.1,
          risk_score: 24.0,
          led_safe: true,
          led_critical: false,
        }))
      );
      readings = [
        { sensor_id: "SNS-H01", asset_id: "H01", water_level_cm: 6.2, rise_rate_cm_min: 0.1 },
        { sensor_id: "SNS-B17", asset_id: "B17", water_level_cm: 5.8, rise_rate_cm_min: 0.1 },
      ];
    } else if (step === 2) {
      // Step 2: Rising elevated water
      prevCriticalRef.current = false;
      setBuzzer(false);
      setActionLevel("MODERATE");
      setAssets((prev) =>
        prev.map((a) => ({
          ...a,
          status: "MODERATE",
          water_level_cm: a.asset_id === "H01" ? 15.4 : 16.0,
          rise_rate_cm_min: 0.8,
          risk_score: 65.0,
          led_safe: false,
          led_critical: false,
        }))
      );
      readings = [
        { sensor_id: "SNS-H01", asset_id: "H01", water_level_cm: 15.4, rise_rate_cm_min: 0.8 },
        { sensor_id: "SNS-B17", asset_id: "B17", water_level_cm: 16.0, rise_rate_cm_min: 0.6 },
      ];
    } else {
      // Step 3: Critical (72cm full-scale / 21.5cm tabletop danger)
      const wasNotCritical = !prevCriticalRef.current;
      prevCriticalRef.current = true;
      setBuzzer(true);
      setActionLevel("CRITICAL");
      setAssets((prev) =>
        prev.map((a) => ({
          ...a,
          status: a.asset_id === "H01" ? "CRITICAL" : "MODERATE",
          water_level_cm: a.asset_id === "H01" ? 21.5 : 18.5,
          rise_rate_cm_min: a.asset_id === "H01" ? 1.8 : 1.2,
          risk_score: a.asset_id === "H01" ? 92.0 : 76.0,
          led_safe: false,
          led_critical: a.asset_id === "H01",
        }))
      );
      if (wasNotCritical) {
        playCriticalAlert();
      }
      readings = [
        { sensor_id: "SNS-H01", asset_id: "H01", water_level_cm: 21.5, rise_rate_cm_min: 1.8 },
        { sensor_id: "SNS-B17", asset_id: "B17", water_level_cm: 18.5, rise_rate_cm_min: 1.2 },
      ];
    }

    // Immediately push new point to the trend chart for instantaneous UI reactivity
    const stepWater = step === 1 ? 6.2 : step === 2 ? 15.4 : 21.5;
    const stepRisk = step === 1 ? 24 : step === 2 ? 65 : 92;
    const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTelemetryHistory((prev) => [...prev.slice(1), { time: nowStr, waterLevel: stepWater, riskScore: stepRisk }]);

    try {
      await fetch(`${API_BASE_URL}/api/v1/sensors/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: "ORACLE-ESP32-01",
          readings,
        }),
      });
    } catch (err) {
      console.error("Evaluator trigger error:", err);
    } finally {
      setTimeout(() => setIsTransmitting(false), 300);
    }
  };


  // Dispatch Team Action Handler
  const handleAssignTeam = async (actionId: string, teamIdOrName?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: teamIdOrName, team_id: teamIdOrName }),
      });
      if (res.ok) {
        const updatedAction = await res.json();
        setActions((prev) =>
          prev.map((a) => (a.action_id === updatedAction.action_id ? updatedAction : a))
        );
        setBuzzerSilenced(true);
        setBuzzer(false);
        setAvailableTeamsCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Assign team error:", err);
    }
  };

  // Complete Action Incident Handler
  const handleCompleteAction = async (actionId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/actions/${actionId}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        const updatedAction = await res.json();
        setActions((prev) =>
          prev.map((a) => (a.action_id === updatedAction.action_id ? updatedAction : a))
        );
        setAvailableTeamsCount((prev) => Math.min(totalTeamsCount, prev + 1));
      }
    } catch (err) {
      console.error("Complete action error:", err);
    }
  };

  const handleRegisterSuccess = (newAsset: any) => {
    if (newAsset && newAsset.asset_id) {
      setSelectedAssetId(newAsset.asset_id);
    }
  };

  const criticalCount = assets.filter((a) => a.status === "CRITICAL").length;
  const currentSelectedAsset = assets.find((a) => a.asset_id === selectedAssetId) || assets[0];

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white relative overflow-hidden transition-colors duration-200">
      {/* Ambient Cursor Spotlight */}
      <CursorGlow />

      {/* Dynamic Node Registration Modal */}
      <NodeRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegisterSuccess={handleRegisterSuccess}
        apiBaseUrl={API_BASE_URL}
      />

      {/* Official Incident Dispatch Report Modal */}
      <IncidentReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedAsset={currentSelectedAsset}
        actions={actions}
        teams={teams}
        apiStatus={apiStatus}
      />

      {/* Left Navigation Bar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        criticalAlertsCount={criticalCount}
        isConnected={isConnected}
      />

      {/* Main Command Center Layout */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative z-20">
        {/* Top Executive Status Bar */}
        <header className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-lg sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 shadow-sm dark:shadow-xl transition-colors duration-200">
          {/* System Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-500 dark:text-cyan-400 shadow-md shadow-cyan-500/10 shrink-0">
              <ShieldIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-wide">
                  ORACLE Edge
                </h1>
                <span className="text-slate-400 dark:text-slate-600 font-bold">|</span>
                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold tracking-wide">
                  Multi-Hazard Decision Intelligence
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Space-to-Ground Real-Time Triage Command Center
              </p>
            </div>
          </div>

          {/* Quick Status Badges */}
          <div className="hidden xl:flex items-center gap-2.5">
            {/* ESP32 Hardware Node Watchdog Connection Badge */}
            <div
              title={`ESP32 Hardware Node (8.0s timeout). Last seen: ${deviceStatus.last_seen_sec}s ago`}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                deviceStatus.status === "ONLINE"
                  ? "bg-slate-100 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  : "bg-amber-500/15 dark:bg-amber-950/50 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm animate-pulse"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    deviceStatus.status === "ONLINE" ? "bg-emerald-400" : "bg-amber-500"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    deviceStatus.status === "ONLINE" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <span className="font-mono">
                {deviceStatus.status === "ONLINE"
                  ? `ESP32 Node: ONLINE (${Math.max(1, deviceStatus.last_seen_sec || 3)}s ping)`
                  : "ESP32 Node: DISCONNECTED / RECONNECTING"}
              </span>
            </div>

            {/* Active Alert Pill */}
            <div
              onMouseEnter={() => {
                if (criticalCount > 0) triggerHaptic([30, 20, 30]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                criticalCount > 0
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse border border-rose-400 hover:animate-tactical-vibrate"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {criticalCount > 0 && <AlertTriangleIcon className="w-3.5 h-3.5 text-white animate-tactical-vibrate" />}
              <span>{criticalCount > 0 ? `🚨 ${criticalCount} CRITICAL ALERT` : "🟢 SYSTEM NORMAL"}</span>
            </div>

            {/* Active Available Inspection Teams Badge */}
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 border transition-all ${
                availableTeamsCount === 3
                  ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : availableTeamsCount > 0
                  ? "bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-rose-500/10 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-500/40 animate-pulse"
              }`}
            >
              <UsersIcon className="w-3.5 h-3.5" />
              <span>Available Teams: {availableTeamsCount} / {totalTeamsCount}</span>
            </div>

            {/* Decision Status */}
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5 font-mono">
              <CpuIcon className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Multi-Hazard Engine (Flood • Wildfire • Structural)</span>
            </div>

            {/* External APIs Resiliency Status Pills */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Services:</span>
              
              {/* Open-Meteo Pill */}
              <span
                title={
                  apiStatus.open_meteo === "LIVE"
                    ? "Open-Meteo Weather API: Online (2.0s strict timeout)"
                    : "Open-Meteo Weather API: Resilient cached/nominal fallback active"
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold flex items-center gap-1 border transition-all ${
                  apiStatus.open_meteo === "LIVE"
                    ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-500/40"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus.open_meteo === "LIVE" ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
                <span>Meteo: {apiStatus.open_meteo}</span>
              </span>

              {/* Sentinel-2 Pill */}
              <span
                title={
                  apiStatus.sentinel_2 === "LIVE"
                    ? "Sentinel-2 MSI Level-2A: Active optical raster feed"
                    : "Sentinel-2: Nominal baseline fallback active (satellite_ndwi_delta: 0.12)"
                }
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold flex items-center gap-1 border transition-all ${
                  apiStatus.sentinel_2 === "LIVE"
                    ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-cyan-500/10 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border-cyan-500/40"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus.sentinel_2 === "LIVE" ? "bg-emerald-500 animate-ping" : "bg-cyan-500"}`} />
                <span>Sentinel-2: {apiStatus.sentinel_2}</span>
              </span>
            </div>
          </div>

          {/* Action Controls: Audio Toggle + Theme Toggle + Export Report + Register Node + Evaluator Demo Bar */}
          <div className="flex items-center gap-2">
            {/* Quick Audio Mute / Unmute Toggle Button */}
            <button
              onClick={handleToggleAudio}
              title={isAudioMuted ? "Unmute Audio Warning Chimes" : "Mute Audio Warning Chimes"}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95"
              aria-label={isAudioMuted ? "Unmute Audio Warnings" : "Mute Audio Warnings"}
            >
              {isAudioMuted ? (
                <VolumeXIcon className="w-4 h-4 text-rose-500 hover:scale-110 transition-transform" />
              ) : (
                <Volume2Icon className="w-4 h-4 text-emerald-500 hover:scale-110 transition-transform" />
              )}
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                triggerHaptic([20]);
                toggleTheme();
              }}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <SunIcon className="w-4 h-4 text-amber-400 hover:rotate-90 transition-transform duration-300" />
              ) : (
                <MoonIcon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* "Export Incident Report" Button */}
            <button
              onClick={() => {
                triggerHaptic([20]);
                setIsReportModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-slate-700 hover:border-cyan-500/50"
              title="Export Printable Municipal Incident Dispatch Report"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export Incident Report</span>
            </button>

            {/* "+ Register New Node" Button */}
            <button
              onClick={() => {
                triggerHaptic([20]);
                setIsRegisterModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-cyan-400/40"
            >
              <span className="text-sm font-black">+</span>
              <span>Register New Node</span>
            </button>

            {/* Evaluator Demo Controls Bar */}
            <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-300 dark:border-slate-800 shadow-inner">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 hidden sm:inline">
                Demo:
              </span>
              <button
                onClick={() => handleEvaluatorStep(1)}
                disabled={isTransmitting}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  activeStep === 1
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/40"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🟢 Safe</span>
              </button>
              <button
                onClick={() => handleEvaluatorStep(2)}
                disabled={isTransmitting}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  activeStep === 2
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/40"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🟡 Rise</span>
              </button>
              <button
                onClick={() => handleEvaluatorStep(3)}
                disabled={isTransmitting}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  activeStep === 3
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>🔴 Critical</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Content Area */}
        <div className="p-6 space-y-6 flex-1 max-w-[1680px] w-full mx-auto">
          {/* TAB 1: MAIN DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              {/* Upper Section: Geographic Focus & Priority Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-7 flex flex-col">
                  <CommandCenterMap
                    assets={assets}
                    selectedAssetId={selectedAssetId}
                    onSelectAsset={setSelectedAssetId}
                  />

                  {/* Section 14 Analytics Grid: SHAP Breakdown + Live Telemetry & Risk Trend */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <ShapExplainabilityPanel selectedAsset={currentSelectedAsset} />
                    <TelemetryRiskTrendChart data={telemetryHistory} selectedAsset={currentSelectedAsset} />
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col">
                  <PriorityPanel
                    assets={assets}
                    recommendedAction={recommendedAction}
                    actionLevel={actionLevel}
                    topPriority={topPriority}
                    buzzer={buzzer}
                    buzzerSilenced={buzzerSilenced}
                    activeAction={actions.find((a) => a.asset_id === topPriority && a.status !== "COMPLETED") || actions[0]}
                    availableTeams={availableTeamsCount}
                    onAssignAction={handleAssignTeam}
                    onCompleteAction={handleCompleteAction}
                  />
                </div>
              </div>

              {/* Lower Section: Multi-Hazard Telemetry Digital Twin Cards */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Multi-Hazard Telemetry Grid & Actuator Feedback Loops
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Live Feed: {lastTelemetryTime} | {assets.length} Monitored Assets
                  </span>
                </div>

                <DualMonitoringCards
                  assets={assets}
                  buzzerActive={buzzer}
                  buzzerSilenced={buzzerSilenced}
                  apiStatus={apiStatus}
                  isDeviceOffline={deviceStatus.status === "OFFLINE"}
                />
              </div>
            </>
          )}

          {/* TAB 2: LIVE MAP (FULL-HEIGHT) */}
          {activeTab === "map" && (
            <div className="h-[calc(100vh-140px)] flex flex-col">
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Full-Scale Geospatial Multi-Hazard GIS Layer
                </h2>
                <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                  CartoDB GIS Basemap + Open-Meteo Dynamic Weather
                </span>
              </div>
              <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl">
                <CommandCenterMap
                  assets={assets}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={setSelectedAssetId}
                  className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700/60 shadow-lg bg-slate-100 dark:bg-[#0B1120]"
                />
              </div>
            </div>
          )}

          {/* TAB 3: RISK RANKING LEADERBOARD */}
          {activeTab === "ranking" && (
            <div className="space-y-6">
              <div className="bg-white/90 dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                      <BarChart3Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Multi-Hazard Infrastructure Risk & Priority Leaderboard
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ranked by Consequence of Failure: Hazard (H) • Exposure (E) • Vulnerability (V)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                    SHAP Attribution Matrix
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Asset</th>
                        <th className="py-3 px-4">Domain</th>
                        <th className="py-3 px-4">Target Hazard</th>
                        <th className="py-3 px-4 text-center">Risk Score</th>
                        <th className="py-3 px-4 text-center">Priority Score</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Primary SHAP Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60 font-medium">
                      {assets.map((asset) => {
                        const isCrit = asset.status === "CRITICAL";
                        const topFactor = asset.shap_breakdown
                          ? Object.entries(asset.shap_breakdown).sort((a, b) => b[1] - a[1])[0]
                          : null;

                        return (
                          <tr
                            key={asset.asset_id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                              isCrit ? "bg-rose-50/80 dark:bg-rose-950/20" : ""
                            }`}
                          >
                            <td className="py-3 px-4 font-black text-cyan-600 dark:text-cyan-400">
                              #{asset.priority_rank}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">{asset.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{asset.asset_id}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                              {asset.domain || "URBAN"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {asset.target_hazard || "FLOOD"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white font-mono">
                              {Math.round(asset.risk_score)}/100
                            </td>
                            <td className="py-3 px-4 text-center font-black text-cyan-600 dark:text-cyan-300 font-mono">
                              {Math.round(asset.priority_score)}/100
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  isCrit
                                    ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse"
                                    : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                                }`}
                              >
                                {asset.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-[11px]">
                              {topFactor ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">{Math.round(topFactor[1])}%</span>
                                  <span className="truncate max-w-[200px]">{topFactor[0]}</span>
                                </div>
                              ) : (
                                "Water Level & Criticality"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTION CENTER (ACTION ENGINE & TEAM DISPATCH QUEUE) */}
          {activeTab === "actions" && (
            <ActionCenter
              actions={actions}
              teams={teams}
              onAssignTeam={handleAssignTeam}
              onCompleteAction={handleCompleteAction}
              onExportReport={() => setIsReportModalOpen(true)}
            />
          )}

          {/* TAB 5: ALERTS */}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Active Emergency Alert Feed & Actuator Status
                </h2>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-mono font-bold">
                  {criticalCount} Critical Alarms Active
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assets.map((asset) => (
                  <div
                    key={asset.asset_id}
                    className={`p-5 rounded-2xl border transition-all ${
                      asset.status === "CRITICAL"
                        ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/70 shadow-xl shadow-rose-950/10 dark:shadow-rose-950/40"
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{asset.name}</span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-400">({asset.asset_id})</span>
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          asset.status === "CRITICAL"
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse"
                            : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        {asset.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                      Hazard: <strong>{asset.target_hazard || "FLOOD"}</strong> | Priority Score:{" "}
                      <strong>{Math.round(asset.priority_score)}/100</strong>
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                      <span>Safe LED: {asset.led_safe ? "🟢 ON" : "⚪ OFF"}</span>
                      <span>•</span>
                      <span>Crit LED: {asset.led_critical ? "🔴 ON" : "⚪ OFF"}</span>
                      <span>•</span>
                      <span>Buzzer: {buzzer ? "🔊 2.4kHz" : "SILENT"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === "settings" && (
            <div className="bg-white dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl max-w-2xl">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-2">
                System & Telemetry Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                ORACLE Edge Platform v4.0 • Tabletop ESP32 + Open-Meteo Space-to-Ground Link
              </p>
              <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                  <span>FastAPI Endpoint Base URL</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">{API_BASE_URL}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                  <span>Open-Meteo Cache TTL</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">15 minutes</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                  <span>Real-Time Ingestion Protocol</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Server-Sent Events (SSE)</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                  <span>Active Dashboard Theme</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white uppercase">{theme} Mode</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-800">
                  <span>Haptic Actuation Feedback</span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400">Tactile Vibration Enabled</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
