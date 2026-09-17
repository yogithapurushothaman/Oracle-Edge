"use client";

import React from "react";
import {
  ActivityIcon,
  MapPinIcon,
  LayersIcon,
  CpuIcon,
  BarChart3Icon,
  UsersIcon,
  ClockIcon,
  FileTextIcon,
  SlidersIcon,
  RadioIcon,
  SparklesIcon,
} from "./Icons";

interface SidebarProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  onQuickAction?: (action: "priority" | "teams" | "report") => void;
  criticalAlertsCount?: number;
  isConnected?: boolean;
}

export default function Sidebar({
  activeTab = "dashboard",
  onSelectTab = () => {},
  onQuickAction = () => {},
  criticalAlertsCount = 0,
  isConnected = false,
}: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: ActivityIcon },
    { id: "map", label: "Live Map", icon: MapPinIcon },
    { id: "assets", label: "Assets", icon: LayersIcon },
    { id: "risk", label: "Risk Analysis", icon: CpuIcon },
    { id: "priority", label: "Priority Ranking", icon: BarChart3Icon },
    { id: "dispatch", label: "Dispatch & Teams", icon: UsersIcon },
    { id: "timeline", label: "Incident Timeline", icon: ClockIcon },
    { id: "reports", label: "Reports", icon: FileTextIcon },
    { id: "settings", label: "Settings", icon: SlidersIcon },
  ];

  return (
    <aside className="w-60 lg:w-64 liquid-glass rounded-2xl p-3.5 flex flex-col justify-between shrink-0 self-stretch sticky top-3 select-none z-20 max-h-[calc(100vh-1.5rem)] overflow-y-auto custom-scrollbar transition-all duration-200 entrance-fade entrance-delay-2">
      <div className="flex flex-col flex-1">
        {/* Navigation Section Header */}
        <div className="pb-2 border-b border-white/10 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300/90">
              Command Center
            </span>
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300">
            v2.5
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer text-left ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-bold"
                    : "text-gray-300 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="w-1 h-3 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.9)]" />
                  )}
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-gray-400"}`} />
                  <span className="text-[11px]">{item.label}</span>
                </div>
                {item.id === "risk" && criticalAlertsCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    {criticalAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Actions Section */}
        <div className="pt-3 mt-3 border-t border-white/10">
          <p className="px-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <SparklesIcon className="w-3 h-3 text-cyan-400" />
            Quick Actions
          </p>
          <div className="space-y-1">
            <button
              onClick={() => onQuickAction("priority")}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all cursor-pointer text-left group"
            >
              <BarChart3Icon className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>View Priority List</span>
            </button>

            <button
              onClick={() => onQuickAction("teams")}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all cursor-pointer text-left group"
            >
              <UsersIcon className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Allocate Teams</span>
            </button>

            <button
              onClick={() => onQuickAction("report")}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all cursor-pointer text-left group"
            >
              <FileTextIcon className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        {/* Hardware Status Strip */}
        <div className="mt-3 p-2 rounded-xl neumorphic-well border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
              <RadioIcon className="w-3 h-3 text-cyan-400" />
              ESP32 Node
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold ${
                isConnected
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              }`}
            >
              <span
                className={`w-1 h-1 rounded-full mr-1 ${
                  isConnected ? "bg-emerald-400 animate-ping" : "bg-cyan-400"
                }`}
              />
              {isConnected ? "LIVE" : "SIM"}
            </span>
          </div>
          <div className="text-[9px] font-mono text-gray-400 flex justify-between">
            <span>Pins:</span>
            <span className="text-cyan-400">36 (H01) | 32 (B17)</span>
          </div>
        </div>
      </div>

      {/* Stylized Skyline Silhouette Graphic + Footer Text */}
      <div className="pt-2.5 mt-3 border-t border-white/10 flex flex-col items-center text-center">
        <div className="w-full h-7 mb-1 overflow-hidden opacity-45">
          <svg className="w-full h-full text-cyan-400" viewBox="0 0 200 40" fill="currentColor">
            <path d="M0 40 L0 32 L8 32 L8 24 L14 24 L14 30 L20 30 L20 18 L26 18 L26 30 L32 30 L32 12 L38 12 L38 22 L44 22 L44 32 L52 32 L52 8 L60 8 L60 20 L66 20 L66 32 L74 32 L74 15 L82 15 L82 28 L90 28 L90 6 L98 6 L98 25 L106 25 L106 32 L114 32 L114 14 L122 14 L122 30 L130 30 L130 10 L138 10 L138 22 L144 22 L144 32 L152 32 L152 18 L160 18 L160 28 L168 28 L168 5 L174 5 L174 24 L182 24 L182 32 L190 32 L190 16 L200 16 L200 40 Z" />
          </svg>
        </div>
        <p className="text-[10px] font-bold text-cyan-400 tracking-wide">
          Safer Cities / Stronger Communities
        </p>
        <p className="text-[9px] text-gray-400 font-mono">
          Oracle-Edge Municipal v2.5
        </p>
      </div>
    </aside>
  );
}
