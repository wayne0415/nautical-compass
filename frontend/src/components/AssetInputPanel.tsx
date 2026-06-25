import { AlertTriangle, Ban, Timer } from "lucide-react";
import { ASSETS, SECTOR_GROUPS, SERIES_LABEL, SERIES_BENCHMARK } from "../data/assets";
import type { PortfolioResponse, PositionsState, BenchmarkData } from "../types";

interface Props {
  positions: PositionsState;
  cash: string;
  onPositionChange: (ticker: string, field: "shares" | "parkingDays", value: string) => void;
  onCashChange: (value: string) => void;
  result: PortfolioResponse | null;
  benchmarks: Record<string, BenchmarkData>;
}

export default function AssetInputPanel({
  positions,
  cash,
  onPositionChange,
  onCashChange,
  result,
  benchmarks,
}: Props) {
  const resultByTicker = new Map(result?.assets.map((a) => [a.ticker, a]) ?? []);

  return (
    <div className="flex flex-col gap-4">
      {SECTOR_GROUPS.map(({ series, tickers }) => {
        const bench = SERIES_BENCHMARK[series];
        const regime = bench ? benchmarks[bench]?.regime : undefined;
        const seriesBelow = regime === "red";

        return (
          <div key={series} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">{SERIES_LABEL[series]}</span>
              {regime && (
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: seriesBelow ? "#7f1d1d" : "#14532d",
                    color: seriesBelow ? "#fca5a5" : "#86efac",
                  }}
                >
                  {seriesBelow ? "200DMA 線下" : "200DMA 線上"}
                </span>
              )}
            </div>

            {/* 系列在線下：整組警告 */}
            {seriesBelow && (
              <div className="mb-2 flex items-start gap-1.5 rounded-md border border-red-700 bg-red-950/50 p-2 text-[11px] text-red-300">
                <Ban size={14} className="mt-0.5 shrink-0" />
                <span>線下嚴禁開火箭！目前僅開放小額接刀額度（最高總資產 5%）</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {tickers.map((ticker) => {
                const meta = ASSETS[ticker];
                const isLeveraged = meta.L >= 2;
                const ar = resultByTicker.get(ticker);
                // 槓桿部位且系列在線下 → 紅框
                const redBox = isLeveraged && seriesBelow;
                const overLimit = ar?.knife_catch_breach;
                const parkingWarn = ar?.parking_over_limit;

                return (
                  <div
                    key={ticker}
                    className={`rounded-lg border p-2 ${
                      redBox ? "border-red-600 bg-red-950/30" : "border-slate-700 bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {meta.displayName}
                        <span className="ml-1 text-[11px] text-slate-400">
                          {meta.L}x · 馬力 {meta.horsepower}
                        </span>
                      </span>
                      {ar && (
                        <span className="text-[10px] text-slate-400">
                          權重 {(ar.weight * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex gap-2">
                      <label className="flex-1">
                        <span className="text-[11px] text-slate-400">股數</span>
                        <input
                          type="number"
                          min="0"
                          value={positions[ticker]?.shares ?? ""}
                          onChange={(e) => onPositionChange(ticker, "shares", e.target.value)}
                          className="w-full rounded bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
                          placeholder="0"
                        />
                      </label>
                      {isLeveraged && (
                        <label className="flex-1">
                          <span className="text-[11px] text-slate-400">進場天數</span>
                          <input
                            type="number"
                            min="0"
                            value={positions[ticker]?.parkingDays ?? ""}
                            onChange={(e) => onPositionChange(ticker, "parkingDays", e.target.value)}
                            className="w-full rounded bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
                            placeholder="0"
                          />
                        </label>
                      )}
                    </div>

                    {/* 旗標警告 */}
                    {overLimit && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-red-400">
                        <AlertTriangle size={12} /> 超出接刀額度（系列槓桿權重 &gt; 5%）
                      </div>
                    )}
                    {parkingWarn && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                        <Timer size={12} /> 胎耗已超標，強制建議降速（停車 &gt;30 天且 σ&gt;30%）
                      </div>
                    )}
                    {ar && isLeveraged && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        月胎耗 −{(ar.monthly_drag * 100).toFixed(2)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 現金 */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
        <div className="mb-2 text-sm font-bold text-slate-200">{SERIES_LABEL.cash}</div>
        <label>
          <span className="text-[11px] text-slate-400">Cash 餘額（$）</span>
          <input
            type="number"
            min="0"
            value={cash}
            onChange={(e) => onCashChange(e.target.value)}
            className="w-full rounded bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-cyan-500"
            placeholder="0"
          />
        </label>
      </div>
    </div>
  );
}
