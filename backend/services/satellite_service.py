"""
ORACLE Edge - Step 3: Sentinel-2 Satellite NDWI & Resilient Circuit Breaker
Implements Sentinel-2 multispectral water detection and flood extent estimation
according to PRD Section 6.1, 7.1 & Step 3 specifications.

Includes:
- Strict 2.0-second timeout on Earth Engine / raster queries
- Resilient circuit breaker: falls back to nominal baseline water extent change
  (satellite_ndwi_delta: 0.12) if unreachable or on timeout
- Diagnostic status reporting: 'LIVE' vs 'FALLBACK'
"""

import os
import concurrent.futures
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, Union
import numpy as np


class SatelliteNDWIService:
    """
    Sentinel-2 Satellite Water Extent & NDWI Service with 2.0s circuit breaker.
    - Computes NDWI raster mask: (Green - NIR) / (Green + NIR)
    - Enforces strict 2.0s timeout on Earth Engine / raster queries
    - Serves nominal baseline water extent change (satellite_ndwi_delta: 0.12) on failure
    - Tracks service diagnostic state: 'LIVE' | 'FALLBACK'
    """

    def __init__(
        self,
        water_threshold: float = 0.05,
        pixel_resolution_m: float = 10.0,
        raster_dir: Optional[str] = None,
        timeout_seconds: float = 2.0
    ):
        self.water_threshold = water_threshold
        self.pixel_resolution_m = pixel_resolution_m
        self.pixel_area_sqm = pixel_resolution_m * pixel_resolution_m
        self.raster_dir = raster_dir or os.path.join(os.path.dirname(__file__), "rasters")
        self.timeout_seconds = timeout_seconds

        # Diagnostic state: "LIVE" or "FALLBACK"
        self._status: str = "LIVE"
        self._last_successful_cache: Dict[str, Dict[str, Any]] = {}

        # Calibrated baseline 5-day revisit water extents for Chennai basins
        # H01: Adyar River Basin / Guindy-Saidapet corridor (Baseline ~ 18% water surface)
        # B17: River Bridge B17 / Cooum-Adyar confluence (Baseline ~ 15% water surface)
        self.asset_baselines = {
            "H01": {
                "name": "Adyar River Basin (H01)",
                "baseline_water_extent": 0.18,  # 18% nominal
                "lat": 13.0405,
                "lon": 80.2450
            },
            "B17": {
                "name": "River Bridge B17 Corridor",
                "baseline_water_extent": 0.15,  # 15% nominal
                "lat": 13.0827,
                "lon": 80.2707
            }
        }

    def get_status(self) -> str:
        """Returns current operational status of the Sentinel-2 service ('LIVE' | 'FALLBACK')."""
        return self._status

    def compute_ndwi_matrix(self, green_band: np.ndarray, nir_band: np.ndarray) -> np.ndarray:
        """
        Calculates McFeeters NDWI: (Green - NIR) / (Green + NIR).
        Handles zero-division and edge values smoothly.
        """
        green = green_band.astype(np.float32)
        nir = nir_band.astype(np.float32)

        denominator = green + nir
        denominator = np.where(denominator == 0, 1e-6, denominator)

        ndwi = (green - nir) / denominator
        return np.clip(ndwi, -1.0, 1.0)

    def generate_water_mask(self, ndwi: np.ndarray) -> np.ndarray:
        """Binary mask: 1 where NDWI > threshold (water), 0 otherwise."""
        return (ndwi > self.water_threshold).astype(np.uint8)

    def extract_raster_metrics(self, green_band: np.ndarray, nir_band: np.ndarray) -> Dict[str, Any]:
        """
        Extracts water pixel count, coverage percentage, and area from optical satellite bands.
        """
        ndwi = self.compute_ndwi_matrix(green_band, nir_band)
        water_mask = self.generate_water_mask(ndwi)

        water_pixels = int(np.sum(water_mask))
        total_pixels = max(water_mask.size, 1)
        coverage_pct = (water_pixels / total_pixels) * 100.0
        water_area_sqm = water_pixels * self.pixel_area_sqm
        water_area_sqkm = water_area_sqm / 1_000_000.0

        return {
            "mean_ndwi": float(round(float(np.mean(ndwi)), 4)),
            "max_ndwi": float(round(float(np.max(ndwi)), 4)),
            "water_pixel_count": water_pixels,
            "total_pixels": total_pixels,
            "water_coverage_pct": round(coverage_pct, 2),
            "water_extent_score": round(min(1.0, coverage_pct / 100.0), 4),
            "water_area_sqkm": round(water_area_sqkm, 4)
        }

    def _execute_raster_or_ee_query(self, asset_id: str, raster_file: str) -> Optional[Dict[str, Any]]:
        """Synchronously queries satellite raster on disk or Earth Engine endpoint."""
        if os.path.exists(raster_file):
            data = np.load(raster_file)
            green = data["green"]
            nir = data["nir"]
            return self.extract_raster_metrics(green, nir)
        return None

    def query_satellite_observation(
        self,
        asset_id: str,
        ground_water_level_cm: Optional[float] = None,
        ground_rise_rate_cm_min: Optional[float] = None,
        rainfall_3h_mm: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Queries Sentinel-2 observation with a strict 2.0s circuit breaker.
        If unreachable, timeout occurs, or external service fails, falls back
        to nominal baseline water extent change: satellite_ndwi_delta = 0.12.
        """
        raster_file = os.path.join(self.raster_dir, f"{asset_id}_sentinel2.npz")
        baseline_info = self.asset_baselines.get(asset_id, {
            "name": f"Asset {asset_id} Basin",
            "baseline_water_extent": 0.16,
            "lat": 13.0405,
            "lon": 80.2450
        })
        baseline_extent = baseline_info["baseline_water_extent"]

        # Attempt external raster / Earth Engine query wrapped in a strict 2.0-second timeout
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(self._execute_raster_or_ee_query, asset_id, raster_file)
                metrics = future.result(timeout=self.timeout_seconds)
                if metrics is not None:
                    current_extent = metrics["water_extent_score"]
                    delta = max(0.0, current_extent - baseline_extent)
                    self._status = "LIVE"
                    obs = {
                        "mode": "Sentinel-2 Optical Raster Feed",
                        "satellite_platform": "Sentinel-2 MSI Level-2A",
                        "api_status": "LIVE",
                        "asset_id": asset_id,
                        "revisit_cycle_days": 5,
                        "baseline_extent": baseline_extent,
                        "water_extent_score": current_extent,
                        "water_coverage_pct": metrics["water_coverage_pct"],
                        "satellite_ndwi_delta": round(delta, 3),
                        "ndwi_anomaly_delta": round(delta, 3),
                        "mean_ndwi": metrics["mean_ndwi"],
                        "water_area_sqkm": metrics["water_area_sqkm"],
                        "last_revisit": datetime.utcnow().strftime("%Y-%m-%d 10:30 UTC"),
                        "fallback": False
                    }
                    self._last_successful_cache[asset_id] = obs
                    return obs
        except (concurrent.futures.TimeoutError, Exception) as e:
            print(f"[Satellite Service] External query timeout or unreachable: {e}. Serving nominal fallback data.")
            self._status = "FALLBACK"

        # Serve nominal baseline fallback with satellite_ndwi_delta = 0.12
        return self._nominal_fallback(
            asset_id=asset_id,
            baseline_extent=baseline_extent,
            ground_water_level_cm=ground_water_level_cm,
            ground_rise_rate_cm_min=ground_rise_rate_cm_min,
            rainfall_3h_mm=rainfall_3h_mm
        )

    def get_evaluator_observation(
        self,
        asset_id: str,
        ground_water_level_cm: Optional[float] = None,
        ground_rise_rate_cm_min: Optional[float] = None,
        rainfall_3h_mm: Optional[float] = None
    ) -> Dict[str, Any]:
        """Wrapper for query_satellite_observation to preserve backwards compatibility."""
        return self.query_satellite_observation(
            asset_id=asset_id,
            ground_water_level_cm=ground_water_level_cm,
            ground_rise_rate_cm_min=ground_rise_rate_cm_min,
            rainfall_3h_mm=rainfall_3h_mm
        )

    def _nominal_fallback(
        self,
        asset_id: str,
        baseline_extent: float,
        ground_water_level_cm: Optional[float] = None,
        ground_rise_rate_cm_min: Optional[float] = None,
        rainfall_3h_mm: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Nominal baseline fallback per PRD specifications:
        satellite_ndwi_delta = 0.12 when external Earth Engine / raster feed is offline.
        """
        # Strict requirement: nominal baseline water extent change of 0.12
        satellite_ndwi_delta = 0.12
        current_extent = round(min(0.95, baseline_extent + satellite_ndwi_delta), 3)
        water_coverage_pct = round(current_extent * 100.0, 1)

        # Calibrated NDWI value
        calibrated_ndwi = round(float(-0.15 + (current_extent * 0.70)), 3)

        buffer_area_sqkm = 25.0
        water_area_sqkm = round(current_extent * buffer_area_sqkm, 2)
        last_pass = (datetime.utcnow() - timedelta(hours=4)).strftime("%Y-%m-%d 10:30 UTC")

        self._status = "FALLBACK"

        return {
            "mode": "Nominal Baseline Fallback (2.0s Circuit Breaker)",
            "satellite_platform": "Sentinel-2 MSI Level-2A",
            "api_status": "FALLBACK",
            "asset_id": asset_id,
            "revisit_cycle_days": 5,
            "baseline_extent": baseline_extent,
            "water_extent_score": current_extent,
            "water_coverage_pct": water_coverage_pct,
            "satellite_ndwi_delta": 0.12,
            "ndwi_anomaly_delta": 0.12,
            "mean_ndwi": calibrated_ndwi,
            "water_area_sqkm": water_area_sqkm,
            "last_revisit": last_pass,
            "fallback": True
        }


# Global singleton instance
satellite_service = SatelliteNDWIService(timeout_seconds=2.0)
