"use client";

import React, { useEffect, useRef, useState } from "react";
import { AssetMonitoringData } from "../types";

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
  const polygonLayersRef = useRef<any[]>([]);
  const riverLayersRef = useRef<any[]>([]);
  const markersRef = useRef<{ [key: string]: any }>({});
  const LRef = useRef<any>(null);

  // View state: 3D vs 2D
  const [viewMode, setViewMode] = useState<"3D" | "2D">("3D");

  // Layer filters: Flood Risk, Infrastructure, Sensors, Satellite
  const [activeLayers, setActiveLayers] = useState<{
    floodRisk: boolean;
    infrastructure: boolean;
    sensors: boolean;
    satellite: boolean;
  }>({
    floodRisk: true,
    infrastructure: true,
    sensors: true,
    satellite: true,
  });

  const toggleLayer = (layerKey: "floodRisk" | "infrastructure" | "sensors" | "satellite") => {
    setActiveLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Helper to switch tile layer (Satellite vs Dark CartoDB)
  const updateTileLayer = (L: any, map: any, useSatellite: boolean) => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    const tileUrl = useSatellite
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    const tile = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: useSatellite ? "&copy; Esri World Imagery" : "&copy; CartoDB",
    }).addTo(map);
    tileLayerRef.current = tile;
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      LRef.current = L;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [13.045, 80.260],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
        });

        // Fit tightly between H01 [13.0827, 80.2707] and B17 [13.0067, 80.2570]
        map.fitBounds(
          [
            [13.090, 80.285],
            [13.000, 80.245],
          ],
          { padding: [30, 30], maxZoom: 13 }
        );

        L.control.zoom({ position: "topright" }).addTo(map);

        updateTileLayer(L, map, activeLayers.satellite);

        // Glowing Blue River Channels (Adyar River Corridor) matching screenshot
        const adyarRiver = L.polyline(
          [
            [13.0010, 80.1700],
            [13.0035, 80.1920],
            [13.0050, 80.2080],
            [13.0075, 80.2240],
            [13.0110, 80.2380],
            [13.0132, 80.2470],
            [13.0085, 80.2565],
            [13.0067, 80.2570], // River Bridge (B17)
            [13.0055, 80.2650],
            [13.0070, 80.2740],
            [13.0100, 80.2830],
            [13.0130, 80.2880],
          ],
          {
            color: "#00f0ff",
            weight: 4,
            opacity: 0.95,
            lineCap: "round",
            className: "neon-river drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]",
          }
        ).addTo(map);
        adyarRiver.bindTooltip("Adyar River Arterial Drainage Channel", {
          sticky: true,
          className: "bg-[#0B132B] text-cyan-300 border border-[#1E3A5F] text-[10px] px-2 py-1 rounded shadow-lg",
        });

        // Low-Elevation Flood Inundation Polygons
        const floodPolygon1 = L.polygon(
          [
            [13.004, 80.210],
            [13.012, 80.230],
            [13.018, 80.255],
            [13.010, 80.270],
            [13.002, 80.240],
          ],
          {
            color: "#38bdf8",
            weight: 1.5,
            fillColor: "#0284c7",
            fillOpacity: 0.35,
            dashArray: "4, 6",
          }
        ).addTo(map);
        floodPolygon1.bindTooltip("Adyar Depression Inundation Zone (Elev 3.8m)", {
          sticky: true,
          className: "bg-[#0B132B] text-sky-300 border border-[#1E3A5F] text-[10px] px-2 py-1 rounded",
        });

        const floodPolygon2 = L.polygon(
          [
            [13.078, 80.262],
            [13.085, 80.265],
            [13.088, 80.275],
            [13.081, 80.275],
          ],
          {
            color: "#f43f5e",
            weight: 1.5,
            fillColor: "#e11d48",
            fillOpacity: 0.35,
            dashArray: "4, 6",
          }
        ).addTo(map);
        floodPolygon2.bindTooltip("Metro Hospital Depression Inundation Basin", {
          sticky: true,
          className: "bg-[#0B132B] text-rose-300 border border-[#1E3A5F] text-[10px] px-2 py-1 rounded",
        });

        riverLayersRef.current = [adyarRiver];
        polygonLayersRef.current = [floodPolygon1, floodPolygon2];
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      // Render Dynamic Asset Markers
      assets.forEach((asset) => {
        let lat = asset.latitude;
        let lng = asset.longitude;
        if (!lat || !lng) {
          if (asset.asset_id === "H01") { lat = 13.0827; lng = 80.2707; }
          else if (asset.asset_id === "B17") { lat = 13.0067; lng = 80.2570; }
          else if (asset.asset_id === "D03") { lat = 13.0120; lng = 80.2480; }
          else if (asset.asset_id === "R08") { lat = 13.0450; lng = 80.2210; }
          else { lat = 13.0400; lng = 80.2500; }
        }

        const isH01 = asset.asset_id === "H01";
        const isB17 = asset.asset_id === "B17";
        const isCritical = asset.status === "CRITICAL" || asset.risk_score >= 85 || isH01;
        const isHigh = asset.status === "HIGH" || asset.status === "ELEVATED" || asset.risk_score >= 70 || isB17;
        const isSelected = selectedAssetId === asset.asset_id;

        const pinColor = isH01 ? "#ef4444" : isB17 ? "#f59e0b" : isCritical ? "#ef4444" : isHigh ? "#f59e0b" : "#10b981";
        const iconEmoji = isH01 ? "🏥" : isB17 ? "🌉" : asset.type === "Drain" ? "🌊" : "📍";

        // Neon Glowing Node Pins matching specification:
        // H01: w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(239,68,68,1)] + animate-ping
        // B17: w-6 h-6 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(245,158,11,1)]
        let pinBodyHtml = "";
        if (isH01) {
          pinBodyHtml = `
            <div class="relative w-8 h-8 flex items-center justify-center">
              <div class="absolute w-6 h-6 bg-red-500 rounded-full animate-ping opacity-75"></div>
              <div class="relative z-10 w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(239,68,68,1)] flex items-center justify-center text-[9px] font-black text-white">
                H01
              </div>
            </div>
          `;
        } else if (isB17) {
          pinBodyHtml = `
            <div class="relative w-8 h-8 flex items-center justify-center">
              <div class="relative z-10 w-6 h-6 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(245,158,11,1)] flex items-center justify-center text-[9px] font-black text-white">
                B17
              </div>
            </div>
          `;
        } else {
          pinBodyHtml = `
            <div class="relative w-8 h-8 flex items-center justify-center">
              <div class="relative z-10 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(16,185,129,0.9)] flex items-center justify-center text-[9px] font-black text-white">
                ${asset.asset_id}
              </div>
            </div>
          `;
        }

        const iconHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
            <!-- Callout Pill -->
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 3px 8px;
              background: rgba(11, 19, 43, 0.95);
              border: 1.5px solid ${isSelected ? '#38bdf8' : isH01 ? '#ef4444' : isB17 ? '#f59e0b' : pinColor};
              border-radius: 8px;
              white-space: nowrap;
              box-shadow: 0 4px 20px ${isH01 ? 'rgba(239, 68, 68, 0.6)' : isB17 ? 'rgba(245, 158, 11, 0.6)' : pinColor + '66'};
              font-family: system-ui, -apple-system, sans-serif;
              margin-bottom: 4px;
              backdrop-filter: blur(8px);
            ">
              <span style="font-size: 12px;">${iconEmoji}</span>
              <span style="font-size: 11px; font-weight: 800; color: #ffffff;">${asset.name.split(' ')[0]} (${asset.asset_id})</span>
              <span style="font-size: 11px; font-weight: 900; color: ${isH01 ? '#ef4444' : isB17 ? '#f59e0b' : pinColor}; border-left: 1px solid #1E3A5F; padding-left: 6px;">
                Risk: ${Math.round(asset.risk_score)}
              </span>
            </div>

            <!-- Glowing UI Circle Pin -->
            ${pinBodyHtml}

            <!-- Pointer Triangle -->
            <div style="
              width: 0; 
              height: 0; 
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${isSelected ? '#38bdf8' : isH01 ? '#ef4444' : isB17 ? '#f59e0b' : pinColor};
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
  }, [assets, selectedAssetId, onSelectAsset]);

  // Handle layer toggles
  useEffect(() => {
    if (!mapInstanceRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapInstanceRef.current;

    updateTileLayer(L, map, activeLayers.satellite);

    // Toggle flood polygons
    polygonLayersRef.current.forEach((layer) => {
      if (activeLayers.floodRisk) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    });

    // Toggle markers based on sensors / infrastructure filters
    Object.entries(markersRef.current).forEach(([assetId, marker]) => {
      if (activeLayers.sensors || activeLayers.infrastructure) {
        if (!map.hasLayer(marker)) map.addLayer(marker);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });
  }, [activeLayers]);

  const containerClasses =
    className ||
    "relative w-full h-[400px] lg:h-[460px] rounded-xl overflow-hidden border border-[#1E3A5F] shadow-2xl bg-[url('/image_715fc4.jpg')] bg-cover bg-center inner-shadow";

  return (
    <div className={containerClasses}>
      {/* 3D View Perspective wrapper */}
      <div
        className="w-full h-full transition-transform duration-500 ease-out origin-bottom bg-[url('/image_715fc4.jpg')] bg-cover bg-center rounded-xl inner-shadow"
        style={
          viewMode === "3D"
            ? {
                transform: "perspective(1000px) rotateX(12deg) scale(1.02)",
              }
            : {}
        }
      >
        <div
          ref={mapContainerRef}
          className="w-full h-full filter brightness-[0.7] contrast-[1.25] saturate-[1.5] hue-rotate-[-10deg] bg-[url('/image_715fc4.jpg')] bg-cover bg-center rounded-xl inner-shadow"
        />
      </div>

      {/* Top Header Overlay: Title, 3D/2D Toggles & Layer Filters */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between pointer-events-none gap-2">
        {/* Title */}
        <div className="bg-[#0B132B]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E3A5F] flex items-center gap-2 pointer-events-auto shadow-xl">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">
            City Digital Twin - Live View
          </span>
        </div>

        {/* View Toggles & Layer Filter Chips */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 3D / 2D View Switcher */}
          <div className="bg-[#0B132B]/95 backdrop-blur-md p-1 rounded-lg border border-[#1E3A5F] flex items-center gap-1 shadow-xl">
            {(["3D", "2D"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                  viewMode === mode
                    ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Layer Filter Buttons */}
          <div className="bg-[#0B132B]/95 backdrop-blur-md p-1 rounded-lg border border-[#1E3A5F] flex items-center gap-1 shadow-xl">
            <button
              onClick={() => toggleLayer("floodRisk")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                activeLayers.floodRisk
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Flood Risk
            </button>
            <button
              onClick={() => toggleLayer("infrastructure")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                activeLayers.infrastructure
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Infrastructure
            </button>
            <button
              onClick={() => toggleLayer("sensors")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                activeLayers.sensors
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sensors
            </button>
            <button
              onClick={() => toggleLayer("satellite")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                activeLayers.satellite
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Satellite
            </button>
          </div>
        </div>
      </div>

      {/* Bottom-Left Map Legend */}
      <div className="absolute bottom-3 left-3 bg-[#0B132B]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E3A5F] z-[1000] flex items-center gap-3 text-[10px] font-medium text-slate-300 shadow-xl pointer-events-auto">
        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">
          Risk Scale:
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span className="text-rose-400 font-bold">Critical</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-amber-300 font-medium">High</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-yellow-300">Medium</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-emerald-400">Low</span>
        </span>
      </div>
    </div>
  );
}
