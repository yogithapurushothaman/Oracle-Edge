"use client";

import React, { useEffect, useRef } from "react";
import { AssetMonitoringData } from "../types";
import { useTheme } from "../context/ThemeContext";

interface MapProps {
  assets: AssetMonitoringData[];
  selectedAssetId?: string;
  onSelectAsset?: (assetId: string) => void;
  className?: string;
}

export default function CommandCenterMap({
  assets = [],
  selectedAssetId,
  onSelectAsset = () => {},
  className,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const LRef = useRef<any>(null);

  const { theme } = useTheme();
  const isDark = theme === "dark";

  // 1. Initialize Map & Markers
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet to prevent SSR window reference error
    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      LRef.current = L;

      if (!mapInstanceRef.current) {
        // Initial view: center at [13.0447, 80.2638], zoom: 12
        const map = L.map(mapContainerRef.current, {
          center: [13.0447, 80.2638],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });

        // Fit tightly between H01 Hospital [13.0827, 80.2707] and B17 Bridge [13.0067, 80.2570]
        map.fitBounds(
          [
            [13.0827, 80.2707],
            [13.0067, 80.2570],
          ],
          { padding: [40, 40], maxZoom: 13 }
        );

        // Add Zoom Control at top-right
        L.control.zoom({ position: "topright" }).addTo(map);

        // Add Theme-specific Tile Layer
        const tileUrl = isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

        const tileLayer = L.tileLayer(tileUrl, {
          maxZoom: 19,
          subdomains: "abcd",
        }).addTo(map);

        tileLayerRef.current = tileLayer;
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Invalidate size 200ms after mount to prevent tile distortion or blank grey spaces
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      // Update or Create Markers for each asset
      assets.forEach((asset) => {
        const lat = asset.latitude ?? (asset.asset_id === "H01" ? 13.0827 : 13.0067);
        const lng = asset.longitude ?? (asset.asset_id === "H01" ? 80.2707 : 80.2570);
        const isCritical = asset.status === "CRITICAL";
        const isModerate = asset.status === "MODERATE" || asset.risk_score >= 45;

        // Hazard visual indicators
        const hazard = asset.target_hazard || "FLOOD";
        const hazardEmoji = hazard === "WILDFIRE" ? "🔥" : hazard === "STRUCTURAL" ? "🏗️" : "🌊";

        // Visual colors
        const pinColor = isCritical ? "#ef4444" : isModerate ? "#f59e0b" : "#10b981";
        const pinBg = isCritical ? "rgba(239, 68, 68, 0.25)" : isModerate ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 185, 129, 0.25)";
        const borderColor = isCritical ? "#f87171" : isModerate ? "#fbbf24" : "#34d399";

        const actionText = isCritical ? "Immediate Action" : isModerate ? "High Monitoring" : "Routine Safe";
        const calloutBadge = `Priority #${asset.priority_rank} | ${Math.round(asset.risk_score)} Risk | ${actionText}`;

        const isSelected = selectedAssetId === asset.asset_id;
        const bannerBg = isDark ? "#0B1120EE" : "#FFFFFFEE";
        const bannerTextColor = isDark ? "#ffffff" : "#0f172a";

        const iconHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
            <!-- Pulsing Callout Banner -->
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              background: ${bannerBg};
              border: 1.5px solid ${isSelected ? '#38bdf8' : borderColor};
              border-radius: 8px;
              white-space: nowrap;
              box-shadow: 0 4px 20px ${pinColor}55;
              font-family: system-ui, sans-serif;
              margin-bottom: 6px;
              backdrop-filter: blur(8px);
            ">
              <span style="font-size: 11px;">${hazardEmoji}</span>
              <span style="font-size: 11px; font-weight: 800; color: ${bannerTextColor}; letter-spacing: 0.02em;">${asset.name.split(' ')[0]} ${asset.asset_id}</span>
              <span style="font-size: 10px; font-weight: 700; color: ${pinColor}; padding-left: 4px; border-left: 1px solid ${isDark ? '#334155' : '#cbd5e1'};">${calloutBadge}</span>
            </div>

            <!-- Pin Anchor -->
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              ${isCritical ? `<div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${pinColor}; opacity: 0.5; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
              <div style="
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: ${pinBg};
                border: 2px solid ${isSelected ? '#38bdf8' : borderColor};
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 14px ${pinColor};
              ">
                <span style="font-size: 9px; font-weight: 900; color: ${isDark ? '#ffffff' : '#0f172a'};">${asset.asset_id}</span>
              </div>
            </div>
            <!-- Pin Pointer Triangle -->
            <div style="
              width: 0; 
              height: 0; 
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${isSelected ? '#38bdf8' : borderColor};
              margin-top: -2px;
            "></div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-div-icon",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        if (markersRef.current[asset.asset_id]) {
          markersRef.current[asset.asset_id].setIcon(customIcon);
          markersRef.current[asset.asset_id].setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

          marker.on("click", () => {
            onSelectAsset(asset.asset_id);
            const cardEl = document.getElementById(`card-${asset.asset_id}`);
            if (cardEl) {
              cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          });

          markersRef.current[asset.asset_id] = marker;
        }
      });
    });

    return () => {
      isMounted = false;
    };
  }, [assets, selectedAssetId, onSelectAsset, isDark]);

  // 2. Dynamic Tile Swapping & Map Invalidation on Theme Change
  useEffect(() => {
    if (!mapInstanceRef.current || !LRef.current) return;

    const L = LRef.current;
    const map = mapInstanceRef.current;

    // Remove existing tile layer if present
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    // Add new theme tile layer
    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    tileLayerRef.current = newTileLayer;

    // Trigger map.invalidateSize() inside a 200ms hook after theme switch
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => clearTimeout(timer);
  }, [isDark]);

  // 3. Window Resize Handler for Leaflet Invalidation
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const containerClasses =
    className ||
    "relative w-full h-[420px] md:h-[480px] rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700/60 shadow-lg bg-slate-100 dark:bg-[#0B1120] transition-all duration-300 ease-out hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]";

  return (
    <div className={containerClasses}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-medium z-[1000] flex items-center gap-4 text-slate-700 dark:text-slate-300 shadow-xl">
        <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
          Status Key:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span>Priority #1 Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span>Priority #2 Elevated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          <span>Safe Baseline</span>
        </div>
      </div>

      {/* Satellite / Sector Overlay */}
      <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] z-[1000] flex items-center gap-2.5 shadow-xl">
        <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
        <span className="text-slate-900 dark:text-white font-bold tracking-wide">
          Chennai Adyar Basin GIS
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
          Click marker to focus digital twin
        </span>
      </div>
    </div>
  );
}
