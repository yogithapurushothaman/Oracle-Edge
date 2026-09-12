"""
ORACLE Edge - Step 3: Live Weather Client
Fetches real-time precipitation and short-term forecasts from Open-Meteo API.
Includes 15-minute in-memory caching per coordinate pair.
"""

import time
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import httpx

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 15 * 60  # 15 minutes cache per asset coordinates


class WeatherService:
    """
    Asynchronous Open-Meteo Weather Service with in-memory TTL caching.
    Computes:
    - rainfall_1h (mm)
    - rainfall_3h (rolling sum in mm)
    - rainfall_24h (rolling sum in mm)
    - forecast_heavy_rain (bool: True if next 3 hours show > 10mm/h)
    """

    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout
        # Cache keyed by (round(lat, 4), round(lon, 4)) -> {"timestamp": float, "data": dict}
        self._cache: Dict[Tuple[float, float], Dict[str, Any]] = {}

    def _get_cache_key(self, latitude: float, longitude: float) -> Tuple[float, float]:
        return (round(float(latitude), 4), round(float(longitude), 4))

    def get_cached(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """Returns cached weather data if not expired."""
        key = self._get_cache_key(latitude, longitude)
        entry = self._cache.get(key)
        if entry:
            age = time.time() - entry["timestamp"]
            if age < CACHE_TTL_SECONDS:
                cached_data = dict(entry["data"])
                cached_data["cached"] = True
                cached_data["cache_age_sec"] = round(age, 1)
                return cached_data
        return None

    def set_cache(self, latitude: float, longitude: float, data: Dict[str, Any]):
        """Stores weather data in memory cache."""
        key = self._get_cache_key(latitude, longitude)
        self._cache[key] = {
            "timestamp": time.time(),
            "data": data
        }

    async def fetch_weather_async(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Asynchronously queries the free Open-Meteo Forecast API.
        Falls back gracefully to cached or baseline nominal values on failure.
        """
        cached = self.get_cached(latitude, longitude)
        if cached:
            return cached

        url = (
            f"{OPEN_METEO_BASE_URL}?"
            f"latitude={latitude}&longitude={longitude}&"
            f"hourly=precipitation,rain&"
            f"current=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m&"
            f"timezone=auto"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    payload = response.json()
                    computed = self._parse_open_meteo_payload(payload, latitude, longitude)
                    self.set_cache(latitude, longitude, computed)
                    computed["cached"] = False
                    computed["cache_age_sec"] = 0.0
                    return computed
                else:
                    print(f"[WARN] Open-Meteo API returned status {response.status_code}. Using fallback.")
        except Exception as e:
            print(f"[WARN] Open-Meteo API query error for ({latitude}, {longitude}): {e}. Using fallback.")

        # Fallback to expired cache if available, else nominal defaults
        key = self._get_cache_key(latitude, longitude)
        if key in self._cache:
            stale = dict(self._cache[key]["data"])
            stale["cached"] = True
            stale["stale"] = True
            return stale

        return self._nominal_fallback(latitude, longitude)

    def fetch_weather_sync(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Synchronous wrapper for fetch_weather_async."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If inside an existing async event loop, run directly in executor or task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, self.fetch_weather_async(latitude, longitude)).result()
            else:
                return loop.run_until_complete(self.fetch_weather_async(latitude, longitude))
        except Exception:
            return asyncio.run(self.fetch_weather_async(latitude, longitude))

    def _parse_open_meteo_payload(self, payload: Dict[str, Any], lat: float, lon: float) -> Dict[str, Any]:
        """Extracts and computes temperature, humidity, wind speed, and rainfall rolling sums."""
        current = payload.get("current", {})
        hourly = payload.get("hourly", {})

        current_precip = float(current.get("precipitation", 0.0))
        temperature_c = float(current.get("temperature_2m", 33.5))
        humidity_pct = float(current.get("relative_humidity_2m", 52.0))
        wind_speed_kmh = float(current.get("wind_speed_10m", 16.0))
        current_time_str = current.get("time", "")

        hourly_times = hourly.get("time", [])
        hourly_precip = hourly.get("precipitation", [])

        # Match current hour index
        curr_hour = current_time_str[:13] + ":00" if len(current_time_str) >= 13 else ""
        if curr_hour in hourly_times:
            idx = hourly_times.index(curr_hour)
        elif hourly_times:
            idx = min(len(hourly_times) - 1, 12)
        else:
            idx = -1

        if idx >= 0 and hourly_precip:
            rainfall_1h = round(float(hourly_precip[idx]) if idx < len(hourly_precip) else current_precip, 2)
            start_3h = max(0, idx - 2)
            slice_3h = [float(p) for p in hourly_precip[start_3h:idx + 1]]
            rainfall_3h = round(sum(slice_3h), 2)
            start_24h = max(0, idx - 23)
            slice_24h = [float(p) for p in hourly_precip[start_24h:idx + 1]]
            rainfall_24h = round(sum(slice_24h), 2)
            next_3h_slice = [float(p) for p in hourly_precip[idx + 1:idx + 4]]
            forecast_heavy_rain = any(p > 10.0 for p in next_3h_slice)
            forecast_max_hourly = max(next_3h_slice) if next_3h_slice else 0.0
        else:
            rainfall_1h = current_precip
            rainfall_3h = round(current_precip * 2.5, 2)
            rainfall_24h = round(current_precip * 8.0, 2)
            forecast_heavy_rain = False
            forecast_max_hourly = 0.0

        return {
            "source": "Open-Meteo",
            "latitude": lat,
            "longitude": lon,
            "temperature_c": round(temperature_c, 1),
            "humidity_pct": round(humidity_pct, 1),
            "wind_speed_kmh": round(wind_speed_kmh, 1),
            "current_precipitation": round(current_precip, 2),
            "rainfall_1h": rainfall_1h,
            "rainfall_3h": rainfall_3h,
            "rainfall_24h": rainfall_24h,
            "forecast_heavy_rain": forecast_heavy_rain,
            "forecast_max_hourly": round(forecast_max_hourly, 2),
            "timestamp": datetime.utcnow().isoformat()
        }

    def _nominal_fallback(self, lat: float, lon: float) -> Dict[str, Any]:
        """Nominal default weather conditions when API is offline."""
        return {
            "source": "Nominal-Fallback",
            "latitude": lat,
            "longitude": lon,
            "temperature_c": 33.0,
            "humidity_pct": 55.0,
            "wind_speed_kmh": 14.0,
            "current_precipitation": 0.0,
            "rainfall_1h": 0.0,
            "rainfall_3h": 0.0,
            "rainfall_24h": 0.0,
            "forecast_heavy_rain": False,
            "forecast_max_hourly": 0.0,
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
            "fallback": True
        }


# Global singleton instance
weather_service = WeatherService()
