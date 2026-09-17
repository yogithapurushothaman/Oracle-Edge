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
  SparklesIcon
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
    <aside className="w-64 bg-[#0B132B] border-r border-[#1E3A5F] flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30 transition-colors duration-200">
      <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#1E3A5F] flex items-center gap-3 bg-[#0d1b2a]/60">
          <div className="relative">
            {/* Glowing cyan dual-triangle glyph */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20">
              <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none">
                <polygon points="12 3 21 18 3 18" stroke="currentColor" strokeWidth="2" fill="rgba(6, 182, 212, 0.2)" />
                <polygon points="12 9 17 17 7 17" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56, 189, 248, 0.4)" />
              </svg>
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B132B] ${isConnected ? "bg-emerald-400 animate-ping" : "bg-cyan-400"}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white tracking-wider text-sm">ORACLE</span>
              <span className="text-[10px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                EDGE
              </span>
            </div>
            <p className="text-[10px] text-cyan-200/70 font-medium tracking-tight">
              Municipal Intelligence
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="px-3 pt-3">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Control Room
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-[#132238] border-l-2 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/10"
                      : "text-slate-400 hover:text-white hover:bg-[#132238]/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === "risk" && criticalAlertsCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                      {criticalAlertsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Actions Section */}
        <div className="px-3 pt-4">
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <SparklesIcon className="w-3.5 h-3.5 text-cyan-400" />
            Quick Actions
          </p>
          <div className="space-y-1.5">
            <button
              onClick={() => onQuickAction("priority")}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-[#132238]/90 hover:bg-[#1E3A5F] border border-[#1E3A5F] hover:border-cyan-500/50 transition-all cursor-pointer text-left group"
            >
              <BarChart3Icon className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Priority List</span>
            </button>

            <button
              onClick={() => onQuickAction("teams")}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-[#132238]/90 hover:bg-[#1E3A5F] border border-[#1E3A5F] hover:border-cyan-500/50 transition-all cursor-pointer text-left group"
            >
              <UsersIcon className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Allocate Teams</span>
            </button>

            <button
              onClick={() => onQuickAction("report")}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-[#132238]/90 hover:bg-[#1E3A5F] border border-[#1E3A5F] hover:border-cyan-500/50 transition-all cursor-pointer text-left group"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        {/* Hardware Status Strip */}
        <div className="m-3 mt-4 p-2.5 rounded-xl bg-[#132238]/60 border border-[#1E3A5F]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <RadioIcon className="w-3 h-3 text-cyan-400" />
              ESP32 Node
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                isConnected
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  isConnected ? "bg-emerald-400 animate-ping" : "bg-cyan-400"
                }`}
              />
              {isConnected ? "LIVE STREAM" : "SIMULATION"}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Pins:</span>
              <span className="text-cyan-400">36 (H01) | 32 (B17)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Footer with Cyan Skyline Silhouette */}
      <div className="p-3 border-t border-[#1E3A5F] bg-[#0d1b2a]/90 flex flex-col items-center text-center">
        <div className="w-full h-8 mb-1.5 overflow-hidden opacity-50">
          <svg className="w-full h-full text-cyan-400" viewBox="0 0 200 40" fill="currentColor">
            <path d="M0 40 L0 32 L8 32 L8 24 L14 24 L14 30 L20 30 L20 18 L26 18 L26 30 L32 30 L32 12 L38 12 L38 22 L44 22 L44 32 L52 32 L52 8 L60 8 L60 20 L66 20 L66 32 L74 32 L74 15 L82 15 L82 28 L90 28 L90 6 L98 6 L98 25 L106 25 L106 32 L114 32 L114 14 L122 14 L122 30 L130 30 L130 10 L138 10 L138 22 L144 22 L144 32 L152 32 L152 18 L160 18 L160 28 L168 28 L168 5 L174 5 L174 24 L182 24 L182 32 L190 32 L190 16 L200 16 L200 40 Z" />
          </svg>
        </div>
        <p className="text-[10px] font-bold text-cyan-400 tracking-wide">
          Safer Cities / Stronger Communities
        </p>
        <p className="text-[9px] text-slate-400 font-mono">
          Oracle-Edge Municipal v2.5
        </p>
      </div>
    </aside>
  );
}
