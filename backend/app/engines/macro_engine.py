import logging
from typing import Any
import httpx
from app.config import settings

logger = logging.getLogger("investorgpt.macro_engine")

# World Bank indicator codes
_WB_INDICATORS = {
    "gdp_growth": "NY.GDP.MKTP.KD.ZG",   # GDP growth (annual %)
    "inflation": "FP.CPI.TOTL.ZG",         # CPI inflation (annual %)
    "unemployment": "SL.UEM.TOTL.ZS",      # Unemployment, total (% of labour force)
}

# World Bank 2-letter ISO country codes mapped from country name keywords
_COUNTRY_CODE_MAP = {
    "INDIA": "IN",
    "JAPAN": "JP",
    "CHINA": "CN",
    "UK": "GB",
    "UNITED KINGDOM": "GB",
    "GERMANY": "DE",
    "FRANCE": "FR",
    "CANADA": "CA",
    "AUSTRALIA": "AU",
    "BRAZIL": "BR",
    "SOUTH KOREA": "KR",
    "SINGAPORE": "SG",
    "UNITED STATES": "US",
    "USA": "US",
    "US": "US",
}

# Hardcoded interest-rate fallbacks by country (World Bank doesn't have central bank rates)
_RATE_FALLBACKS = {
    "US": 5.25, "IN": 6.50, "JP": 0.25, "CN": 3.45,
    "GB": 5.00, "DE": 4.50, "FR": 4.50, "CA": 4.75,
    "AU": 4.35, "BR": 10.50, "KR": 3.50, "SG": 3.68,
}


class MacroEngine:
    """Fetches live macroeconomic indicators.

    Priority:
      1. FRED (if US and key is set) — most granular, monthly data
      2. World Bank API (free, no key, ~annual data for all countries)
      3. Hardcoded constants (last resort, clearly labeled)
    """

    def __init__(self):
        self.fred_key = settings.FRED_API_KEY

    async def get_macro_indicators(self, country: str = "USA") -> dict[str, Any]:
        logger.info(f"Retrieving macroeconomic indicators for {country}")
        country_upper = country.upper().strip()

        # 1. FRED for US (premium, if key configured)
        if country_upper in ("USA", "UNITED STATES", "US") and self.fred_key:
            try:
                return await self._fetch_fred_data()
            except Exception as e:
                logger.warning(f"FRED fetch failed: {e}. Trying World Bank.")

        # 2. World Bank (free, global)
        iso2 = self._country_to_iso2(country_upper)
        try:
            return await self._fetch_world_bank(iso2)
        except Exception as e:
            logger.warning(f"World Bank fetch failed for {iso2}: {e}. Using hardcoded fallback.")

        # 3. Hardcoded fallback (labeled)
        return self._get_fallback_data(country_upper, iso2)

    def _country_to_iso2(self, country_upper: str) -> str:
        for keyword, code in _COUNTRY_CODE_MAP.items():
            if keyword in country_upper:
                return code
        return "US"  # safe default

    async def _fetch_world_bank(self, iso2: str) -> dict[str, Any]:
        """Fetch GDP growth, CPI inflation, and unemployment from World Bank API (no key needed)."""
        base = "https://api.worldbank.org/v2/country"
        results: dict[str, float | None] = {}

        async with httpx.AsyncClient(timeout=8.0) as client:
            for name, indicator in _WB_INDICATORS.items():
                url = f"{base}/{iso2}/indicator/{indicator}?format=json&mrv=2"
                try:
                    r = await client.get(url)
                    if r.status_code == 200:
                        payload = r.json()
                        obs = payload[1] if len(payload) > 1 and payload[1] else []
                        # mrv=2 gives last 2 years; pick the most recent non-null value
                        val = next(
                            (o["value"] for o in obs if o.get("value") is not None),
                            None
                        )
                        results[name] = round(float(val), 2) if val is not None else None
                    else:
                        results[name] = None
                except Exception as exc:
                    logger.warning(f"World Bank {indicator} for {iso2} failed: {exc}")
                    results[name] = None

        # Fill gaps with hardcoded fallback values
        fallback = self._get_fallback_data("", iso2)
        interest_rate = _RATE_FALLBACKS.get(iso2, 5.25)

        return {
            "gdp_growth": results.get("gdp_growth") or fallback["gdp_growth"],
            "inflation": results.get("inflation") or fallback["inflation"],
            "interest_rate": interest_rate,          # World Bank doesn't expose central bank rates
            "unemployment": results.get("unemployment") or fallback["unemployment"],
            "is_synthetic": False,
            "data_source": f"World Bank API (country={iso2}; interest rate: hardcoded estimate)",
        }

    async def _fetch_fred_data(self) -> dict[str, Any]:
        """Fetch US GDP, CPI, Fed Funds Rate, and Unemployment from FRED API."""
        series = {
            "gdp_growth": "A191RL1A225NBEA",
            "inflation": "FPCPITOTLZGUSA",
            "interest_rate": "FEDFUNDS",
            "unemployment": "UNRATE",
        }
        results: dict[str, float | None] = {}
        async with httpx.AsyncClient(timeout=8.0) as client:
            for name, sid in series.items():
                url = (
                    f"https://api.stlouisfed.org/fred/series/observations"
                    f"?series_id={sid}&api_key={self.fred_key}&file_type=json"
                    f"&sort_order=desc&limit=1"
                )
                try:
                    r = await client.get(url)
                    if r.status_code == 200:
                        obs = r.json().get("observations", [])
                        results[name] = float(obs[0]["value"]) if obs else None
                    else:
                        results[name] = None
                except Exception as exc:
                    logger.warning(f"FRED {sid} failed: {exc}")
                    results[name] = None

        fallback = self._get_fallback_data("USA", "US")
        return {
            "gdp_growth": results.get("gdp_growth") or fallback["gdp_growth"],
            "inflation": results.get("inflation") or fallback["inflation"],
            "interest_rate": results.get("interest_rate") or fallback["interest_rate"],
            "unemployment": results.get("unemployment") or fallback["unemployment"],
            "is_synthetic": False,
            "data_source": "FRED (St. Louis Fed)",
        }

    def _get_fallback_data(self, country_upper: str, iso2: str = "US") -> dict[str, Any]:
        """Last-resort hardcoded constants, clearly labeled as synthetic."""
        data_map = {
            "IN": {"gdp_growth": 6.8, "inflation": 4.5, "interest_rate": 6.50, "unemployment": 7.2},
            "JP": {"gdp_growth": 0.9, "inflation": 2.2, "interest_rate": 0.25, "unemployment": 2.5},
            "CN": {"gdp_growth": 4.6, "inflation": 0.2, "interest_rate": 3.45, "unemployment": 5.1},
            "GB": {"gdp_growth": 0.7, "inflation": 3.5, "interest_rate": 5.00, "unemployment": 4.4},
            "DE": {"gdp_growth": -0.2, "inflation": 2.2, "interest_rate": 4.50, "unemployment": 3.4},
        }
        base = data_map.get(iso2, {"gdp_growth": 2.5, "inflation": 3.1, "interest_rate": 5.25, "unemployment": 3.8})
        return {
            **base,
            "is_synthetic": True,
            "data_source": "InvestorGPT hardcoded fallback (World Bank and FRED both unavailable)",
        }
