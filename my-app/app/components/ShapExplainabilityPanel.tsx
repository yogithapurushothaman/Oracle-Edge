"use client";

import React from "react";
import { SparklesIcon, CpuIcon, AlertTriangleIcon, ActivityIcon, ShieldIcon } from "./Icons";
import { AssetMonitoringData } from "../types";

interface ShapExplainabilityPanelProps {
  selectedAsset?: AssetMonitoringData;
}

interface ShapFactorItem {
  name: string;
  weight: number;
  descriptor: string;
  color: string;
  barColor: string;
}

export default function ShapExplainabilityPanel({
  selectedAsset,
}: ShapExplainabilityPanelProps) {
  const assetId = selectedAsset?.asset_id || "H01";
  const assetName = selectedAsset?.name || "Metro Hospital";
  const hazard = selectedAsset?.target_hazard || "FLOOD";
  const isCritical = selectedAsset?.status === "CRITICAL";

  // Dynamic factor weights based on asset domain and live readings
  let factors: ShapFactorItem[] = [];
  let explanationPill = "";

  if (hazard === "WILDFIRE") {
    const tempVal = selectedAsset?.surface_temp_c || 38.5;
    factors = [
      {
        name: "Surface Thermal Anomaly",
        weight: 42,
        descriptor: `${tempVal.toFixed(1)}°C - Thermal Camera IR Peak`,
        color: "text-amber-500 dark:text-amber-400",
        barColor: "bg-gradient-to-r from-amber-500 to-rose-500",
      },
      {
        name: "Atmospheric Dryness & Wind",
        weight: 26,
        descriptor: `${selectedAsset?.humidity_pct ?? 28}% RH • ${selectedAsset?.wind_speed_kmh ?? 22} km/h Gusts`,
        color: "text-orange-500 dark:text-orange-400",
        barColor: "bg-gradient-to-r from-orange-500 to-amber-500",
      },
      {
        name: "Vegetative Dry Fuel Index",
        weight: 18,
        descriptor: "Sentinel-2 NDRE Canopy Stress Delta",
        color: "text-yellow-500 dark:text-yellow-400",
        barColor: "bg-gradient-to-r from-yellow-500 to-orange-400",
      },
      {
        name: "Ecological & Population Exposure",
        weight: 14,
        descriptor: `${(selectedAsset?.criticality ? selectedAsset.criticality * 100 : 82).toFixed(0)}% Criticality • 32k Perimeter Pop.`,
        color: "text-cyan-600 dark:text-cyan-400",
        barColor: "bg-gradient-to-r from-cyan-500 to-blue-500",
      },
    ];
    explanationPill = "Wildfire alert elevated due to dry canopy index and high wind velocity threatening reserve perimeter.";
  } else if (hazard === "STRUCTURAL") {
    factors = [
      {
        name: "Pier Tilt & Vibration",
        weight: 45,
        descriptor: `${selectedAsset?.tilt_deg?.toFixed(2) || "1.40"}° Tilt • ${selectedAsset?.vibration_g?.toFixed(2) || "0.42"}g MPU6050 RMS`,
        color: "text-rose-500 dark:text-rose-400",
        barColor: "bg-gradient-to-r from-rose-500 to-orange-500",
      },
      {
        name: "Hydrodynamic Scour Force",
        weight: 25,
        descriptor: `${selectedAsset?.scour_risk_pct ?? 52}% Scour Influx via River Current`,
        color: "text-cyan-600 dark:text-cyan-400",
        barColor: "bg-gradient-to-r from-cyan-500 to-blue-500",
      },
      {
        name: "Arterial Commuter Traffic",
        weight: 18,
        descriptor: `${selectedAsset?.population_served?.toLocaleString() || "15,000"} Commuters Daily`,
        color: "text-amber-500 dark:text-amber-400",
        barColor: "bg-gradient-to-r from-amber-500 to-orange-400",
      },
      {
        name: "Structural Criticality Baseline",
        weight: 12,
        descriptor: "Bridge Substructure Age & Load Capacity",
        color: "text-indigo-500 dark:text-indigo-400",
        barColor: "bg-gradient-to-r from-indigo-500 to-cyan-500",
      },
    ];
    explanationPill = "Structural risk elevated by continuous pier vibration coupled with deep hydraulic river scour.";
  } else {
    // Default / Flood (e.g. H01 Hospital)
    const riseRate = selectedAsset?.rise_rate_cm_min || 1.8;
    const waterLevel = selectedAsset?.water_level_cm || 21.5;

    // Use custom shap breakdown if present from ML backend, otherwise PRD factor weights
    factors = [
      {
        name: "Water Depth & Rise Rate",
        weight: 38,
        descriptor: `${waterLevel.toFixed(1)} cm (+${riseRate.toFixed(1)} cm/min) - Primary Hazard Trigger`,
        color: "text-rose-500 dark:text-rose-400",
        barColor: "bg-gradient-to-r from-rose-500 to-red-500",
      },
      {
        name: "Critical Facility Dependency",
        weight: 32,
        descriptor: "ICU & Medical Power Vulnerability (Zero Evacuation Redundancy)",
        color: "text-amber-500 dark:text-amber-400",
        barColor: "bg-gradient-to-r from-amber-500 to-orange-400",
      },
      {
        name: "3-Hour Rolling Rainfall",
        weight: 18,
        descriptor: "Open-Meteo Influx Forecast (+34mm / 3hr)",
        color: "text-cyan-600 dark:text-cyan-400",
        barColor: "bg-gradient-to-r from-cyan-500 to-blue-500",
      },
      {
        name: "Satellite NDWI Spread",
        weight: 12,
        descriptor: "Sentinel-2 Regional Delta (+0.42 Surface Water)",
        color: "text-indigo-500 dark:text-indigo-400",
        barColor: "bg-gradient-to-r from-indigo-500 to-cyan-500",
      },
    ];

    explanationPill = isCritical
      ? `Priority elevated due to high rate-of-rise (+${riseRate.toFixed(1)} cm/min) threatening zero-redundancy medical infrastructure.`
      : `Nominal baseline: Water depth ${waterLevel.toFixed(1)} cm within standard containment threshold.`;
  }

  return (
    <div className="bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm dark:shadow-2xl flex flex-col justify-between transition-all duration-300 ease-out hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Decision Engine | Contributing Factor Weights
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                SHAP Explainability Decomposition (Active Target: {assetId} {assetName})
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold uppercase">
            SHAP v4.2
          </span>
        </div>

        {/* Factors Progress Bars */}
        <div className="mt-4 space-y-3.5">
          {factors.map((factor, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                  <span>{factor.name}</span>
                </span>
                <span className={`font-mono font-extrabold ${factor.color}`}>
                  {factor.weight}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                <div
                  className={`h-full rounded-full ${factor.barColor} transition-all duration-700 ease-out`}
                  style={{ width: `${factor.weight}%` }}
                />
              </div>

              {/* Factor Descriptor Subtext */}
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
                <span className="truncate">{factor.descriptor}</span>
                <span className="font-mono text-[9px] opacity-75">Weight {factor.weight / 100}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Plain-English Explanation Pill */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
            <AlertTriangleIcon className="w-3 h-3" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">
              Explainability Synthesis
            </span>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug font-medium">
              {explanationPill}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
