import Link from "next/link";
import type { MonthItem } from "@/lib/day-summary";

const baht = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${baht(Math.abs(n))}`;
const pct = (a: number, n: number) => (n ? `${Math.round((a / n) * 100)}%` : "–");

/** กราฟเส้นเล็กของกำไรสะสม (SVG ล้วน) — เส้นประ = จุดเท่าทุน */
function Spark({ curve, up }: { curve: number[]; up: boolean }) {
  const pts = [0, ...curve];
  const W = 120, H = 32;
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
  const x = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * W : 0);
  const y = (v: number) => H - ((v - lo) / span) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-28 shrink-0" aria-hidden>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="currentColor" className="text-slate-300" strokeDasharray="3 3" strokeWidth={1} />
      <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" strokeWidth={1.75} className={up ? "stroke-emerald-600" : "stroke-red-600"} />
    </svg>
  );
}

function Card({ it }: { it: MonthItem }) {
  const up = it.profit >= 0;
  return (
    <Link href={it.href} className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{it.label}</p>
          <p className={`text-lg font-semibold tabular-nums ${up ? "text-emerald-700" : "text-red-700"}`}>{signed(it.profit)}</p>
        </div>
        <Spark curve={it.curve} up={up} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{it.n} งวด · ลงทุน {baht(it.cost)} · ได้ {baht(it.win)}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
        <div className="rounded bg-slate-50 py-1"><p className="text-slate-400">เข้า</p><p className="font-semibold tabular-nums text-slate-700">{pct(it.any, it.n)}</p></div>
        <div className="rounded bg-slate-50 py-1"><p className="text-slate-400">★ เข้า</p><p className="font-semibold tabular-nums text-slate-700">{pct(it.star, it.n)}</p></div>
        <div className="rounded bg-slate-50 py-1"><p className="text-slate-400">เจาะเข้า</p><p className="font-semibold tabular-nums text-slate-700">{pct(it.drill, it.n)}</p></div>
      </div>
    </Link>
  );
}

/**
 * Dashboard รายตัวของเดือน — การ์ดละหุ้น/ตลาด×รอบ เรียงกำไรมาก→น้อย
 *   เข้า = เลขฟัน 2 ตัวมาอย่างน้อย 1 ตัว · สุ่มเดา: เข้า ~59% · ★ ~34% · เจาะ ~41–47%
 */
export function MonthBoard({ label, items }: { label: string; items: MonthItem[] }) {
  const sorted = [...items].sort((a, b) => b.profit - a.profit);
  const groups = [
    { title: "หุ้นปกติ", list: sorted.filter((x) => x.group === "ปกติ") },
    { title: "หุ้น VIP", list: sorted.filter((x) => x.group === "VIP") },
  ];
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">ผลรายตัว · เดือน {label}</h2>
        <p className="text-xs text-slate-500">เรียงตามกำไร · กราฟ = กำไรสะสมทีละงวด (เส้นประ = เท่าทุน) · สุ่มเดา: เข้า ~59% · ★ ~34% · กดการ์ดเพื่อดูรายละเอียด</p>
      </div>
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="mb-2 text-sm font-medium text-slate-600">{g.title} <span className="text-slate-400">({g.list.length})</span></h3>
          {g.list.length === 0 ? <p className="text-xs text-slate-400">ไม่มีงวดในเดือนนี้</p> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.list.map((it) => <Card key={it.key} it={it} />)}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
