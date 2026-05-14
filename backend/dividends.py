import pandas as pd

from backend.config import DIVIDENDS_CSV, DIVIDENDS_EXCEL


def get_dividends(start: str, end: str, trading_dates: set[str]) -> list[dict]:
    df = _load_data()
    if df.empty:
        return []

    df = df[(df["date"] >= start) & (df["date"] <= end)]
    if df.empty:
        return []

    sorted_dates = sorted(trading_dates)
    results = []
    for _, row in df.iterrows():
        snapped = _snap_to_trading_day(row["date"], sorted_dates)
        if snapped:
            results.append({"date": snapped, "amount": int(row["amount"])})

    results.sort(key=lambda x: x["date"])
    return results


def get_dividends_for_ttm(months: int = 12) -> int:
    """최근 N개월 이내 분배금 합산."""
    df = _load_data()
    if df.empty:
        return 0

    df["date"] = pd.to_datetime(df["date"])
    cutoff = pd.Timestamp.today() - pd.DateOffset(months=months)
    recent = df[df["date"] >= cutoff]
    return int(recent["amount"].sum())


def _load_data() -> pd.DataFrame:
    """엑셀(공식) → CSV(fallback) 순서로 로드."""
    if DIVIDENDS_EXCEL.exists():
        try:
            return _load_excel()
        except Exception:
            pass
    return _load_csv()


def _load_excel() -> pd.DataFrame:
    """
    plusetf.co.kr에서 다운로드한 엑셀 파싱.
    구조: Row 0 = 제목, Row 1 = 컬럼명(지급기준일/지급예정일/분배금(원)/누적배당누계액(원)), Row 2~ = 데이터
    """
    df = pd.read_excel(DIVIDENDS_EXCEL, header=1)
    # 컬럼 0 = 지급기준일, 컬럼 2 = 분배금(원)
    date_col = df.columns[0]
    amount_col = df.columns[2]
    df = df[[date_col, amount_col]].copy()
    df.columns = ["date", "amount"]
    df["date"] = pd.to_datetime(df["date"], format="%Y.%m.%d", errors="coerce").dt.strftime("%Y-%m-%d")
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0).astype(int)
    df = df.dropna(subset=["date"])
    return df[df["amount"] > 0].reset_index(drop=True)


def _load_csv() -> pd.DataFrame:
    try:
        df = pd.read_csv(DIVIDENDS_CSV, parse_dates=["date"])
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0).astype(int)
        return df[df["amount"] > 0].reset_index(drop=True)
    except Exception:
        return pd.DataFrame(columns=["date", "amount"])


def _snap_to_trading_day(div_date: str, sorted_dates: list[str]) -> str | None:
    if div_date in sorted_dates:
        return div_date
    prior = [d for d in sorted_dates if d <= div_date]
    return prior[-1] if prior else None
