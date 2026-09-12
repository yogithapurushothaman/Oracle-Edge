"use client";

import React, { useState } from "react";
import { AlertTriangleIcon, SirenIcon, CheckCircle2Icon, CheckIcon, SendIcon, SparklesIcon } from "./Icons";
import { AssetMonitoringData } from "../types";
import { triggerHaptic } from "./CursorGlow";

interface PriorityPanelProps {
  assets: AssetMonitoringData[];
  recommendedAction: string;
  actionLevel?: "CRITICAL" | "MODERATE" | "SAFE";
  topPriority?: string;
  buzzer?: boolean;
}

export default function PriorityPanel({
  assets = [],
  recommendedAction = "Routine Monitoring: Baseline nominal.",
  actionLevel = "SAFE",
  topPriority = "H01",
  buzzer = false,
}: PriorityPanelProps) {
  const [dispatchedTime, setDispatchedTime] = useState<string | null>(null);

  // Sort assets by priority rank
  const sortedAssets = [...assets].sort((a, b) => a.priority_rank - b.priority_rank);
  const isCritical = actionLevel === "CRITICAL" || buzzer;

  const handleDispatch = () => {
    triggerHaptic([30, 20, 30]);
    if (!dispatchedTime) {
      const now = new Date();
      setDispatchedTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } else {
      setDispatchedTime(null);
    }
  };

  return (
    <div className="bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-2xl h-full transition-all duration-300 ease-out hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]">
      <div>
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <AlertTriangleIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Action & Priority Engine
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Infrastructure Triage & Resource Allocation
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-100 dark:bg-slate-800/90 text-cyan-700 dark:text-cyan-300 border border-slate-200 dark:border-slate-700 font-mono">
            SHAP Explainability
          </span>
        </div>

        {/* Clean, Spaced Ranking Table */}
        <div className="mt-3.5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3 text-center">Risk Score</th>
                <th className="py-2.5 px-3 text-center">Impact</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60 font-medium">
              {sortedAssets.map((asset) => {
                const isCrit = asset.status === "CRITICAL";
                const isMod = asset.status === "MODERATE" || asset.risk_score >= 45;
                const impactText = asset.asset_id === "H01" ? "45,000 People" : "15,000 Commuters";
                const statusLabel = isCrit ? "RED ALERT" : isMod ? "ELEVATED" : "SAFE";

                return (
                  <tr
                    key={asset.asset_id}
                    className={`transition-colors ${
                      isCrit
                        ? "bg-rose-50 dark:bg-rose-950/25 hover:bg-rose-100/80 dark:hover:bg-rose-900/35"
                        : "hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black tracking-wide ${
                          asset.priority_rank === 1
                            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        #{asset.priority_rank}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                        {asset.asset_id === "H01" ? "H01 Metro Hospital" : asset.asset_id === "B17" ? "B17 Adyar Bridge" : `${asset.name} (${asset.asset_id})`}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {asset.type || asset.target_hazard} • {(asset.water_level_cm || 0).toFixed(1)} cm
                      </span>
                    </td>

                    {/* Risk Score */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className="inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isCrit ? "rgba(244, 63, 94, 0.15)" : isMod ? "rgba(251, 191, 36, 0.15)" : "rgba(16, 185, 129, 0.15)",
                          color: isCrit ? "#f43f5e" : isMod ? "#d97706" : "#059669",
                          border: `1px solid ${isCrit ? "rgba(244, 63, 94, 0.3)" : isMod ? "rgba(251, 191, 36, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                        }}
                      >
                        {Math.round(asset.risk_score)}/100
                      </span>
                    </td>

                    {/* Impact */}
                    <td className="py-3 px-3 text-center whitespace-nowrap text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                      {impactText}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                          isCrit
                            ? "bg-rose-600 text-white shadow-sm shadow-rose-600/40 animate-pulse"
                            : isMod
                            ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Prominent "Why Hospital First?" Plain-English Badge */}
        <div className="mt-3.5 p-3 rounded-xl bg-amber-50/70 dark:bg-slate-900/80 border border-amber-200/80 dark:border-slate-800 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <SparklesIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>Why Hospital First?</span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 lowercase">• plain-english reasoning</span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 leading-relaxed font-medium">
              Even though Bridge water is high, Metro Hospital carries <strong className="text-slate-900 dark:text-white">3x greater life-safety vulnerability</strong> and <strong className="text-slate-900 dark:text-white">zero evacuation redundancy</strong> for ICU patients.
            </p>
          </div>
        </div>
      </div>

      {/* Large Operational Action Banner */}
      <div className="mt-4">
        <div
          onMouseEnter={() => { if (isCritical) triggerHaptic([30, 20, 30]); }}
          className={`p-4 rounded-xl border transition-all duration-300 ${
            isCritical
              ? "bg-gradient-to-r from-rose-900/90 to-red-900/80 dark:from-rose-950/90 dark:to-red-950/80 border-rose-500 shadow-xl shadow-rose-500/20 animate-pulse hover:border-rose-400"
              : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/70 dark:to-teal-950/60 border-emerald-500/40 dark:border-emerald-500/50 shadow-md shadow-emerald-500/10"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isCritical
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/50 animate-tactical-vibrate"
                    : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {isCritical ? <SirenIcon className="w-5 h-5 animate-tactical-vibrate text-white" /> : <CheckCircle2Icon className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                    isCritical ? "bg-rose-950 text-rose-200 border border-rose-400/60" : "bg-emerald-900 text-emerald-300 border border-emerald-600"
                  }`}>
                    {isCritical ? "RECOMMENDED ACTION" : "DIRECTIVE"}
                  </span>
                  {buzzer && (
                    <span
                      onMouseEnter={() => triggerHaptic([30, 20, 30])}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse cursor-pointer hover:animate-tactical-vibrate"
                    >
                      🔊 BUZZER ACTIVE
                    </span>
                  )}
                </div>
                <h4 className={`text-xs sm:text-sm font-bold mt-1 leading-snug ${isCritical ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  {isCritical
                    ? "Dispatch Flood Barriers & Emergency Crew to H01 Hospital"
                    : recommendedAction}
                </h4>
              </div>
            </div>

            {/* Interactive Acknowledge & Dispatch Button */}
            <button
              onClick={handleDispatch}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shrink-0 cursor-pointer active:scale-95 ${
                dispatchedTime
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-emerald-600/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  : isCritical
                  ? "bg-white hover:bg-slate-100 text-rose-700 border border-rose-300 shadow-rose-900/50 hover:shadow-[0_0_25px_rgba(244,63,94,0.4)] hover:scale-105 hover:animate-tactical-vibrate"
                  : "bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white dark:text-slate-200 border border-slate-700 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
              }`}
            >
              {dispatchedTime ? (
                <>
                  <CheckIcon className="w-4 h-4 text-white" />
                  <span>Dispatched ({dispatchedTime})</span>
                </>
              ) : (
                <>
                  <SendIcon className="w-3.5 h-3.5" />
                  <span>Acknowledge & Dispatch Team Alpha</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
