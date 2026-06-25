import { CircleDot } from "lucide-react";
import type { BenchmarkData } from "../types";
import { BENCHMARKS, SERIES_LABEL } from "../data/assets";

const LABEL: Record<string, string> = {
  VOO: SERIES_LABEL.sp500,
  QQQ: SERIES_LABEL.nasdaq,
  SOXX: SERIES_LABEL.semi,
};

export default function RegimeLights({
  benchmarks,
}: {
  benchmarks: Record<string, BenchmarkData>;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <CircleDot size={16} /> 賽道燈號（200DMA）
      </div>
      <div className="flex justify-around">
        {BENCHMARKS.map((b) => {
          const data = benchmarks[b];
          const green = data?.regime === "green";
          const color = !data ? "#475569" : green ? "#22c55e" : "#ef4444";
          return (
            <div key={b} className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-8 rounded-full"
                style={{ background: color, boxShadow: `0 0 14px ${color}` }}
              />
              <div className="text-xs font-semibold text-slate-300">{LABEL[b]}</div>
              <div className="text-[11px] text-slate-400">{b}</div>
              {data && (
                <div className="text-[11px] text-slate-400">
                  σ {(data.sigma * 100).toFixed(0)}%
                </div>
              )}
              <div className="text-[10px]" style={{ color }}>
                {!data ? "—" : green ? "線上" : "線下"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
