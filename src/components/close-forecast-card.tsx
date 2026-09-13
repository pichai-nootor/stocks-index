import { fmtNum, type CloseForecast, type DirectionForecast } from "@/lib/stats";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const sp = (x: number) => (x >= 0 ? "+" : "") + fmtNum(x, 0);

/** การ์ด "จุดที่มักไปปิด" จากค่าเปิด */
export function CloseForecastCard({ open, f, dir }: { open: number; f: CloseForecast; dir: DirectionForecast }) {
  const prev = open / (1 + f.openPct / 100);
  const w = (v: number) => `${((v - f.p80[0]) / (f.p80[1] - f.p80[0])) * 100}%`;
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">จุดที่มักไปปิด (เทียบกับเปิด)</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums">{fmtNum(f.median)}</span>
        <span className="text-sm text-slate-600">≈ เปิด {sp(f.median - open)} จุด</span>
        <span className="text-xs text-slate-500">เปิด {f.tier.label} · สถิติ 10 ปี {f.tier.n} วัน{f.own ? ` · ของคุณ ${f.own.n} วัน` : ""}</span>
      </div>

      {/* แถบช่วง */}
      <div className="relative mt-4 h-10">
        <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-slate-200" />
        <div className="absolute top-4 h-2 rounded-full bg-blue-300" style={{ left: w(f.p50[0]), width: `calc(${w(f.p50[1])} - ${w(f.p50[0])})` }} />
        <div className="absolute top-2.5 h-5 w-1 rounded bg-blue-700" style={{ left: w(f.median) }} title="มัธยฐาน" />
        <div className="absolute top-2.5 h-5 w-0.5 bg-slate-500" style={{ left: w(open) }} title="เปิด" />
        {prev >= f.p80[0] && prev <= f.p80[1] && <div className="absolute top-2.5 h-5 w-0.5 border-l border-dashed border-red-500" style={{ left: w(prev) }} title="ปิดวันก่อน" />}
        <span className="absolute left-0 top-7 text-[10px] tabular-nums text-slate-500">{fmtNum(f.p80[0], 0)}</span>
        <span className="absolute right-0 top-7 text-[10px] tabular-nums text-slate-500">{fmtNum(f.p80[1], 0)}</span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-slate-500">ช่วง 50% ของวัน</dt><dd className="tabular-nums">{fmtNum(f.p50[0], 0)} – {fmtNum(f.p50[1], 0)}</dd></div>
        <div><dt className="text-xs text-slate-500">ช่วง 80% ของวัน</dt><dd className="tabular-nums">{fmtNum(f.p80[0], 0)} – {fmtNum(f.p80[1], 0)}</dd></div>
        <div><dt className="text-xs text-slate-500">ปิดสูงกว่าเปิด</dt><dd className={f.pAboveOpen >= 0.5 ? "text-emerald-600" : "text-red-600"}>{pct(f.pAboveOpen)}</dd></div>
        <div><dt className="text-xs text-slate-500">ปิดสูงกว่าปิดวันก่อน</dt><dd className={dir.pUp >= 0.5 ? "text-emerald-600" : "text-red-600"}>{pct(dir.pUp)}</dd></div>
      </dl>
      <p className="mt-2 text-[11px] text-slate-500">เส้นเทา = เปิด · เส้นน้ำเงิน = จุดปิดคาดการณ์ · แถบน้ำเงิน = ช่วง 50% · เส้นประแดง = ปิดวันก่อน</p>
    </div>
  );
}
