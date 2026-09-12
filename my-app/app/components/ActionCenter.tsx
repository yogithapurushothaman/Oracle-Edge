"use client";

import React, { useState, useEffect } from "react";
import { ActionItem, TeamItem } from "../types";
import {
  SirenIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  SendIcon,
  UsersIcon,
  ShieldIcon,
  ActivityIcon,
} from "./Icons";
import { triggerHaptic } from "./CursorGlow";

interface ActionCenterProps {
  actions: ActionItem[];
  teams: TeamItem[];
  onAssignTeam: (actionId: string, teamId: string) => Promise<void>;
  onCompleteAction: (actionId: string) => Promise<void>;
}

export default function ActionCenter({
  actions = [],
  teams = [],
  onAssignTeam,
  onCompleteAction,
}: ActionCenterProps) {
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({});
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Ticking timer for live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectTeam = (actionId: string, teamId: string) => {
    setSelectedTeams((prev) => ({ ...prev, [actionId]: teamId }));
  };

  const handleDispatch = async (action: ActionItem) => {
    const teamId = selectedTeams[action.action_id] || teams.find((t) => t.status === "AVAILABLE")?.team_id;
    if (!teamId) return;

    setDispatchingId(action.action_id);
    triggerHaptic([30, 20, 30]);
    try {
      await onAssignTeam(action.action_id, teamId);
    } finally {
      setDispatchingId(null);
    }
  };

  const handleComplete = async (actionId: string) => {
    setCompletingId(actionId);
    triggerHaptic([40, 20, 40]);
    try {
      await onCompleteAction(actionId);
    } finally {
      setCompletingId(null);
    }
  };

  // Calculate remaining response countdown
  const getCountdownDisplay = (action: ActionItem) => {
    if (action.status !== "DISPATCHED" || !action.dispatched_at) {
      return null;
    }

    const dispatchedTimestamp = new Date(action.dispatched_at).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((currentTime - dispatchedTimestamp) / 1000));
    const totalSeconds = action.countdown_seconds || 900;
    const remaining = Math.max(0, totalSeconds - elapsedSeconds);

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const isUrgent = remaining < 180;

    return {
      formatted: `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
      isUrgent,
      remaining,
    };
  };

  const sortedActions = [...actions].sort((a, b) => b.priority_score - a.priority_score);
  const activeCount = sortedActions.filter((a) => a.status !== "COMPLETED").length;
  const availableTeamsCount = teams.filter((t) => t.status === "AVAILABLE").length;

  return (
    <div className="space-y-6">
      {/* Header & Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Emergency Queue */}
        <div className="bg-white/90 dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Incident Queue
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <span>{activeCount}</span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                PRIORITIZED
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <SirenIcon className="w-6 h-6 animate-tactical-vibrate" />
          </div>
        </div>

        {/* Municipal Response Teams */}
        <div className="bg-white/90 dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Available Units
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <span>{availableTeamsCount} / {teams.length}</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                READY
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <UsersIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Action Engine Protocol */}
        <div className="bg-white/90 dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Action Engine Protocol
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-200 mt-1">
              Multi-Hazard Triage v4.2
            </div>
            <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">
              Live Closed-Loop Actuation
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShieldIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Municipal Response Fleet Ribbon */}
      <div className="bg-white/90 dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>Emergency Response Fleet & Domain Readiness</span>
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {availableTeamsCount} Units Ready for Rapid Deployment
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teams.map((team) => {
            const isAvailable = team.status === "AVAILABLE";
            const hazardColor =
              team.hazard_domain === "WILDFIRE"
                ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                : team.hazard_domain === "STRUCTURAL"
                ? "text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10"
                : "text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10";

            return (
              <div
                key={team.team_id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isAvailable
                    ? "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40"
                    : "bg-amber-50/50 dark:bg-slate-950/80 border-amber-400 dark:border-amber-500/40 ring-1 ring-amber-500/20"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {team.team_name.split(" - ")[0]}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isAvailable
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse"
                    }`}
                  >
                    {team.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                  {team.specialty}
                </p>
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`px-2 py-0.5 rounded border font-semibold ${hazardColor}`}>
                    {team.hazard_domain}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono">{team.team_id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Incident Queue List */}
      <div className="bg-white/90 dark:bg-[#0F172A]/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#0B1120]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <SirenIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Emergency Incident Dispatch Queue
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Live prioritized action queue sorted by ML Priority Score & Consequence of Failure
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/30">
            Real-Time Synchronization Active
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
          {sortedActions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No active emergency incidents reported. All infrastructure nominal.
            </div>
          ) : (
            sortedActions.map((action, idx) => {
              const isDispatched = action.status === "DISPATCHED";
              const isCompleted = action.status === "COMPLETED";
              const isPending = action.status === "PENDING";
              const countdown = getCountdownDisplay(action);

              const hazardBadgeColor =
                action.target_hazard === "WILDFIRE"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : action.target_hazard === "STRUCTURAL"
                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30"
                  : "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30";

              return (
                <div
                  key={action.action_id}
                  className={`p-5 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isDispatched
                      ? "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/30 border-l-4 border-amber-500"
                      : isCompleted
                      ? "bg-slate-50/70 dark:bg-slate-900/30 opacity-75 border-l-4 border-emerald-500"
                      : "bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-rose-500"
                  }`}
                >
                  {/* Left Column: Severity, Asset, & Action Details */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-mono">
                        #{idx + 1}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${hazardBadgeColor}`}>
                        {action.target_hazard}
                      </span>
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {action.asset_id}
                      </span>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Target Response: {action.target_response_time}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Priority Score: <strong className="text-cyan-600 dark:text-cyan-400">{Math.round(action.priority_score)}/100</strong>
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{action.recommended_action}</span>
                    </div>

                    {action.reasoning && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium line-clamp-2">
                        Reasoning: {action.reasoning}
                      </p>
                    )}

                    {/* Status & Assignment Banner */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-400">Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isDispatched
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse"
                              : isCompleted
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {action.status}
                        </span>
                      </div>

                      {action.assigned_team && (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500 dark:text-slate-400">Assigned Unit:</span>
                          <strong className="text-cyan-700 dark:text-cyan-300 font-semibold">{action.assigned_team}</strong>
                        </div>
                      )}

                      {countdown && (
                        <div
                          className={`flex items-center gap-1.5 font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                            countdown.isUrgent
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          }`}
                        >
                          <span>ETA Countdown:</span>
                          <span className="text-sm">{countdown.formatted}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Interactive Dispatch Controls */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {isPending && (
                      <div className="flex items-center gap-2">
                        {/* Select Unit Dropdown */}
                        <select
                          value={selectedTeams[action.action_id] || ""}
                          onChange={(e) => handleSelectTeam(action.action_id, e.target.value)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none max-w-[220px]"
                        >
                          <option value="">Select Response Unit...</option>
                          {teams.map((t) => (
                            <option
                              key={t.team_id}
                              value={t.team_id}
                              disabled={t.status !== "AVAILABLE"}
                            >
                              {t.team_name.split(" - ")[0]} ({t.status})
                            </option>
                          ))}
                        </select>

                        {/* Dispatch Button */}
                        <button
                          onClick={() => handleDispatch(action)}
                          disabled={dispatchingId === action.action_id}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white text-xs font-bold shadow-lg shadow-rose-600/30 hover:from-rose-500 hover:to-amber-500 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {dispatchingId === action.action_id ? (
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <SendIcon className="w-3.5 h-3.5" />
                          )}
                          <span>Dispatch Unit</span>
                        </button>
                      </div>
                    )}

                    {isDispatched && (
                      <button
                        onClick={() => handleComplete(action.action_id)}
                        disabled={completingId === action.action_id}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {completingId === action.action_id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle2Icon className="w-4 h-4" />
                        )}
                        <span>Mark Resolved</span>
                      </button>
                    )}

                    {isCompleted && (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30">
                        <CheckIcon className="w-4 h-4" />
                        <span>Incident Resolved</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
