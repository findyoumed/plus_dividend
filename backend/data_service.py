import time
import warnings
from datetime import date

import FinanceDataReader as fdr
import pandas as pd

from backend.config import TICKER

warnings.filterwarnings("ignore")

_cache: dict = {}
_cache_ts: dict = {}
CACHE_TTL = 60 * 60 * 6


def get_ohlcv(start: str, end: str) -> list[dict]:
    key = (start, end)
    now = time.time()

    if key in _cache and now - _cache_ts[key] < CACHE_TTL:
        return _cache[key]

    df = fdr.DataReader(TICKER, start, end)
    if df.empty:
        return []

    df.index = pd.to_datetime(df.index)
    df.columns = [c.lower() for c in df.columns]

    needed = ["open", "high", "low", "close", "volume"]
    df = df[[c for c in needed if c in df.columns]]

    records = []
    for idx, row in df.iterrows():
        records.append({
            "time": idx.strftime("%Y-%m-%d"),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row.get("volume", 0)),
        })

    _cache[key] = records
    _cache_ts[key] = now
    return records


def get_last_close(start: str, end: str) -> float:
    records = get_ohlcv(start, end)
    if records:
        return records[-1]["close"]
    return 0.0


def get_trading_dates_set(start: str, end: str) -> set[str]:
    records = get_ohlcv(start, end)
    return {r["time"] for r in records}
