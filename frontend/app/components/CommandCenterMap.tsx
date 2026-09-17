"use client";

import React, { useEffect, useRef, useState } from "react";
import { AssetMonitoringData } from "../types";

interface MapProps {
  assets: AssetMonitoringData[];
  selectedAssetId?: string;
  onSelectAsset?: (assetId: string) => void;
  className?: string;
}

type MapLayerType = "map" | "satellite" | "hybrid";

export default function CommandCenterMap({
  assets = [],
  selectedAssetId,
  onSelectAsset = () => {},
  className,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const labelsLayerRef = useRef<any>(null);
  const geojsonLayersRef = useRef<any[]>([]);
  const markersRef = useRef<{ [key: string]: any }>({});
  const LRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>("map");

  // Helper to switch tile layers
  const setTileLayer = (layerType: MapLayerType, L: any, map: any) => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    if (layerType === "map") {
      const tile = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
          attribution: "&copy; CartoDB",
        }
      ).addTo(map);
      tileLayerRef.current = tile;
    } else if (layerType === "satellite") {
      const tile = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "&copy; Esri World Imagery",
        }
      ).addTo(map);
      tileLayerRef.current = tile;
    } else if (layerType === "hybrid") {
      const tile = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 19,
          attribution: "&copy; Esri",
        }
      ).addTo(map);
      const labels = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);
      tileLayerRef.current = tile;
      labelsLayerRef.current = labels;
    }
  };

  // 1. Initialize Map, GIS Vectors, & Markers
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      LRef.current = L;

      if (!mapInstanceRef.current) {
        // Initial view: Chennai Adyar Basin Center
        const map = L.map(mapContainerRef.current, {
          center: [13.040, 80.250],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });

        // Fit bounds across all monitoring nodes
        map.fitBounds(
          [
            [13.090, 80.290],
            [13.000, 80.210],
          ],
          { padding: [35, 35], maxZoom: 13 }
        );

        L.control.zoom({ position: "topright" }).addTo(map);

        setTileLayer(activeLayer, L, map);

        // Add GIS River and Drainage Vectors (Adyar River, Buckingham Canal, Cooum River)
        const adyarVector = L.polyline(
          [
            [13.003, 80.190],
            [13.006, 80.212],
            [13.009, 80.235],
            [13.013, 80.248],
            [13.008, 80.262],
            [13.006, 80.278],
          ],
          {
            color: "#06b6d4",
            weight: 5,
            opacity: 0.7,
            dashArray: "1, 6",
            lineCap: "round",
          }
        ).addTo(map);
        adyarVector.bindTooltip("Adyar River Main Drainage Channel", {
          sticky: true,
          className: "bg-[#0B132B] text-cyan-300 border border-[#1E3A5F] text-[10px] px-2 py-1 rounded shadow-lg",
        });

        const buckinghamCanal = L.polyline(
          [
            [13.080, 80.278],
            [13.045, 80.269],
            [13.015, 80.260],
            [12.980, 80.255],
          ],
          {
            color: "#3b82f6",
            weight: 3.5,
            opacity: 0.6,
            dashArray: "4, 8",
          }
        ).addTo(map);
        buckinghamCanal.bindTooltip("Buckingham Canal Arterial", {
          sticky: true,
          className: "bg-[#0B132B] text-blue-300 border border-[#1E3A5F] text-[10px] px-2 py-1 rounded shadow-lg",
        });

        const cooumRiver = L.polyline(
          [
            [13.072, 80.220],
            [13.075, 80.245],
            [13.079, 80.270],
            [13.067, 80.288],
          ],
          {
            color: "#0284c7",
            weight: 4,
            opacity: 0.65,
          }
        ).addTo(map);
        cooumRiver.bindTooltip("Cooum River Basin Segment", {
          sticky: true,
          className: "bg-[#0B132B] text-sky-300 border border-[#1E3A5F] text-[10px] px-2 py-1 rounded shadow-lg",
        });

        geojsonLayersRef.current = [adyarVector, buckinghamCanal, cooumRiver];
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      // Render or update pins for each asset
      assets.forEach((asset) => {
        // Fallback coordinates for regional assets
        let lat = asset.latitude;
        let lng = asset.longitude;
        if (!lat || !lng) {
          if (asset.asset_id === "H01") { lat = 13.0827; lng = 80.2707; }
          else if (asset.asset_id === "B17") { lat = 13.0067; lng = 80.2570; }
          else if (asset.asset_id === "D03") { lat = 13.0120; lng = 80.2480; }
          else if (asset.asset_id === "R08") { lat = 13.0450; lng = 80.2210; }
          else if (asset.asset_id === "S05") { lat = 13.0320; lng = 80.2310; }
          else if (asset.asset_id === "B21") { lat = 13.0210; lng = 80.2410; }
          else if (asset.asset_id === "D07") { lat = 13.0080; lng = 80.2520; }
          else { lat = 13.0400; lng = 80.2500; }
        }

        const isCritical = asset.status === "CRITICAL" || asset.risk_score >= 85;
        const isHigh = asset.status === "HIGH" || asset.status === "ELEVATED" || asset.risk_score >= 60;
        const isSelected = selectedAssetId === asset.asset_id;

        // Type-specific icon
        let iconEmoji = "📍";
        const typeLower = (asset.type || "").toLowerCase();
        if (typeLower.includes("hospital")) iconEmoji = "🏥";
        else if (typeLower.includes("bridge")) iconEmoji = "🌉";
        else if (typeLower.includes("drain")) iconEmoji = "🌊";
        else if (typeLower.includes("road")) iconEmoji = "🛣️";
        else if (typeLower.includes("school")) iconEmoji = "🏫";
        else if (typeLower.includes("facility") || typeLower.includes("substation")) iconEmoji = "⚡";

        const pinColor = isCritical ? "#f43f5e" : isHigh ? "#f59e0b" : "#10b981";
        const pinBg = isCritical ? "rgba(244, 63, 94, 0.25)" : isHigh ? "rgba(245, 158, 11, 0.25)" : "rgba(16, 185, 129, 0.25)";
        const borderColor = isSelected ? "#38bdf8" : isCritical ? "#f43f5e" : isHigh ? "#fbbf24" : "#34d399";

        const iconHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
            <!-- Callout Pill -->
            <div style="
              display: flex;
              align-items: center;
              gap: 5px;
              padding: 3px 8px;
              background: #0B132BE6;
              border: 1.5px solid ${borderColor};
              border-radius: 6px;
              white-space: nowrap;
              box-shadow: 0 4px 16px ${pinColor}44;
              font-family: system-ui, -apple-system, sans-serif;
              margin-bottom: 4px;
              backdrop-filter: blur(6px);
            ">
              <span style="font-size: 11px;">${iconEmoji}</span>
              <span style="font-size: 10px; font-weight: 800; color: #ffffff; letter-spacing: 0.02em;">${asset.asset_id}</span>
              <span style="font-size: 10px; font-weight: 700; color: ${pinColor}; border-left: 1px solid #1E3A5F; padding-left: 4px;">
                ${Math.round(asset.risk_score)}
              </span>
            </div>

            <!-- Pulsing Anchor Circle -->
            <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              ${
                isCritical
                  ? `<div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: ${pinColor}; opacity: 0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                  : ""
              }
              <div style="
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: ${pinBg};
                border: 2px solid ${borderColor};
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 12px ${pinColor};
              ">
                <span style="font-size: 8px; font-weight: 900; color: #ffffff;">#${asset.priority_rank || 1}</span>
              </div>
            </div>

            <!-- Pointer Notch -->
            <div style="
              width: 0; 
              height: 0; 
              border-left: 4px solid transparent;
              border-right: 4px solid transparent;
              border-top: 5px solid ${borderColor};
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
          });
          markersRef.current[asset.asset_id] = marker;
        }
      });
    });

    return () => {
      isMounted = false;
    };
  }, [assets, selectedAssetId, onSelectAsset, activeLayer]);

  // Handle layer switcher change
  const handleLayerChange = (layer: MapLayerType) => {
    setActiveLayer(layer);
    if (mapInstanceRef.current && LRef.current) {
      setTileLayer(layer, LRef.current, mapInstanceRef.current);
    }
  };

  const containerClasses =
    className ||
    "relative w-full h-[400px] lg:h-[460px] rounded-xl overflow-hidden border border-[#1E3A5F] shadow-xl bg-[#0B132B]";

  return (
    <div className={containerClasses}>
      {/* Map Header Overlay: Title + Layer Switcher */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="bg-[#0B132B]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E3A5F] flex items-center gap-2 pointer-events-auto shadow-lg">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">
            Live Infrastructure Map
          </span>
          <span className="text-[10px] text-cyan-300 font-mono bg-[#132238] px-1.5 py-0.5 rounded border border-[#1E3A5F]">
            Chennai Urban Basin
          </span>
        </div>

        {/* Layer Switcher Buttons: [Map] [Satellite] [Hybrid] */}
        <div className="bg-[#0B132B]/95 backdrop-blur-md p-1 rounded-lg border border-[#1E3A5F] flex items-center gap-1 pointer-events-auto shadow-lg">
          {(["map", "satellite", "hybrid"] as MapLayerType[]).map((layer) => (
            <button
              key={layer}
              onClick={() => handleLayerChange(layer)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded capitalize transition-all cursor-pointer ${
                activeLayer === layer
                  ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40"
                  : "text-slate-400 hover:text-white hover:bg-[#132238]"
              }`}
            >
              {layer}
            </button>
          ))}
        </div>
      </div>

      {/* Leaflet Map Target */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Comprehensive Legend Bar at Bottom */}
      <div className="absolute bottom-3 left-3 right-3 bg-[#0B132B]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E3A5F] z-[1000] flex flex-wrap items-center justify-between text-[10px] font-medium text-slate-300 shadow-xl gap-2">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
            GIS Legend:
          </span>
          <span className="flex items-center gap-1">
            <span>🏥</span> Hospital
          </span>
          <span className="flex items-center gap-1">
            <span>🌉</span> Bridge
          </span>
          <span className="flex items-center gap-1">
            <span>🌊</span> Drain
          </span>
          <span className="flex items-center gap-1">
            <span>🛣️</span> Road
          </span>
          <span className="flex items-center gap-1">
            <span>⚡</span> Substation / School
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="text-rose-400 font-bold">Priority #1 Critical</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 font-medium">Elevated</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400">Safe Baseline</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-cyan-400" />
            <span className="text-cyan-300">Water Body Channel</span>
          </span>
        </div>
      </div>
    </div>
  );
}
