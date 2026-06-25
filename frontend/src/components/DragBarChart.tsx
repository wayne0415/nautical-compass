import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioResponse } from "../types";

export default function DragBarChart({ result }: { result: PortfolioResponse | null }) {
  // 各部位對「投組月胎耗」的貢獻 = weight × monthly_drag（與後端加總一致）
  const data =
    result?.assets
      .filter((a) => a.L >= 2 && a.weight > 0)
      .map((a) => ({
        ticker: a.ticker,
        contrib: a.weight * a.monthly_drag * 100, // %
        below: a.below_200dma,
      }))
      .sort((x, y) => y.contrib - x.contrib) ?? [];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-2 text-sm font-semibold text-slate-300">各部位月胎耗貢獻（誰在燒錢）</div>
      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-slate-600">
          尚無槓桿部位 — 1x 與現金無胎耗
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="ticker" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
            <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} unit="%" />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
              contentStyle={{ background: "#0f172a", border: "1px solid #475569", borderRadius: 8 }}
              labelStyle={{ color: "#f8fafc", fontWeight: 700 }}
              itemStyle={{ color: "#f1f5f9", fontWeight: 600 }}
              formatter={(v) => [`−${Number(v).toFixed(3)}%`, "月胎耗貢獻"]}
            />
            <Bar dataKey="contrib" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.ticker} fill={d.below ? "#ef4444" : "#f59e0b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
