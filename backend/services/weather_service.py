"""
ORACLE Edge - Step 3: Live Weather Client & Resilient Circuit Breaker
Fetches real-time precipitation and short-term forecasts from Open-Meteo API.
Includes:
- Strict 2.0-second asynchronous and synchronous timeouts (httpx.Timeout(2.0, connect=2.0))
- In-memory cache storing last successful rainfall metrics per coordinate pair
- Resilient circuit breaker: serves cached or nominal fallback data on timeout/error
- Health diagnostic status tracking: 'LIVE' vs 'FALLBACK'
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
    Open-Meteo Weather Service with strict 2.0s timeout and circuit breaker fallback.
    Computes:
    - rainfall_1h (mm)
    - rainfall_3h (rolling sum in mm)
    - rainfall_24h (rolling sum in mm)
    - forecast_heavy_rain (bool: True if next 3 hours show > 10mm/h)
    - api_status: "LIVE" | "FALLBACK"
    """

    def __init__(self, timeout: float = 2.0):
        # Strict 2.0s connect and read timeout per PRD specifications
        self.timeout = httpx.Timeout(timeout, connect=timeout)
        self.timeout_seconds = timeout
        
        # Fresh TTL cache keyed by (round(lat, 4), round(lon, 4))
        self._cache: Dict[Tuple[float, float], Dict[str, Any]] = {}
        
        # Last successful metrics cache per coordinate pair (survives TTL expiry on API outages)
        self._last_successful_cache: Dict[Tuple[float, float], Dict[str, Any]] = {}
        self._global_last_successful: Optional[Dict[str, Any]] = None
        
        # Service status: "LIVE" or "FALLBACK"
        self._status: str = "LIVE"

    def get_status(self) -> str:
        """Returns the current operational status of the Open-Meteo service ('LIVE' | 'FALLBACK')."""
        return self._status

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
                cached_data["api_status"] = self._status
                return cached_data
        return None

    def set_cache(self, latitude: float, longitude: float, data: Dict[str, Any]):
        """Stores weather data in memory cache and records last successful metrics."""
        key = self._get_cache_key(latitude, longitude)
        self._cache[key] = {
            "timestamp": time.time(),
            "data": data
        }
        # Persist as last known successful metrics
        successful_metrics = {
            "rainfall_1h": data.get("rainfall_1h", 4.2),
            "rainfall_3h": data.get("rainfall_3h", 14.8),
            "rainfall_24h": data.get("rainfall_24h", 28.5),
            "temperature_c": data.get("temperature_c", 33.0),
            "humidity_pct": data.get("humidity_pct", 55.0),
            "wind_speed_kmh": data.get("wind_speed_kmh", 14.0),
            "forecast_heavy_rain": data.get("forecast_heavy_rain", False),
            "forecast_max_hourly": data.get("forecast_max_hourly", 0.0),
            "source": "Open-Meteo (Cached)",
            "api_status": "FALLBACK",
            "cached": True,
            "fallback": True,
            "timestamp": datetime.utcnow().isoformat()
        }
        self._last_successful_cache[key] = successful_metrics
        self._global_last_successful = successful_metrics

    async def fetch_weather_async(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Asynchronously queries the Open-Meteo Forecast API with a strict 2.0s timeout.
        Falls back to last successful cache or nominal defaults on timeout/connection error.
        Never delays or crashes the calling telemetry ingestion loop.
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
                    self._status = "LIVE"
                    computed["cached"] = False
                    computed["cache_age_sec"] = 0.0
                    computed["api_status"] = "LIVE"
                    return computed
                else:
                    print("[Weather Service] External API timeout. Serving cached/nominal fallback data.")
                    self._status = "FALLBACK"
        except (httpx.TimeoutException, httpx.ConnectError, Exception):
            print("[Weather Service] External API timeout. Serving cached/nominal fallback data.")
            self._status = "FALLBACK"

        return self._serve_fallback_or_cached(latitude, longitude)

    def fetch_weather_sync(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Synchronous Open-Meteo query with strict 2.0s timeout.
        Uses synchronous httpx.Client to prevent event-loop conflicts.
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
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(url)
                if response.status_code == 200:
                    payload = response.json()
                    computed = self._parse_open_meteo_payload(payload, latitude, longitude)
                    self.set_cache(latitude, longitude, computed)
                    self._status = "LIVE"
                    computed["cached"] = False
                    computed["cache_age_sec"] = 0.0
                    computed["api_status"] = "LIVE"
                    return computed
                else:
                    print("[Weather Service] External API timeout. Serving cached/nominal fallback data.")
                    self._status = "FALLBACK"
        except (httpx.TimeoutException, httpx.ConnectError, Exception):
            print("[Weather Service] External API timeout. Serving cached/nominal fallback data.")
            self._status = "FALLBACK"

        return self._serve_fallback_or_cached(latitude, longitude)

    def _serve_fallback_or_cached(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Returns last known successful metrics for coordinate pair if available, else nominal defaults."""
        key = self._get_cache_key(latitude, longitude)
        if key in self._last_successful_cache:
            stale = dict(self._last_successful_cache[key])
            stale["cached"] = True
            stale["fallback"] = True
            stale["api_status"] = "FALLBACK"
            stale["latitude"] = latitude
            stale["longitude"] = longitude
            return stale

        if self._global_last_successful:
            stale = dict(self._global_last_successful)
            stale["cached"] = True
            stale["fallback"] = True
            stale["api_status"] = "FALLBACK"
            stale["latitude"] = latitude
            stale["longitude"] = longitude
            return stale

        return self._nominal_fallback(latitude, longitude)

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
            "api_status": "LIVE",
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
        """Nominal default weather conditions when API is offline (PRD specifications)."""
        return {
            "source": "Nominal-Fallback",
            "api_status": "FALLBACK",
            "latitude": lat,
            "longitude": lon,
            "temperature_c": 33.0,
            "humidity_pct": 55.0,
            "wind_speed_kmh": 14.0,
            "current_precipitation": 0.0,
            "rainfall_1h": 4.2,
            "rainfall_3h": 14.8,
            "rainfall_24h": 28.5,
            "forecast_heavy_rain": False,
            "forecast_max_hourly": 1.2,
            "timestamp": datetime.utcnow().isoformat(),
            "cached": False,
            "fallback": True
        }


# Global singleton instance
weather_service = WeatherService(timeout=2.0)
