# 美股航海王 · 航海羅盤 2.0（波動與趨勢校正版）

槓桿 ETF 風險儀表板：把「真實馬力（時速）」與「每日槓桿 L（胎耗）」兩個數字嚴格分流，
落實 200DMA / 高波動 / 接刀額度三道硬規則防禦。

> 👉 **只想使用、不想碰程式？** 請看 **[使用說明書.md](./使用說明書.md)**（圖文、白話、給新手）。
> 下面是給開發者的技術說明。

⚠️ 本工具僅為個人風險視覺化輔助，**不構成任何投資建議**。

- **後端** `backend/`：FastAPI 量化引擎（yfinance + 快取 + CORS）
- **前端** `frontend/`：React + TypeScript + Tailwind + Vite + Recharts 暗色儀表板

---

## 核心鐵律

| 公式 | 吃哪一欄 | 說明 |
|---|---|---|
| **時速**（方向曝險） | `horsepower`（真實馬力，含板塊 Beta） | `總時速 = Σ(權重 × 馬力)` |
| **胎耗**（波動損耗） | `L`（每日槓桿 ∈ {0,1,2,3}） | `年化胎耗 = 0.5 × L × (L−1) × σ²` |

> ⚠️ SOXL 算胎耗用 **L=3**，不是馬力 4.5。誤用會把胎耗灌水約 2.6 倍。
> σ 綁定母指數：S&P 系列→VOO、Nasdaq 系列→QQQ、半導體系列→SOXX。

門檻：σ > 30%、parking_days > 30（兩條件 AND 才跳停車警告）、接刀額度上限 = 總資產 5%。

---

## 啟動

### 後端（port 8000）

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> 需 Python 3.9+。依賴已 pin 至支援 3.9 的版本（pandas 2.2 / numpy 1.26）。

API：
- `GET  /api/market-data` — VOO/QQQ/SOXX 的 price / dma200 / sigma / regime，及 9 檔 ETF 即時價。TTL 12 分快取（`?force=true` 可繞過重抓）；回應含 `fetched_at`；yfinance 失敗時回上次快取值並標記 `stale`，不讓前端崩。
- `POST /api/portfolio` — 輸入各 ETF 股數、cash、各槓桿部位 parking_days；回傳市值、權重、總時速、各部位年化/月化胎耗、投組月胎耗、及 `below_200dma` / `parking_over_limit` / `knife_catch_breach` 旗標。

### 前端（port 5173）

```bash
cd frontend
npm install
npm run dev
```

前端預設打 `http://localhost:8000`，後端 CORS 已允許 `http://localhost:5173`。
請先啟動後端，再啟動前端。

---

## 專案結構

```
backend/
  main.py            # ASSETS 真相表 + 快取 + 量化邏輯 + CORS
  requirements.txt
frontend/
  src/
    data/assets.ts   # 鏡像後端真相表（含命名防呆 USD vs CASH）
    types.ts
    api.ts
    components/
      SpeedGauge.tsx     # 時速錶（連續色帶）
      DragGauge.tsx      # 胎耗錶（每月扣血 %）
      RegimeLights.tsx   # 200DMA 三燈
      AssetInputPanel.tsx# 分組輸入 + 硬規則紅框/警告
      DragBarChart.tsx   # 各部位月胎耗貢獻長條圖
    App.tsx
```
