"use client";

import React from "react";
import {
  ShieldIcon,
  ActivityIcon,
  MapPinIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  LayersIcon,
  SlidersIcon,
  RadioIcon,
  SirenIcon
} from "./Icons";

interface SidebarProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  criticalAlertsCount?: number;
  isConnected?: boolean;
}

export default function Sidebar({
  activeTab = "dashboard",
  onSelectTab = () => {},
  criticalAlertsCount = 0,
  isConnected = false,
}: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: ActivityIcon },
    { id: "map", label: "Live Map", icon: MapPinIcon },
    { id: "ranking", label: "Risk Ranking", icon: BarChart3Icon },
    { id: "actions", label: "Action Center", icon: SirenIcon },
    { id: "alerts", label: "Alerts", icon: AlertTriangleIcon, badge: criticalAlertsCount },
    { id: "settings", label: "Settings", icon: SlidersIcon },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30 transition-colors duration-200">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-500 dark:text-cyan-400 shadow-lg shadow-cyan-500/10">
              <ShieldIcon className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0B1120] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 dark:text-white tracking-wider text-sm">ORACLE</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">EDGE</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Command Center</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer active:scale-95 ${
                  isActive
                    ? "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400 dark:text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Hardware Node Status Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 m-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
            <RadioIcon className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            ESP32 Node
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isConnected
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isConnected ? "bg-emerald-500 dark:bg-emerald-400 animate-ping" : "bg-amber-500 dark:bg-amber-400"}`} />
            {isConnected ? "LIVE STREAM" : "POLLING"}
          </span>
        </div>
        <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex justify-between">
            <span>Device ID:</span>
            <span className="font-mono text-slate-800 dark:text-slate-300 font-semibold">ORACLE-ESP32-01</span>
          </div>
          <div className="flex justify-between">
            <span>Firmware:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">v1.0 Tabletop Node</span>
          </div>
          <div className="flex justify-between">
            <span>Storage:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">SQLite Engine</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
