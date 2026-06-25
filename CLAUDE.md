# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

槓桿 ETF 風險儀表板（「美股航海王 · 航海羅盤 2.0」）。後端 FastAPI 量化引擎 + 前端 React 儀表板。
即時抓 Yahoo Finance 行情，計算槓桿部位的「方向曝險（時速）」與「波動損耗（胎耗）」並做趨勢/額度風險檢查。

## Commands

一鍵啟動（會自動建 venv / 裝依賴 / 同時起前後端，Ctrl+C 一起關）：
```bash
./start.sh                      # 後端 :8000 + 前端 :5173
```

後端（在 `backend/`）：
```bash
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt   # 首次
./venv/bin/uvicorn main:app --reload --port 8000
```

前端（在 `frontend/`）：
```bash
npm install                     # 首次
npm run dev                     # 開發伺服器 :5173
npm run build                   # tsc -b 型別檢查 + vite build（改完務必跑，這是主要的驗證關卡）
npm run lint                    # oxlint
```

沒有測試框架。驗證靠 `npm run build`（型別）＋ 用 `curl` 打 API ＋ 瀏覽器手動確認。

## 核心領域規則（改後端量化邏輯前必讀）

**鐵律：每檔標的有兩個獨立、絕不可互換的數字**，定義在 `backend/main.py` 的 `ASSETS` lookup table：
- `horsepower`（真實馬力，含板塊 Beta）→ **只**給「時速」公式：`speed = Σ(weight × horsepower)`
- `L`（每日槓桿 ∈ {0,1,2,3}）→ **只**給「胎耗」公式：`annual_drag = 0.5 × L × (L−1) × σ²`

例：SOXL 算胎耗用 `L=3`，**不是** horsepower 4.5。誤用會把胎耗灌水約 2.6 倍。1x 與 CASH 的胎耗恆為 0。

**σ 綁定母指數**（非基金自身）：S&P 系列(VOO/SSO/UPRO)→VOO、Nasdaq 系列(QQQ/QLD/TQQQ)→QQQ、半導體系列(SOXX/USD/SOXL)→SOXX。

**門檻常數**（`backend/main.py` 頂部）：`SIGMA_HIGH=0.30`、`PARKING_MAX=30`、`KNIFE_CATCH_LIMIT=0.05`。
- `parking_over_limit` = 進場 >30 天 **AND** σ >30%（兩條件 AND，不是 OR）
- `knife_catch_breach` = 系列跌破 200DMA **AND** 該系列槓桿合計權重 >5%

> `ASSETS` 在前端 `frontend/src/data/assets.ts` 有一份**鏡像**。改動標的表時兩邊都要改，否則前後端不一致。

## 架構重點

**後端**（單檔 `backend/main.py`）
- `GET /api/market-data`：一次批次抓全 9 檔 ETF + 3 基準的 1 年歷史，算 price/dma200/sigma/regime。
- `POST /api/portfolio`：吃股數/現金/parking_days，回各部位市值、權重、時速、胎耗、風險旗標。
- **快取**：模組級 dict `_cache`，TTL `CACHE_TTL=720`(12 分)。yfinance 失敗時回上次快取值並標 `stale=true`，**絕不讓前端崩**。
- `?force=true` 可繞過快取重抓（前端「重新整理」按鈕用此）。回應含 `fetched_at`（最後成功抓取 epoch）。
- yfinance 為非官方來源、會限流；冷啟動第一次打可能失敗（無快取可回時回 503），重試即可。

**前端**（`frontend/src/`，Vite + React TS + Tailwind + Recharts，暗色）
- `App.tsx` 是唯一 state 容器：positions/cash 變動 → 400ms debounce → `POST /api/portfolio` 自動重算。
- **持久化**：positions/cash 自動存 localStorage（key `compass-portfolio-v1`），開頁 lazy-init 還原。
- `api.ts` 寫死 `BASE = http://localhost:8000`；後端 CORS 也寫死允許 `:5173`。改 port 要兩邊一起改。
- 元件：三大錶盤(`SpeedGauge`/`DragGauge`/`RegimeLights`)、輸入區(`AssetInputPanel`，含 200DMA 紅框/接刀額度/停車警告等硬規則 UI)、`DragBarChart`。

## 命名防呆

半導體 2x ETF 的 ticker 是 **`USD`**，與現金 **`CASH`** 易混淆。內部 key 嚴格分開；前端 `USD` 顯示為 `USD (ProShares Ultra Semis)`、現金顯示 `Cash`。勿共用 key。

## 環境

Python 3.9（`requirements.txt` 已 pin pandas 2.2 / numpy 1.26，因更新版已停止支援 3.9，升級依賴前注意）。Node v24 / npm。
