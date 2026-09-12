"use client";

import React from "react";
import {
  Building2Icon,
  BridgeIcon,
  TrendingUpIcon,
  DropletsIcon,
  WavesIcon,
  Volume2Icon,
  VolumeXIcon,
  FlameIcon,
  TreeIcon,
  HammerIcon,
  WindIcon,
  ThermometerIcon,
  ActivityIcon,
} from "./Icons";
import { triggerHaptic } from "./CursorGlow";
import { AssetMonitoringData } from "../types";

export type { AssetMonitoringData };

interface DualMonitoringCardsProps {
  assets?: AssetMonitoringData[];
  h01?: AssetMonitoringData;
  b17?: AssetMonitoringData;
  buzzerActive?: boolean;
}

export default function DualMonitoringCards({
  assets,
  h01 = {
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
  b17 = {
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
  buzzerActive = false,
}: DualMonitoringCardsProps) {
  const cardAssets = assets && assets.length > 0 ? assets : [h01, b17];

  const getHazardIcon = (asset: AssetMonitoringData) => {
    const hazard = asset.target_hazard;
    if (hazard === "WILDFIRE") return FlameIcon;
    if (hazard === "STRUCTURAL") return HammerIcon;
    if (asset.asset_id === "H01") return Building2Icon;
    return BridgeIcon;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {cardAssets.map((asset) => {
        const isCritical = asset.status === "CRITICAL";
        const isModerate = asset.status === "MODERATE" || asset.risk_score >= 45;
        const hazard = asset.target_hazard || "FLOOD";
        const IconComponent = getHazardIcon(asset);

        // Visual Colors & Badges
        const statusBadgeColor = isCritical
          ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse"
          : isModerate
          ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40"
          : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40";

        // Multi-Hazard Gauge Data
        let mainValue = `${asset.water_level_cm?.toFixed(1) || "0.0"} cm`;
        let mainLabel = "Water Level";
        let subValue = `▲ +${asset.rise_rate_cm_min?.toFixed(2) || "0.0"} cm/min`;
        let gaugePct = Math.min(100, Math.max(10, ((asset.water_level_cm || 0) / 28.0) * 100));
        let gaugeGradient = "from-cyan-400 to-blue-600";

        if (hazard === "WILDFIRE") {
          mainValue = `${asset.surface_temp_c?.toFixed(1) || "38.5"} °C`;
          mainLabel = "Surface Temperature";
          subValue = `Thermal Risk: ${asset.thermal_risk_pct || 75}%`;
          gaugePct = Math.min(100, Math.max(15, (((asset.surface_temp_c || 35) - 20) / 28.0) * 100));
          gaugeGradient = "from-amber-400 via-orange-500 to-rose-600";
        } else if (hazard === "STRUCTURAL") {
          mainValue = `${asset.tilt_deg?.toFixed(2) || "1.40"} °`;
          mainLabel = "Pier Tilt Angle";
          subValue = `Vibration: ${asset.vibration_g?.toFixed(2) || "0.42"}g RMS`;
          gaugePct = Math.min(100, Math.max(15, ((asset.tilt_deg || 1.2) / 3.0) * 100));
          gaugeGradient = "from-amber-400 to-orange-600";
        }

        // Factors Breakdown
        const shapFactors = asset.shap_breakdown || (hazard === "WILDFIRE"
          ? {
              "Surface Temperature & Thermal Anomaly": 42.0,
              "Low Relative Humidity & Wind Speed": 26.0,
              "Vegetative Dry Fuel Index": 18.0,
              "Forest Reserve Criticality & Exposure": 14.0,
            }
          : hazard === "STRUCTURAL"
          ? {
              "Bridge Pier Tilt & Vibration (MPU6050)": 45.0,
              "Hydrodynamic Scour & Water Velocity": 25.0,
              "Daily Traffic & Commuter Impact": 18.0,
              "Asset Structural Criticality": 12.0,
            }
          : {
              "Water Level Impact": 40.0,
              "Rapid Rise Rate": 35.0,
              "Facility Vulnerability": 25.0,
            });

        return (
          <div
            key={asset.asset_id}
            id={`card-${asset.asset_id}`}
            onMouseEnter={() => {
              if (isCritical) triggerHaptic([30, 20, 30]);
            }}
            className={`rounded-2xl border transition-all duration-300 ease-out p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] ${
              isCritical
                ? "bg-rose-50/90 dark:bg-gradient-to-b dark:from-[#1C121A] dark:via-[#0F172A] dark:to-[#0B1120] border-rose-400 dark:border-rose-500/70 shadow-rose-950/20 dark:shadow-rose-950/40 ring-1 ring-rose-500/20 hover:border-rose-400"
                : "bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-slate-200/50 dark:shadow-slate-950/50"
            }`}
          >
            {/* Background ambient glow for critical cards */}
            {isCritical && (
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            )}

            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border shadow-md transition-all ${
                      hazard === "WILDFIRE"
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400"
                        : hazard === "STRUCTURAL"
                        ? "bg-orange-500/20 border-orange-500/40 text-orange-600 dark:text-orange-400"
                        : isCritical
                        ? "bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400"
                        : "bg-cyan-500/20 border-cyan-500/40 text-cyan-600 dark:text-cyan-400"
                    }`}
                  >
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-wide">
                        {asset.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 font-bold">
                        {asset.asset_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {asset.domain || "URBAN_INFRASTRUCTURE"}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-cyan-600 dark:text-cyan-300 font-semibold">
                        Criticality: {(asset.criticality * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider border shadow-sm ${statusBadgeColor}`}
                  >
                    {isCritical ? "CRITICAL" : isModerate ? "MODERATE" : "SAFE"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Rank #{asset.priority_rank}
                  </span>
                </div>
              </div>

              {/* Main Gauge & Reading Display */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {hazard === "WILDFIRE" ? (
                      <ThermometerIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ) : hazard === "STRUCTURAL" ? (
                      <HammerIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <DropletsIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    )}
                    <span>{mainLabel}</span>
                  </span>
                  <span className="text-xs font-bold font-mono text-slate-700 dark:text-slate-200">
                    {subValue}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    {mainValue}
                  </span>
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                    Score: {Math.round(asset.risk_score)}/100
                  </span>
                </div>

                {/* Visual Level Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-2 overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gaugeGradient} transition-all duration-500`}
                    style={{ width: `${gaugePct}%` }}
                  />
                </div>

                {/* Secondary Multi-Hazard Telemetry Row */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 text-[11px]">
                  {hazard === "WILDFIRE" ? (
                    <>
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">Relative Humidity:</span>
                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-300">
                          {asset.humidity_pct ?? 28}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <WindIcon className="w-3 h-3 text-slate-400" />
                          <span>Wind Speed:</span>
                        </span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-300">
                          {asset.wind_speed_kmh ?? 22} km/h
                        </span>
                      </div>
                    </>
                  ) : hazard === "STRUCTURAL" ? (
                    <>
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">Hydro Scour:</span>
                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-300">
                          {asset.scour_risk_pct ?? 52}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">MPU6050 RMS:</span>
                        <span className="font-mono font-bold text-orange-600 dark:text-orange-300">
                          {asset.vibration_g?.toFixed(2) || "0.42"}g
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">Baseline Scale:</span>
                        <span className="font-mono font-bold text-cyan-600 dark:text-cyan-300">
                          0 - 28.0 cm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400">Pop. Served:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {asset.population_served?.toLocaleString() || "15,000"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Hardware Actuators / Physical Feedback Signals */}
              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {/* Safe Indicator */}
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    asset.led_safe
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-50"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {hazard === "WILDFIRE" ? "IR Safe" : "Safe LED"}
                  </span>
                  <span className="text-[9px] font-mono font-bold mt-0.5">
                    {asset.led_safe ? "GREEN ON" : "OFF"}
                  </span>
                </div>

                {/* Critical Indicator */}
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    asset.led_critical
                      ? "bg-rose-500/20 border-rose-500/60 text-rose-700 dark:text-rose-300 animate-pulse shadow-sm shadow-rose-500/30"
                      : "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-50"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {hazard === "WILDFIRE" ? "Thermal IR" : "Crit LED"}
                  </span>
                  <span className="text-[9px] font-mono font-bold mt-0.5">
                    {asset.led_critical ? "RED ON" : "OFF"}
                  </span>
                </div>

                {/* Alarm / Buzzer */}
                <div
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    buzzerActive
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 animate-pulse"
                      : "bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-50"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Siren / Buzzer
                  </span>
                  <span className="text-[9px] font-mono font-bold mt-0.5">
                    {buzzerActive ? "2.4kHz ON" : "SILENT"}
                  </span>
                </div>
              </div>

              {/* Dynamic SHAP Factor Breakdown */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Why this risk? (SHAP Explainability)
                  </span>
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    Hazard: {hazard}
                  </span>
                </div>

                <div className="space-y-2">
                  {Object.entries(shapFactors).map(([factorName, weightPct], idx) => {
                    const factorColor =
                      idx === 0
                        ? "bg-rose-500 dark:bg-rose-400"
                        : idx === 1
                        ? "bg-amber-500 dark:bg-amber-400"
                        : idx === 2
                        ? "bg-cyan-500 dark:bg-cyan-400"
                        : "bg-indigo-500 dark:bg-indigo-400";

                    return (
                      <div key={factorName}>
                        <div className="flex justify-between text-[10px] text-slate-700 dark:text-slate-300 font-medium mb-0.5">
                          <span className="truncate pr-2">{factorName}</span>
                          <span className="font-mono font-bold">{Math.round(weightPct)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${factorColor}`}
                            style={{ width: `${Math.min(100, Math.max(5, weightPct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
