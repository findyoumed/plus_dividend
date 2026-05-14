from pydantic import BaseModel


class Candle(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class Dividend(BaseModel):
    date: str
    amount: int
    currency: str = "KRW"


class ChartResponse(BaseModel):
    ticker: str
    name: str
    last_close: float
    ttm_yield: float | None
    candles: list[Candle]
    dividends: list[Dividend]
