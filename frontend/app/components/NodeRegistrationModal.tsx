"use client";

import React, { useState } from "react";
import { ShieldIcon, AlertTriangleIcon, CheckCircle2Icon, MapPinIcon } from "./Icons";
import { triggerHaptic } from "./CursorGlow";

interface NodeRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (assetData: any) => void;
  apiBaseUrl?: string;
}

const PRESETS = [
  {
    label: "Vandalur Reserve Forest (Wildfire)",
    asset_id: "F09",
    name: "Vandalur Reserve Forest",
    domain: "FORESTRY",
    asset_type: "Forest_Reserve",
    target_hazard: "WILDFIRE",
    latitude: 12.8797,
    longitude: 80.0815,
    criticality: 0.82,
    population_impact: 32000,
  },
  {
    label: "Ennore High-Voltage Substation (Industrial)",
    asset_id: "S04",
    name: "Ennore Grid Substation S04",
    domain: "INDUSTRIAL",
    asset_type: "Substation",
    target_hazard: "STRUCTURAL",
    latitude: 13.2100,
    longitude: 80.3200,
    criticality: 0.90,
    population_impact: 58000,
  },
  {
    label: "Saidapet Arterial Causeway (Flood/Scour)",
    asset_id: "C07",
    name: "Saidapet Arterial Causeway",
    domain: "URBAN_INFRASTRUCTURE",
    asset_type: "Bridge",
    target_hazard: "FLOOD",
    latitude: 13.0210,
    longitude: 80.2240,
    criticality: 0.78,
    population_impact: 22000,
  },
];

export default function NodeRegistrationModal({
  isOpen,
  onClose,
  onRegisterSuccess,
  apiBaseUrl = "http://127.0.0.1:8000",
}: NodeRegistrationModalProps) {
  const [assetId, setAssetId] = useState<string>("F09");
  const [name, setName] = useState<string>("Vandalur Reserve Forest");
  const [domain, setDomain] = useState<string>("FORESTRY");
  const [assetType, setAssetType] = useState<string>("Forest_Reserve");
  const [targetHazard, setTargetHazard] = useState<string>("WILDFIRE");
  const [latitude, setLatitude] = useState<number>(12.8797);
  const [longitude, setLongitude] = useState<number>(80.0815);
  const [criticality, setCriticality] = useState<number>(0.82);
  const [populationImpact, setPopulationImpact] = useState<number>(32000);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    triggerHaptic([20]);
    setAssetId(preset.asset_id);
    setName(preset.name);
    setDomain(preset.domain);
    setAssetType(preset.asset_type);
    setTargetHazard(preset.target_hazard);
    setLatitude(preset.latitude);
    setLongitude(preset.longitude);
    setCriticality(preset.criticality);
    setPopulationImpact(preset.population_impact);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    triggerHaptic([30, 20, 30]);

    const payload = {
      asset_id: assetId.trim().toUpperCase(),
      name: name.trim(),
      domain,
      asset_type: assetType,
      target_hazard: targetHazard,
      latitude: Number(latitude),
      longitude: Number(longitude),
      criticality: Number(criticality),
      population_impact: Number(populationImpact),
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/assets/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const result = await res.json();
      onRegisterSuccess(result.asset);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register node.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#0F172A] border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/20 dark:shadow-cyan-950/50 flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-md">
              <ShieldIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span>Dynamic Edge Node Registration</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-mono">
                  Step 4
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Provision a new physical or virtual telemetry node with live weather fusion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quick Presets */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              ⚡ Quick Location Presets:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PRESETS.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-3 py-2 text-left rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    assetId === preset.asset_id
                      ? "bg-cyan-50 dark:bg-cyan-500/20 border-cyan-400 dark:border-cyan-500/50 text-cyan-700 dark:text-cyan-300 shadow-sm shadow-cyan-500/20"
                      : "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="font-bold text-slate-900 dark:text-white truncate">{preset.name.split(" ")[0]}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between mt-1">
                    <span>{preset.target_hazard}</span>
                    <span className="font-mono">{preset.asset_id}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Asset ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Asset Identifier (ID) *
              </label>
              <input
                type="text"
                required
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="e.g. F09, B18, S04"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

            {/* Asset Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Asset Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vandalur Reserve Forest"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

            {/* Target Hazard */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Hazard Domain *
              </label>
              <select
                value={targetHazard}
                onChange={(e) => setTargetHazard(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              >
                <option value="WILDFIRE">🔥 WILDFIRE (Thermal Anomaly & Brush Dryness)</option>
                <option value="FLOOD">🌊 FLOOD (Water Level, Rise Rate & NDWI)</option>
                <option value="STRUCTURAL">🏗️ STRUCTURAL (Vibration, Tilt & Pier Scour)</option>
              </select>
            </div>

            {/* Infrastructure Domain */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Domain Classification *
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              >
                <option value="FORESTRY">FORESTRY & RESERVES</option>
                <option value="URBAN_INFRASTRUCTURE">URBAN INFRASTRUCTURE</option>
                <option value="INDUSTRIAL">INDUSTRIAL & POWER GRID</option>
              </select>
            </div>

            {/* Asset Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Asset Type *
              </label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              >
                <option value="Forest_Reserve">Forest Reserve / National Park</option>
                <option value="Hospital">Hospital / Healthcare Facility</option>
                <option value="Bridge">Bridge / Causeway / Overpass</option>
                <option value="Substation">Power Substation / Electrical</option>
                <option value="Road">Arterial Highway / Underpass</option>
              </select>
            </div>

            {/* Population Impact */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Population Served / At Risk *
              </label>
              <input
                type="number"
                required
                min={0}
                value={populationImpact}
                onChange={(e) => setPopulationImpact(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

            {/* Latitude */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Latitude *</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Longitude *</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Criticality Slider */}
          <div className="pt-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              <span>Facility Criticality Factor:</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                {criticality.toFixed(2)} / 1.00 ({Math.round(criticality * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.01}
              value={criticality}
              onChange={(e) => setCriticality(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              <span>Low Consequence (0.1)</span>
              <span>Moderate (0.5)</span>
              <span>Life-Safety Critical (1.0)</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registering Node & Ingesting Weather...</span>
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="w-4 h-4" />
                  <span>Register Node to Live Grid</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
