"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { ActivityIcon, TrendingUpIcon } from "./Icons";
import { useTheme } from "../context/ThemeContext";
import { AssetMonitoringData } from "../types";

export interface TelemetryPoint {
  time: string;
  waterLevel: number;
  riskScore: number;
  riseRate?: number;
}

interface TelemetryRiskTrendChartProps {
  data: TelemetryPoint[];
  selectedAsset?: AssetMonitoringData;
}

export default function TelemetryRiskTrendChart({
  data = [],
  selectedAsset,
}: TelemetryRiskTrendChartProps) {
  const [mounted, setMounted] = useState<boolean>(false);

  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const hazard = selectedAsset?.target_hazard || "FLOOD";
  const primaryMetricLabel =
    hazard === "WILDFIRE"
      ? "Surface Temp (°C)"
      : hazard === "STRUCTURAL"
      ? "Pier Tilt (°)"
      : "Water Level (cm)";

  // Color Palette
  const gridColor = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.08)";
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const tooltipBg = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.98)";
  const tooltipBorder = isDark ? "#334155" : "#cbd5e1";

  // Custom Themed Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
          }}
          className="p-3 rounded-xl border shadow-xl backdrop-blur-md text-xs font-mono space-y-1.5 z-50 min-w-[170px]"
        >
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1 flex justify-between">
            <span>{label}</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-sans">ESP32 Feed</span>
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-3">
              <span style={{ color: entry.color }} className="font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {entry.value} {entry.name.includes("Water") ? "cm" : entry.name.includes("Risk") ? "/100" : ""}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm dark:shadow-2xl flex flex-col justify-between transition-all duration-300 ease-out hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <ActivityIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Real-Time Telemetry & Risk Progression
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Rolling 15-Minute Sensor Telemetry vs. Risk Score
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              LIVE SSE
            </span>
          </div>
        </div>

        {/* Recharts Dual-Line Chart Area */}
        <div className="w-full h-[220px] pt-1">
          {mounted && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: textColor, fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={{ stroke: gridColor }}
                />
                {/* Left Axis: Water Level (cm) */}
                <YAxis
                  yAxisId="left"
                  domain={[0, 30]}
                  tick={{ fill: "#06b6d4", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={{ stroke: gridColor }}
                  unit="cm"
                />
                {/* Right Axis: Risk Score (0-100) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: "#f43f5e", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={{ stroke: gridColor }}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Blue Line: Primary Telemetry (Water Level) */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="waterLevel"
                  name={primaryMetricLabel}
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#06b6d4", strokeWidth: 1.5, stroke: isDark ? "#0F172A" : "#FFFFFF" }}
                  activeDot={{ r: 5, fill: "#38bdf8" }}
                  isAnimationActive={true}
                  animationDuration={600}
                />
                {/* Red/Amber Line: Risk Score */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="riskScore"
                  name="Risk Score"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#f43f5e", strokeWidth: 1.5, stroke: isDark ? "#0F172A" : "#FFFFFF" }}
                  activeDot={{ r: 5, fill: "#fb7185" }}
                  isAnimationActive={true}
                  animationDuration={600}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              <span className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2" />
              Initializing Rolling Telemetry Stream...
            </div>
          )}
        </div>
      </div>

      {/* Chart Footer Indicator Legend */}
      <div className="mt-2 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{primaryMetricLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Risk Score (0–100)</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
          Sliding Window: 15 Points
        </span>
      </div>
    </div>
  );
}
