from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
import numpy as np
import math
import logging
from typing import Any

logger = logging.getLogger("investorgpt.routes_technical")
router = APIRouter(prefix="/technical", tags=["Technical Analysis"])

def sanitize_float(val: Any, fallback: float = 0.0) -> float:
    try:
        if val is None or pd.isna(val) or math.isnan(val) or math.isinf(val):
            return fallback
        return float(val)
    except Exception:
        return fallback

@router.get("/{ticker}")
def get_technical_analysis(ticker: str):
    ticker_clean = ticker.upper().strip()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")
        
    try:
        # Fetch last 6 months of daily data (need enough history for 100-day percentile)
        stock = yf.Ticker(ticker_clean)
        df = stock.history(period="9mo")
        if df.empty or len(df) < 120:
            raise HTTPException(status_code=404, detail=f"Insufficient history data for {ticker_clean}.")
            
        open_s = df["Open"]
        high_s = df["High"]
        low_s = df["Low"]
        close_s = df["Close"]
        
        latest_price = sanitize_float(close_s.iloc[-1])
        
        # 1. RSI (14-day)
        delta = close_s.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        
        avg_gain = gain.rolling(window=14).mean()
        avg_loss = loss.rolling(window=14).mean()
        
        for i in range(14, len(avg_gain)):
            avg_gain.iloc[i] = (avg_gain.iloc[i-1] * 13 + gain.iloc[i]) / 14
            avg_loss.iloc[i] = (avg_loss.iloc[i-1] * 13 + loss.iloc[i]) / 14
            
        rs = avg_gain / (avg_loss + 1e-10)
        rsi_series = 100 - (100 / (1 + rs))
        latest_rsi = sanitize_float(rsi_series.iloc[-1], fallback=50.0)
        
        # 2. SMA 20 & SMA 50
        sma20 = close_s.rolling(window=20).mean()
        sma50 = close_s.rolling(window=50).mean()
        latest_sma20 = sanitize_float(sma20.iloc[-1], fallback=latest_price)
        latest_sma50 = sanitize_float(sma50.iloc[-1], fallback=latest_price)
        
        # 3. Bollinger Bands & Squeeze Alerts
        middle_band = close_s.rolling(window=20).mean()
        std_dev = close_s.rolling(window=20).std()
        upper_band = middle_band + (std_dev * 2)
        lower_band = middle_band - (std_dev * 2)
        
        bandwidth = (upper_band - lower_band) / (middle_band + 1e-10)
        bw_pct_10 = bandwidth.rolling(window=100).quantile(0.10)
        
        latest_upper = sanitize_float(upper_band.iloc[-1], fallback=latest_price)
        latest_middle = sanitize_float(middle_band.iloc[-1], fallback=latest_price)
        latest_lower = sanitize_float(lower_band.iloc[-1], fallback=latest_price)
        
        latest_bandwidth = sanitize_float(bandwidth.iloc[-1])
        latest_threshold = sanitize_float(bw_pct_10.iloc[-1])
        is_squeeze = latest_bandwidth < latest_threshold if latest_bandwidth > 0 else False
        
        # 4. MACD
        ema12 = close_s.ewm(span=12, adjust=False).mean()
        ema26 = close_s.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - signal_line
        
        latest_macd = sanitize_float(macd_line.iloc[-1], fallback=0.0)
        latest_signal = sanitize_float(signal_line.iloc[-1], fallback=0.0)
        latest_hist = sanitize_float(macd_hist.iloc[-1], fallback=0.0)
        
        # 5. Ichimoku Cloud
        tenkan_sen = (high_s.rolling(window=9).max() + low_s.rolling(window=9).min()) / 2
        kijun_sen = (high_s.rolling(window=26).max() + low_s.rolling(window=26).min()) / 2
        senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(26)
        senkou_span_b = ((high_s.rolling(window=52).max() + low_s.rolling(window=52).min()) / 2).shift(26)
        
        latest_tenkan = sanitize_float(tenkan_sen.iloc[-1], fallback=latest_price)
        latest_kijun = sanitize_float(kijun_sen.iloc[-1], fallback=latest_price)
        latest_span_a = sanitize_float(senkou_span_a.iloc[-1], fallback=latest_price)
        latest_span_b = sanitize_float(senkou_span_b.iloc[-1], fallback=latest_price)
        
        # 6. ADX (14-period)
        tr = pd.DataFrame(index=df.index)
        tr["h_l"] = high_s - low_s
        tr["h_pc"] = (high_s - close_s.shift(1)).abs()
        tr["l_pc"] = (low_s - close_s.shift(1)).abs()
        tr["tr"] = tr[["h_l", "h_pc", "l_pc"]].max(axis=1)
        
        up = high_s - high_s.shift(1)
        down = low_s.shift(1) - low_s
        
        plus_dm = np.where((up > down) & (up > 0), up, 0.0)
        minus_dm = np.where((down > up) & (down > 0), down, 0.0)
        
        atr = tr["tr"].ewm(alpha=1/14, adjust=False).mean()
        plus_di = 100 * pd.Series(plus_dm, index=df.index).ewm(alpha=1/14, adjust=False).mean() / (atr + 1e-10)
        minus_di = 100 * pd.Series(minus_dm, index=df.index).ewm(alpha=1/14, adjust=False).mean() / (atr + 1e-10)
        
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-10)
        adx_series = dx.ewm(alpha=1/14, adjust=False).mean()
        latest_adx = sanitize_float(adx_series.iloc[-1], fallback=20.0)
        
        adx_trend = "WEAK TREND"
        if latest_adx > 25:
            adx_trend = "STRONG TREND"
        elif latest_adx > 20:
            adx_trend = "DEVELOPING TREND"
            
        # Support & Resistance pivots
        recent_high = sanitize_float(high_s.iloc[-30:].max(), fallback=latest_price)
        recent_low = sanitize_float(low_s.iloc[-30:].min(), fallback=latest_price)
        
        # Trend Recommendation Signal
        signal = "HOLD"
        explanation = "Indicators suggest neutral price action."
        
        if latest_rsi < 30:
            signal = "STRONG BUY"
            explanation = f"RSI is oversold ({latest_rsi:.1f}). Potential bullish rebound."
        elif latest_rsi > 70:
            signal = "STRONG SELL"
            explanation = f"RSI is overbought ({latest_rsi:.1f}). Risk of downside reversal."
        elif latest_sma20 > latest_sma50:
            if sanitize_float(sma20.iloc[-2]) <= sanitize_float(sma50.iloc[-2]):
                signal = "STRONG BUY"
                explanation = "Golden Cross occurred! SMA 20 crossed above SMA 50."
            else:
                signal = "BUY"
                explanation = "SMA 20 is trading above SMA 50, indicating a bullish trend."
        elif latest_sma20 < latest_sma50:
            if sanitize_float(sma20.iloc[-2]) >= sanitize_float(sma50.iloc[-2]):
                signal = "STRONG SELL"
                explanation = "Death Cross occurred! SMA 20 crossed below SMA 50."
            else:
                signal = "SELL"
                explanation = "SMA 20 is trading below SMA 50, indicating a bearish trend."
                
        # Prep chart history for interactive frontend (take last 90 trading days)
        history_points = []
        for i in range(-90, 0):
            date_str = df.index[i].strftime("%Y-%m-%d")
            history_points.append({
                "date": date_str,
                "open": sanitize_float(open_s.iloc[i]),
                "high": sanitize_float(high_s.iloc[i]),
                "low": sanitize_float(low_s.iloc[i]),
                "close": sanitize_float(close_s.iloc[i]),
                "sma20": sanitize_float(sma20.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "sma50": sanitize_float(sma50.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "bb_upper": sanitize_float(upper_band.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "bb_middle": sanitize_float(middle_band.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "bb_lower": sanitize_float(lower_band.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "tenkan": sanitize_float(tenkan_sen.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "kijun": sanitize_float(kijun_sen.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "spanA": sanitize_float(senkou_span_a.iloc[i], fallback=sanitize_float(close_s.iloc[i])),
                "spanB": sanitize_float(senkou_span_b.iloc[i], fallback=sanitize_float(close_s.iloc[i]))
            })
            
        return {
            "ticker": ticker_clean,
            "current_price": latest_price,
            "rsi": latest_rsi,
            "sma20": latest_sma20,
            "sma50": latest_sma50,
            "bollinger": {
                "upper": latest_upper,
                "middle": latest_middle,
                "lower": latest_lower,
                "bandwidth": latest_bandwidth,
                "is_squeeze": is_squeeze
            },
            "macd": {
                "macd": latest_macd,
                "signal": latest_signal,
                "histogram": latest_hist
            },
            "ichimoku": {
                "tenkan": latest_tenkan,
                "kijun": latest_kijun,
                "span_a": latest_span_a,
                "span_b": latest_span_b
            },
            "adx": {
                "adx": latest_adx,
                "trend": adx_trend
            },
            "pivots": {
                "support": recent_low,
                "resistance": recent_high
            },
            "signal": signal,
            "explanation": explanation,
            "history": history_points
        }
    except Exception as e:
        logger.error(f"Technical calculation failed for {ticker}: {e}")
        raise HTTPException(status_code=400, detail=f"Could not calculate indicators for {ticker_clean}.")
