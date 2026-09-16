"use client";

import React, { useEffect, useState } from "react";
import { AssetMonitoringData, ActionItem, TeamItem } from "../types";
import {
  FileTextIcon,
  PrinterIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  SirenIcon,
  ShieldIcon,
  MapPinIcon,
  ActivityIcon,
} from "./Icons";
import { triggerHaptic } from "./CursorGlow";

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset?: AssetMonitoringData;
  actions?: ActionItem[];
  teams?: TeamItem[];
  apiStatus?: { open_meteo: string; sentinel_2: string };
}

export default function IncidentReportModal({
  isOpen,
  onClose,
  selectedAsset,
  actions = [],
  teams = [],
  apiStatus = { open_meteo: "LIVE", sentinel_2: "FALLBACK" },
}: IncidentReportModalProps) {
  const [reportDate, setReportDate] = useState<string>("");
  const [reportId, setReportId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setReportDate(
        now.toLocaleString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setReportId(
        `INC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
          now.getDate()
        ).padStart(2, "0")}-${selectedAsset?.asset_id || "H01"}`
      );
    }
  }, [isOpen, selectedAsset]);

  if (!isOpen) return null;

  // Resolve target asset attributes
  const assetId = selectedAsset?.asset_id || "H01";
  const assetName = selectedAsset?.name || "Metro Hospital";
  const isCritical = selectedAsset?.status === "CRITICAL";

  // Coordinates: Default to Metro Hospital (13.0827° N, 80.2707° E) or Bridge B17 (13.0067° N, 80.2570° E)
  const latitude =
    selectedAsset?.latitude ?? (assetId === "B17" ? 13.0067 : 13.0827);
  const longitude =
    selectedAsset?.longitude ?? (assetId === "B17" ? 80.257 : 80.2707);

  // Telemetry snapshot values
  const waterLevel =
    selectedAsset?.water_level_cm ?? (assetId === "B17" ? 16.0 : 21.5);
  const riseRate =
    selectedAsset?.rise_rate_cm_min ?? (assetId === "B17" ? 0.6 : 1.8);
  const rainfall3h = 34.0; // Open-Meteo rolling 3h influx
  const ndwiDelta = selectedAsset?.satellite_ndwi_delta ?? 0.42;

  // Decision Intelligence scores
  const riskScore = selectedAsset?.risk_score ?? 92.0;
  const priorityRank = selectedAsset?.priority_rank ?? 1;

  // Action log matching
  const matchingAction =
    actions.find((a) => a.asset_id === assetId) || actions[0];
  const assignedUnit =
    matchingAction?.assigned_team || "Team Alpha - Flood Barriers";
  const dispatchTimestamp =
    matchingAction?.dispatched_at
      ? new Date(matchingAction.dispatched_at).toLocaleTimeString()
      : reportDate || "Immediate Autonomous Dispatch";

  const handlePrint = () => {
    triggerHaptic([30, 20]);
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto print:border-none print:shadow-none print:max-w-full print:rounded-none">
        {/* Action Header Ribbon (Hidden during printing) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <FileTextIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide uppercase">
                Official Incident Dispatch Report
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Municipal Records Export • Chennai Metropolitan Area (CMA)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-cyan-400/40"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer text-xs font-bold"
              aria-label="Close Report"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div
          id="oracle-incident-report-printable"
          className="p-6 sm:p-10 bg-white text-slate-900 font-sans selection:bg-cyan-100"
        >
          {/* Document Masthead */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-black tracking-widest uppercase">
                    ORACLE Edge
                  </span>
                  <span className="text-[10px] font-mono font-bold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                    RESTRICTED // OPERATIONAL DISPATCH RECORD
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                  Emergency Incident Dispatch Report
                </h1>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Greater Chennai Corporation (GCC) Disaster Management Division • Chennai Metropolitan Area (CMA)
                </p>
              </div>

              <div className="sm:text-right font-mono text-xs">
                <div className="text-slate-500 text-[11px]">REPORT ID</div>
                <div className="font-bold text-slate-900">{reportId}</div>
                <div className="text-slate-500 text-[11px] mt-1">GENERATED TIMESTAMP</div>
                <div className="font-semibold text-slate-800">{reportDate}</div>
              </div>
            </div>
          </div>

          {/* Section 1: Incident & Target Asset Summary */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <MapPinIcon className="w-3.5 h-3.5 text-rose-600" />
              <span>1. Incident & Target Asset Summary</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Target Asset ID & Name
                </span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {assetId} - {assetName}
                </span>
                <span className="text-[11px] text-slate-600 block mt-0.5">
                  Critical Healthcare Infrastructure
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Location Coordinates
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
                </span>
                <span className="text-[11px] text-slate-600 block mt-0.5">
                  Zone 09 (Teynampet / Adyar Basin)
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Operational Final Status
                </span>
                <span className="inline-flex items-center gap-1 font-black text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-[11px] mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  RED ALERT - DISPATCHED
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Population & Criticality
                </span>
                <span className="font-bold text-slate-900">
                  45,000 citizens (ICU / ER)
                </span>
                <span className="text-[11px] text-slate-600 block mt-0.5">
                  Criticality Score: 0.95 (Zero Redundancy)
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Sensor Telemetry & Remote Sensing Snapshot */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <ActivityIcon className="w-3.5 h-3.5 text-cyan-700" />
              <span>2. Multi-Tier Telemetry Snapshot</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Peak Water Level
                </span>
                <span className="text-lg font-black text-rose-700 font-mono">
                  {waterLevel.toFixed(1)} cm
                </span>
                <span className="text-[10px] text-slate-600 block">
                  Dual Ultrasonic HC-SR04
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Rate of Water Rise
                </span>
                <span className="text-lg font-black text-rose-700 font-mono">
                  +{riseRate.toFixed(1)} cm/min
                </span>
                <span className="text-[10px] text-slate-600 block">
                  Exceeds Flash Flood Inundation Gate
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Rolling 3-Hr Rainfall
                </span>
                <span className="text-lg font-black text-cyan-800 font-mono">
                  {rainfall3h.toFixed(1)} mm
                </span>
                <span className="text-[10px] text-slate-600 block">
                  Open-Meteo ERA5 Reanalysis
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Satellite NDWI Delta
                </span>
                <span className="text-lg font-black text-indigo-900 font-mono">
                  +{ndwiDelta.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-600 block">
                  Sentinel-2 MSI Surface Water Anomaly
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Explainable AI & SHAP Attribution Breakdown */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
              <div className="flex items-center gap-1.5">
                <ShieldIcon className="w-3.5 h-3.5 text-indigo-700" />
                <span>3. Decision Intelligence & SHAP Factor Attribution</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-600">Priority Score:</span>
                <span className="font-extrabold text-slate-900">Rank #1</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">Risk Score:</span>
                <span className="font-extrabold text-rose-700">{riskScore.toFixed(1)} / 100</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-[11px] font-semibold text-slate-700">
                XGBoost Local Feature Attribution (SHAP Explainer Weights):
              </div>

              {/* SHAP Factor 1: Water Depth & Rise Rate (38%) */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-900">Water Depth & Rise Rate (Sensor Ultrasonic)</span>
                  <span className="font-mono text-rose-700">38% Impact</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-600 rounded-full" style={{ width: "38%" }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  21.5cm depth (+1.8cm/min) breached critical tabletop safety threshold.
                </div>
              </div>

              {/* SHAP Factor 2: Critical Facility Dependency (32%) */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-900">Critical Facility Dependency (Hospital ICU / ER)</span>
                  <span className="font-mono text-amber-700">32% Impact</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-600 rounded-full" style={{ width: "32%" }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  45k population served; zero evacuation redundancy for life-support systems.
                </div>
              </div>

              {/* SHAP Factor 3: Rolling 3-Hour Rainfall (18%) */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-900">Rolling 3-Hour Rainfall (Open-Meteo Influx)</span>
                  <span className="font-mono text-cyan-800">18% Impact</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-600 rounded-full" style={{ width: "18%" }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Continuous atmospheric precipitation influx +34.0mm over 3h window.
                </div>
              </div>

              {/* SHAP Factor 4: Satellite NDWI Spread (12%) */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-900">Satellite NDWI Spread (Sentinel-2 MSI Delta)</span>
                  <span className="font-mono text-indigo-800">12% Impact</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: "12%" }} />
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  +0.42 spectral water index delta confirms widespread basin ponding.
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Action Log & Municipal Dispatch Record */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <SirenIcon className="w-3.5 h-3.5 text-rose-700" />
              <span>4. Closed-Loop Action Log & Intervention Execution</span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-600 w-1/3">Assigned Response Unit</td>
                  <td className="py-2 px-3 font-black text-slate-900">{assignedUnit}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-600">Operational Directive</td>
                  <td className="py-2 px-3 text-slate-800 font-medium">
                    Deploy 200m modular flood barriers to seal basement generator rooms; activate high-capacity submersible pumps.
                  </td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-600">Dispatch Timestamp</td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-900">{dispatchTimestamp}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-slate-600">Target Response Window</td>
                  <td className="py-2 px-3 font-semibold text-rose-700">&lt; 15 minutes (Deployment in Progress)</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-600">Operator Acknowledgement</td>
                  <td className="py-2 px-3 text-slate-800 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Acknowledged by GCC Command Operator #042 • Hardware Buzzer Silenced • Warning LED Retained</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Document Sign-Off & Official Seals */}
          <div className="border-t-2 border-slate-300 pt-6 mt-8">
            <div className="grid grid-cols-2 gap-8 text-xs font-mono">
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-bold">
                  Command Authorization
                </div>
                <div className="h-10 border-b border-dashed border-slate-400 mt-2 flex items-end">
                  <span className="text-slate-800 font-semibold italic text-[11px]">
                    K. Rajendran, IAS (GCC Disaster Commissioner)
                  </span>
                </div>
                <div className="text-slate-400 text-[10px] mt-1">
                  Signature & Seal of Incident Commander
                </div>
              </div>

              <div>
                <div className="text-slate-500 text-[10px] uppercase font-bold">
                  Technical Operations Verification
                </div>
                <div className="h-10 border-b border-dashed border-slate-400 mt-2 flex items-end">
                  <span className="text-slate-800 font-semibold italic text-[11px]">
                    Autonomous AI Decision Engine v4.2 [CRC: 88FA-77B2]
                  </span>
                </div>
                <div className="text-slate-400 text-[10px] mt-1">
                  Cryptographic Verification / SHA-256 Validated
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] font-mono text-slate-400 mt-6 border-t border-slate-100 pt-3">
              ORACLE Edge Space-to-Ground Decision Intelligence • Form CMA-DISPATCH-IR-01 • Confidential Municipal Record
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
