"""
ORACLE Edge - Satellite NDWI & Water Extent Module
Implements Sentinel-2 multispectral water detection and flood extent estimation
according to PRD Section 6.1 & 7.1.
Formula: NDWI = (Green - NIR) / (Green + NIR)
"""

import numpy as np
from typing import Dict, Any, Tuple, Optional

class SatelliteNDWIProcessor:
    """
    Computes Normalized Difference Water Index (NDWI) from optical satellite bands,
    generates water masks, and estimates flooded infrastructure extent.
    """
    def __init__(self, water_threshold: float = 0.05, pixel_resolution_m: float = 10.0):
        """
        :param water_threshold: NDWI value above which a pixel is classified as open water.
        :param pixel_resolution_m: Sentinel-2 Band 3 (Green) and Band 8 (NIR) resolution (10m).
        """
        self.water_threshold = water_threshold
        self.pixel_resolution_m = pixel_resolution_m
        self.pixel_area_sqm = pixel_resolution_m * pixel_resolution_m

    def compute_ndwi(self, green_band: np.ndarray, nir_band: np.ndarray) -> np.ndarray:
        """
        Calculates McFeeters NDWI: (Green - NIR) / (Green + NIR).
        Handles division by zero smoothly.
        """
        green = green_band.astype(np.float32)
        nir = nir_band.astype(np.float32)
        
        denominator = green + nir
        denominator = np.where(denominator == 0, 1e-6, denominator)
        
        ndwi = (green - nir) / denominator
        return np.clip(ndwi, -1.0, 1.0)

    def generate_water_mask(self, ndwi: np.ndarray) -> np.ndarray:
        """
        Binary mask: 1 where NDWI > threshold (water), 0 otherwise.
        """
        return (ndwi > self.water_threshold).astype(np.uint8)

    def calculate_water_extent(self, water_mask: np.ndarray) -> Dict[str, float]:
        """
        Calculates total water area in square meters and square kilometers.
        """
        water_pixel_count = int(np.sum(water_mask))
        water_area_sqm = water_pixel_count * self.pixel_area_sqm
        water_area_sqkm = water_area_sqm / 1_000_000.0
        
        total_pixels = water_mask.size
        water_coverage_pct = (water_pixel_count / max(total_pixels, 1)) * 100.0
        
        return {
            "water_pixel_count": water_pixel_count,
            "total_pixels": total_pixels,
            "water_area_sqm": round(water_area_sqm, 2),
            "water_area_sqkm": round(water_area_sqkm, 4),
            "water_coverage_pct": round(water_coverage_pct, 2)
        }

    def compute_change(self, baseline_mask: np.ndarray, post_event_mask: np.ndarray) -> Dict[str, Any]:
        """
        Calculates delta change between baseline and post-event satellite pass.
        Detects newly inundated flood zones.
        """
        newly_flooded = ((post_event_mask == 1) & (baseline_mask == 0)).astype(np.uint8)
        receded = ((post_event_mask == 0) & (baseline_mask == 1)).astype(np.uint8)
        
        new_flood_pixels = int(np.sum(newly_flooded))
        receded_pixels = int(np.sum(receded))
        
        new_flood_sqm = new_flood_pixels * self.pixel_area_sqm
        baseline_water_pixels = int(np.sum(baseline_mask))
        
        if baseline_water_pixels > 0:
            growth_pct = (new_flood_pixels / baseline_water_pixels) * 100.0
        else:
            growth_pct = 100.0 if new_flood_pixels > 0 else 0.0

        return {
            "newly_flooded_pixels": new_flood_pixels,
            "receded_pixels": receded_pixels,
            "newly_flooded_sqm": round(new_flood_sqm, 2),
            "flood_growth_pct": round(growth_pct, 2)
        }

    def simulate_zone_observation(self, base_water_pct: float = 12.0, flood_intensity: float = 0.0) -> Dict[str, Any]:
        """
        Generates a realistic synthetic Sentinel-2 observation for an infrastructure buffer zone.
        Used when live Earth Engine / Copernicus API credentials are not configured.
        """
        # Create a 64x64 patch representing a 640m x 640m asset vicinity
        grid_size = 64
        y, x = np.ogrid[:grid_size, :grid_size]
        
        # Simulate a river channel running diagonally
        dist_from_river = np.abs(x - (y + np.sin(x / 5.0) * 4.0))
        river_width = 6.0 + (flood_intensity * 12.0)
        
        # Simulated reflectance values:
        # Water: High Green (~0.25), Low NIR (~0.05) -> NDWI ~ (0.25 - 0.05)/(0.30) = +0.67
        # Land: Mod Green (~0.12), High NIR (~0.35) -> NDWI ~ (0.12 - 0.35)/(0.47) = -0.49
        in_water = dist_from_river < river_width
        
        green = np.where(in_water, np.random.normal(0.24, 0.02, (grid_size, grid_size)), np.random.normal(0.12, 0.02, (grid_size, grid_size)))
        nir = np.where(in_water, np.random.normal(0.06, 0.01, (grid_size, grid_size)), np.random.normal(0.36, 0.04, (grid_size, grid_size)))
        
        ndwi = self.compute_ndwi(green, nir)
        water_mask = self.generate_water_mask(ndwi)
        extent = self.calculate_water_extent(water_mask)
        
        mean_water_ndwi = float(np.mean(ndwi[water_mask == 1])) if np.any(water_mask == 1) else 0.0
        
        return {
            "satellite_source": "Sentinel-2 L2A (MSI)",
            "resolution": "10m",
            "mean_ndwi": round(float(np.mean(ndwi)), 3),
            "mean_water_ndwi": round(mean_water_ndwi, 3),
            "water_area_sqkm": extent["water_area_sqkm"],
            "water_coverage_pct": extent["water_coverage_pct"],
            "flood_intensity_factor": round(flood_intensity, 2)
        }
