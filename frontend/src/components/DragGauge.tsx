import { Flame } from "lucide-react";

// 胎耗錶：投組每月波動扣血 %。值越高色溫越紅。
// 0% → 綠，~1.5%+ → 紅，中間插值。
function dragColor(pct: number): string {
  const clamped = Math.max(0, Math.min(pct, 1.5));
  const t = clamped / 1.5;
  // 綠(34,197,94) → 黃(234,179,8) → 紅(239,68,68)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const u = t / 0.5;
    r = 34 + (234 - 34) * u;
    g = 197 + (179 - 197) * u;
    b = 94 + (8 - 94) * u;
  } else {
    const u = (t - 0.5) / 0.5;
    r = 234 + (239 - 234) * u;
    g = 179 + (68 - 179) * u;
    b = 8 + (68 - 8) * u;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export default function DragGauge({ value }: { value: number }) {
  const pct = value * 100; // value 為小數比例
  const color = dragColor(pct);
  const barPct = Math.min(pct / 1.5, 1) * 100;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Flame size={16} /> 胎耗錶（每月波動扣血）
      </div>
      <div className="text-4xl font-bold" style={{ color }}>
        −{pct.toFixed(2)}%
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color }} />
      </div>
      <div className="mt-2 text-xs text-slate-400">每月因波動損耗的預估磨損</div>
    </div>
  );
}
