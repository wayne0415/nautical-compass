import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, RefreshCw, WifiOff } from "lucide-react";
import { getMarketData, postPortfolio } from "./api";
import { ASSETS } from "./data/assets";
import type { BenchmarkData, PortfolioResponse, PositionsState } from "./types";
import SpeedGauge from "./components/SpeedGauge";
import DragGauge from "./components/DragGauge";
import RegimeLights from "./components/RegimeLights";
import AssetInputPanel from "./components/AssetInputPanel";
import DragBarChart from "./components/DragBarChart";

const emptyPositions = (): PositionsState => {
  const s: PositionsState = {};
  Object.keys(ASSETS).forEach((k) => {
    if (k !== "CASH") s[k] = { shares: "", parkingDays: "" };
  });
  return s;
};

const STORAGE_KEY = "compass-portfolio-v1";

// 從 localStorage 還原；以 emptyPositions 為底，只覆蓋已知 ticker，避免標的清單變動時出錯
function loadStored(): { positions: PositionsState; cash: string } {
  const base = emptyPositions();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { positions: base, cash: "10000" };
    const saved = JSON.parse(raw) as { positions?: PositionsState; cash?: string };
    if (saved.positions) {
      for (const k of Object.keys(base)) {
        if (saved.positions[k]) {
          base[k] = {
            shares: saved.positions[k].shares ?? "",
            parkingDays: saved.positions[k].parkingDays ?? "",
          };
        }
      }
    }
    return { positions: base, cash: saved.cash ?? "10000" };
  } catch {
    return { positions: base, cash: "10000" };
  }
}

export default function App() {
  const [positions, setPositions] = useState<PositionsState>(() => loadStored().positions);
  const [cash, setCash] = useState(() => loadStored().cash);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData>>({});
  const [result, setResult] = useState<PortfolioResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMarket = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const md = await getMarketData(force);
      setBenchmarks(md.benchmarks);
      setStale(md.stale);
      setError(md.error);
      if (md.fetched_at) setLastUpdated(md.fetched_at);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const computePortfolio = useCallback(async (pos: PositionsState, cashStr: string) => {
    setLoading(true);
    try {
      const res = await postPortfolio(pos, Number(cashStr) || 0);
      setResult(res);
      setBenchmarks(res.benchmarks);
      setStale(res.stale);
      setError(null);
      if (res.fetched_at) setLastUpdated(res.fetched_at);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初次載入：抓行情 + 算一次投組
  useEffect(() => {
    loadMarket();
    computePortfolio(positions, cash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 輸入變更 → debounce 重算 + 存到 localStorage
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      computePortfolio(positions, cash);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ positions, cash }));
      } catch {
        /* 隱私模式或容量滿時忽略 */
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, cash]);

  const onPositionChange = (ticker: string, field: "shares" | "parkingDays", value: string) => {
    setPositions((prev) => ({ ...prev, [ticker]: { ...prev[ticker], [field]: value } }));
  };

  const handleRefresh = () => {
    loadMarket(true); // force：繞過後端 12 分鐘快取，真的重抓
    computePortfolio(positions, cash);
  };

  const handleClear = () => {
    setPositions(emptyPositions());
    setCash("0");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const totalSpeed = result?.total_speed ?? 0;
  const monthlyDrag = result?.portfolio_monthly_drag ?? 0;
  const totalAssets = result?.total_assets ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-200 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Compass className="text-cyan-400" size={28} />
            <div>
              <h1 className="text-xl font-bold text-slate-100">美股航海王 · 航海羅盤 2.0</h1>
              <p className="text-xs text-slate-400">波動與趨勢校正版 · 馬力／槓桿分流引擎</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-[11px] text-slate-400">
                {lastUpdated
                  ? `最後更新 ${new Date(lastUpdated * 1000).toLocaleTimeString()}`
                  : "尚未更新"}
              </div>
              <button
                onClick={handleClear}
                className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                清除輸入
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 重新整理
            </button>
          </div>
        </header>

        {/* Stale / error banner */}
        {stale && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-700 bg-yellow-950/40 px-3 py-2 text-sm text-yellow-300">
            <WifiOff size={16} /> 行情資料可能過期（yfinance 限流或暫時失敗），顯示上次快取值。
          </div>
        )}
        {error && !stale && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            無法取得行情：{error}（後端是否已啟動於 :8000？）
          </div>
        )}

        {/* 頂部三大錶盤 */}
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SpeedGauge value={totalSpeed} />
          <DragGauge value={monthlyDrag} />
          <RegimeLights benchmarks={benchmarks} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
          {/* 左：資產輸入 */}
          <AssetInputPanel
            positions={positions}
            cash={cash}
            onPositionChange={onPositionChange}
            onCashChange={setCash}
            result={result}
            benchmarks={benchmarks}
          />

          {/* 右：總覽 + 圖表 */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="總資產"
                value={`$${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <Stat label="總真實時速" value={`${totalSpeed.toFixed(2)}x`} />
              <Stat label="投組月胎耗" value={`−${(monthlyDrag * 100).toFixed(2)}%`} />
            </div>
            <DragBarChart result={result} />
            <PositionTable result={result} />
          </div>
        </div>

        <footer className="mt-6 text-center text-[11px] text-slate-500">
          鐵律：時速吃「真實馬力」，胎耗吃「每日槓桿 L」。SOXL 胎耗用 L=3，非 4.5。
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-center">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}

function PositionTable({ result }: { result: PortfolioResponse | null }) {
  const rows = result?.assets.filter((a) => a.market_value > 0) ?? [];
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
        輸入持股後此處顯示各部位明細。
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1">部位</th>
            <th>L</th>
            <th>馬力</th>
            <th>市值</th>
            <th>權重</th>
            <th>年化胎耗</th>
            <th>月胎耗</th>
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {rows.map((a) => (
            <tr key={a.ticker} className="border-t border-slate-800">
              <td className="py-1 font-semibold">{a.ticker}</td>
              <td>{a.L}x</td>
              <td>{a.horsepower}</td>
              <td>${a.market_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td>{(a.weight * 100).toFixed(1)}%</td>
              <td className={a.annual_drag > 0 ? "text-orange-400" : "text-slate-500"}>
                −{(a.annual_drag * 100).toFixed(2)}%
              </td>
              <td className={a.monthly_drag > 0 ? "text-orange-400" : "text-slate-500"}>
                −{(a.monthly_drag * 100).toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
