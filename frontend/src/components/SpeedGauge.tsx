import { Gauge } from "lucide-react";

// 時速錶：連續色帶，無空隙
//  <0.8 藍（防禦）/ 0.8–1.2 綠（巡航）/ 1.2–1.5 黃（衝刺）/ >1.5 紅（邊緣）
function speedColor(v: number): { color: string; label: string } {
  if (v < 0.8) return { color: "#3b82f6", label: "防禦" };
  if (v <= 1.2) return { color: "#22c55e", label: "巡航" };
  if (v <= 1.5) return { color: "#eab308", label: "衝刺" };
  return { color: "#ef4444", label: "邊緣" };
}

const MAX = 2.0; // 錶盤上限（>1.5 為紅區）

export default function SpeedGauge({ value }: { value: number }) {
  const { color, label } = speedColor(value);
  const pct = Math.min(value / MAX, 1);
  // 半圓弧：180 度
  const angle = -90 + pct * 180;
  const r = 70;
  const cx = 90;
  const cy = 90;

  // 半圓背景路徑
  const arc = (start: number, end: number) => {
    const a0 = (start * Math.PI) / 180;
    const a1 = (end * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  };

  // 區段角度（180度從 180→360 對應 0→MAX）
  const seg = (v: number) => 180 + (Math.min(v, MAX) / MAX) * 180;

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-300">
        <Gauge size={16} /> 時速錶（總真實曝險）
      </div>
      <svg width="180" height="110" viewBox="0 0 180 110">
        {/* 四色背景帶 */}
        <path d={arc(seg(0), seg(0.8))} stroke="#1e3a8a" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d={arc(seg(0.8), seg(1.2))} stroke="#14532d" strokeWidth="12" fill="none" />
        <path d={arc(seg(1.2), seg(1.5))} stroke="#713f12" strokeWidth="12" fill="none" />
        <path d={arc(seg(1.5), seg(MAX))} stroke="#7f1d1d" strokeWidth="12" fill="none" strokeLinecap="round" />
        {/* 指針 */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 8) * Math.cos((angle * Math.PI) / 180)}
          y2={cy + (r - 8) * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill={color} />
      </svg>
      <div className="text-3xl font-bold" style={{ color }}>
        {value.toFixed(2)}x
      </div>
      <div className="text-sm font-semibold" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
