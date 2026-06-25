"""
美股航海王 · 航海羅盤 2.0 — FastAPI 量化引擎

╔══════════════════════════════════════════════════════════════════════╗
║  ⚠️ 鐵律（嚴禁串線）：                                                  ║
║                                                                        ║
║   • 「時速公式」 → 吃 horsepower（真實馬力，含板塊 Beta）欄。           ║
║   • 「胎耗公式」 → 吃 L（每日槓桿，∈ {0,1,2,3}）欄，永遠不是馬力值。   ║
║       例：SOXL 算胎耗用 L=3，不是 4.5。誤用 4.5 會把胎耗灌水約 2.6 倍。 ║
║                                                                        ║
║   關係式（僅供理解，程式直接讀表）：                                    ║
║       真實馬力 = L × 板塊Beta（S&P=1.0、Nasdaq=1.2、半導體=1.5）        ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import time
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────────────────
# 1. 單一真相來源（全專案以此為準）
#    horsepower 欄 → 只給「時速公式」用
#    L 欄         → 只給「胎耗公式」用
# ──────────────────────────────────────────────────────────────────────
ASSETS: Dict[str, dict] = {
    # key       series      horsepower(時速用)  L(胎耗用)   sigma_src
    "VOO":  {"series": "sp500",  "horsepower": 1.0, "L": 1, "sigma_src": "VOO"},
    "SSO":  {"series": "sp500",  "horsepower": 2.0, "L": 2, "sigma_src": "VOO"},
    "UPRO": {"series": "sp500",  "horsepower": 3.0, "L": 3, "sigma_src": "VOO"},
    "QQQ":  {"series": "nasdaq", "horsepower": 1.2, "L": 1, "sigma_src": "QQQ"},
    "QLD":  {"series": "nasdaq", "horsepower": 2.4, "L": 2, "sigma_src": "QQQ"},
    "TQQQ": {"series": "nasdaq", "horsepower": 3.6, "L": 3, "sigma_src": "QQQ"},
    "SOXX": {"series": "semi",   "horsepower": 1.5, "L": 1, "sigma_src": "SOXX"},
    "USD":  {"series": "semi",   "horsepower": 3.0, "L": 2, "sigma_src": "SOXX"},
    "SOXL": {"series": "semi",   "horsepower": 4.5, "L": 3, "sigma_src": "SOXX"},
    # CASH：馬力 0、L 0、無 σ。內部 key 為 "CASH"，與半導體 2x ETF "USD" 嚴格區分。
    "CASH": {"series": "cash",   "horsepower": 0.0, "L": 0, "sigma_src": None},
}

# 板塊 Beta（僅供理解 horsepower = L × beta，程式不靠它算）
SECTOR_BETA = {"sp500": 1.0, "nasdaq": 1.2, "semi": 1.5}

# 三大基準（提供 200DMA / σ / regime）；VOO/QQQ/SOXX 本就在 9 檔 ETF 內
BENCHMARKS: List[str] = ["VOO", "QQQ", "SOXX"]

# 需向 yfinance 抓真實收盤價的全部 ETF（不含 CASH）
ETF_TICKERS: List[str] = [k for k in ASSETS if k != "CASH"]

# ──────────────────────────────────────────────────────────────────────
# 2. 已釘死的門檻與防禦參數
# ──────────────────────────────────────────────────────────────────────
SIGMA_HIGH = 0.30          # 高波動界線 σ > 30%
PARKING_MAX = 30           # 停車天數上限 parking_days > 30
KNIFE_CATCH_LIMIT = 0.05   # 接刀額度上限：跌破 200DMA 時該系列槓桿最高佔總資產 5%

# ──────────────────────────────────────────────────────────────────────
# 3. 市場資料快取層（yfinance 為非官方來源，會限流/偶爾失敗）
# ──────────────────────────────────────────────────────────────────────
CACHE_TTL = 720  # 秒；12 分鐘
_cache: Dict[str, Optional[object]] = {"data": None, "ts": 0.0}


def _annualized_sigma(close: pd.Series) -> float:
    """近 20 日日報酬標準差 × √252（年化波動率）。"""
    returns = close.pct_change().dropna()
    if len(returns) < 2:
        return 0.0
    window = returns.tail(20)
    return float(window.std() * np.sqrt(252))


def _fetch_from_yahoo() -> dict:
    """一次批次抓全部 ETF 的 1 年歷史，計算所需欄位。失敗丟例外。"""
    raw = yf.download(
        tickers=ETF_TICKERS,
        period="1y",
        interval="1d",
        auto_adjust=True,
        progress=False,
        group_by="ticker",
        threads=True,
    )
    if raw is None or len(raw) == 0:
        raise RuntimeError("yfinance returned empty dataframe")

    prices: Dict[str, float] = {}        # 9 檔最新收盤價（市值用）
    benchmarks: Dict[str, dict] = {}     # 3 基準的 dma200 / sigma / regime

    for ticker in ETF_TICKERS:
        # 單一 ticker 時 yfinance 不會用 ticker 當第一層欄位
        if isinstance(raw.columns, pd.MultiIndex):
            close = raw[ticker]["Close"].dropna()
        else:
            close = raw["Close"].dropna()
        if close.empty:
            raise RuntimeError(f"no close data for {ticker}")

        price = float(close.iloc[-1])
        prices[ticker] = price

        if ticker in BENCHMARKS:
            dma200 = float(close.tail(200).mean())
            sigma = _annualized_sigma(close)
            benchmarks[ticker] = {
                "price": price,
                "dma200": dma200,
                "sigma": sigma,
                "regime": "green" if price >= dma200 else "red",
            }

    return {"prices": prices, "benchmarks": benchmarks}


def get_market_data(force: bool = False) -> dict:
    """
    回傳 {payload, stale, cached, error}。
    - 快取新鮮且非 force → 直接回（cached=True）
    - force / 過期 / 無快取 → 打 Yahoo；成功更新快取
    - 失敗 → 若有舊快取回 stale 值；完全無快取丟 RuntimeError
    """
    now = time.time()
    fresh = _cache["data"] is not None and (now - _cache["ts"]) < CACHE_TTL and not force
    if fresh:
        return {"payload": _cache["data"], "stale": False, "cached": True, "error": None}

    try:
        data = _fetch_from_yahoo()
        _cache["data"] = data
        _cache["ts"] = now
        return {"payload": data, "stale": False, "cached": False, "error": None}
    except Exception as exc:  # noqa: BLE001 — 任意 yfinance/網路錯誤都要 fallback
        if _cache["data"] is not None:
            # 限流/掛掉：回上次快取值，標記 stale，前端不可整片崩
            return {
                "payload": _cache["data"],
                "stale": True,
                "cached": True,
                "error": f"yfinance_fetch_failed: {exc}",
            }
        # 完全無快取可回，才往上丟
        raise RuntimeError(f"yfinance_fetch_failed_no_cache: {exc}") from exc


# ──────────────────────────────────────────────────────────────────────
# 4. FastAPI app + CORS
# ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="航海羅盤 2.0 量化引擎")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/market-data")
def market_data(force: bool = False):
    try:
        result = get_market_data(force)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    payload = result["payload"]
    return {
        "benchmarks": payload["benchmarks"],
        "prices": payload["prices"],
        "stale": result["stale"],
        "cached": result["cached"],
        "error": result["error"],
        "fetched_at": _cache["ts"],  # 最後一次成功抓取的 epoch 秒
    }


# ──────────────────────────────────────────────────────────────────────
# 5. /api/portfolio — 物理引擎
# ──────────────────────────────────────────────────────────────────────
class Position(BaseModel):
    shares: float = 0.0
    parking_days: int = 0  # 進場天數（僅槓桿部位有意義）


class PortfolioRequest(BaseModel):
    # key 為 ETF ticker（VOO/SSO/.../SOXL）
    positions: Dict[str, Position] = {}
    cash: float = 0.0


def _series_sigma(series: str, benchmarks: dict) -> float:
    """系列 → 母指數 σ。sp500→VOO、nasdaq→QQQ、semi→SOXX。"""
    src = {"sp500": "VOO", "nasdaq": "QQQ", "semi": "SOXX"}.get(series)
    if src is None:
        return 0.0
    return float(benchmarks.get(src, {}).get("sigma", 0.0))


def _series_regime(series: str, benchmarks: dict) -> str:
    src = {"sp500": "VOO", "nasdaq": "QQQ", "semi": "SOXX"}.get(series)
    if src is None:
        return "green"
    return benchmarks.get(src, {}).get("regime", "green")


@app.post("/api/portfolio")
def portfolio(req: PortfolioRequest):
    try:
        market = get_market_data()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    payload = market["payload"]
    prices = payload["prices"]
    benchmarks = payload["benchmarks"]

    # --- (1) 市值：各 ETF = shares × 真實收盤價；CASH = 餘額 ---
    market_values: Dict[str, float] = {}
    for ticker, pos in req.positions.items():
        if ticker not in ASSETS or ticker == "CASH":
            continue
        price = prices.get(ticker, 0.0)
        market_values[ticker] = max(pos.shares, 0.0) * price
    cash_value = max(req.cash, 0.0)
    market_values["CASH"] = cash_value

    total = sum(market_values.values())

    # --- (2) 權重 ---
    weights = {k: (v / total if total > 0 else 0.0) for k, v in market_values.items()}

    # --- (3) 各系列槓桿部位（L>=2）合計權重，供接刀額度判定 ---
    series_lev_weight: Dict[str, float] = {"sp500": 0.0, "nasdaq": 0.0, "semi": 0.0}
    for ticker, w in weights.items():
        meta = ASSETS[ticker]
        if meta["L"] >= 2:
            series_lev_weight[meta["series"]] += w

    # --- (4) 逐部位計算 ---
    assets_out = []
    portfolio_monthly_drag = 0.0
    total_speed = 0.0

    for ticker, w in weights.items():
        meta = ASSETS[ticker]
        L = meta["L"]
        hp = meta["horsepower"]

        # 時速公式：吃 horsepower（真實馬力）
        speed_contrib = w * hp
        total_speed += speed_contrib

        # 胎耗公式：吃 L（每日槓桿）。L=0/1 → 自動為 0，無胎耗。
        sigma = _series_sigma(meta["series"], benchmarks) if meta["series"] != "cash" else 0.0
        annual_drag = 0.5 * L * (L - 1) * (sigma ** 2)
        monthly_drag = annual_drag / 12.0
        portfolio_monthly_drag += w * monthly_drag

        # 旗標（僅槓桿部位 L>=2 有意義）
        is_leveraged = L >= 2
        below_200dma = is_leveraged and _series_regime(meta["series"], benchmarks) == "red"

        parking_days = 0
        if ticker in req.positions:
            parking_days = req.positions[ticker].parking_days
        # 停車警告：parking_days > 30 AND σ > 30%（兩條件 AND）
        parking_over_limit = (
            is_leveraged and parking_days > PARKING_MAX and sigma > SIGMA_HIGH
        )
        # 接刀額度：系列在線下 AND 該系列槓桿合計權重 > 5%
        knife_catch_breach = (
            is_leveraged
            and _series_regime(meta["series"], benchmarks) == "red"
            and series_lev_weight[meta["series"]] > KNIFE_CATCH_LIMIT
        )

        assets_out.append({
            "ticker": ticker,
            "series": meta["series"],
            "horsepower": hp,
            "L": L,
            "shares": req.positions.get(ticker).shares if ticker in req.positions else 0.0,
            "price": prices.get(ticker, 0.0),
            "market_value": market_values[ticker],
            "weight": w,
            "sigma_source": sigma,
            "annual_drag": annual_drag,
            "monthly_drag": monthly_drag,
            "parking_days": parking_days,
            "below_200dma": below_200dma,
            "parking_over_limit": parking_over_limit,
            "knife_catch_breach": knife_catch_breach,
        })

    return {
        "total_assets": total,
        "total_speed": total_speed,
        "portfolio_monthly_drag": portfolio_monthly_drag,
        "assets": assets_out,
        "benchmarks": benchmarks,
        "series_leveraged_weight": series_lev_weight,
        "stale": market["stale"],
        "fetched_at": _cache["ts"],  # 最後一次成功抓取的 epoch 秒
        "thresholds": {
            "sigma_high": SIGMA_HIGH,
            "parking_max": PARKING_MAX,
            "knife_catch_limit": KNIFE_CATCH_LIMIT,
        },
    }


@app.get("/")
def root():
    return {"status": "ok", "service": "航海羅盤 2.0 量化引擎"}
