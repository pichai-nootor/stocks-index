import { fmtChange, fmtPct } from "@/lib/stats";

/** แสดงค่าเปลี่ยนแปลงแบบมีสี เช่น −120.83 (−0.16%) */
export function Change({ value, pct, className = "" }: { value: number; pct?: number; className?: string }) {
  const color = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-slate-500";
  return (
    <span className={`tabular-nums ${color} ${className}`}>
      {fmtChange(value)}
      {pct !== undefined && <span className="ml-1 text-xs opacity-80">({fmtPct(pct)})</span>}
    </span>
  );
}

/** ป้ายรูปแบบ เช่น "เปิด− ปิด+" */
export function PatternBadge({ open, close }: { open: number; close: number }) {
  const s = (x: number) => (x > 0 ? "+" : x < 0 ? "−" : "0");
  const c = (x: number) => (x > 0 ? "bg-emerald-100 text-emerald-700" : x < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600");
  return (
    <span className="inline-flex gap-1 text-xs font-medium">
      <span className={`rounded px-1.5 py-0.5 ${c(open)}`}>เปิด{s(open)}</span>
      <span className={`rounded px-1.5 py-0.5 ${c(close)}`}>ปิด{s(close)}</span>
    </span>
  );
}
