import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasClose, summarize, fmtNum, fmtChange } from "@/lib/stats";
import { pickTwo, top2, bottom2 } from "@/lib/digits";
import { Digits } from "@/components/digit-badges";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEKDAYS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const shift = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return ym(d); };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stocks = await prisma.stock.findMany({ where: { userId }, include: { _count: { select: { records: true } } }, orderBy: { symbol: "asc" } });
  const defaultStock = [...stocks].sort((a, b) => b._count.records - a._count.records)[0];
  const stockId = typeof sp.stock === "string" && stocks.some((s) => s.id === sp.stock) ? sp.stock : defaultStock?.id ?? "";
  const selected = stocks.find((s) => s.id === stockId);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ym(new Date());
  const [year, mon] = month.split("-").map(Number);

  const all = selected ? await prisma.record.findMany({ where: { stockId: selected.id }, orderBy: { date: "asc" } }) : [];
  const closed = all.filter(hasClose);

  // ฟันธง + ผล ของทุกวัน (ใช้ข้อมูลก่อนหน้าวันนั้น)
  const byDate = new Map<string, {
    r: (typeof all)[number]; pick: string; pair: string[]; hit1: boolean | null; hit2: string[];
  }>();
  for (const r of all) {
    const hist = closed.filter((d) => d.date.getTime() < r.date.getTime());
    const pair = pickTwo(r.openValue, r.openChange, hist).digits.map((x) => x.digit), pick = pair[0];
    const cd = hasClose(r) ? [...new Set((top2(r.closeValue) + bottom2(r.closeChange)).split(""))] : null;
    byDate.set(r.date.toISOString().slice(0, 10), { r, pick, pair, hit1: cd ? cd.includes(pick) : null, hit2: cd ? pair.filter((d) => cd.includes(d)) : [] });
  }

  // ตารางเดือน (เริ่มวันจันทร์)
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  // สรุปเดือน
  const monthRecs = closed.filter((r) => ym(r.date) === month);
  const monthJudged = monthRecs.map((r) => byDate.get(r.date.toISOString().slice(0, 10))!);
  const hit1 = monthJudged.filter((x) => x.hit1).length;
  const hit2 = monthJudged.filter((x) => x.hit2.length > 0).length;
  const st = summarize(monthRecs);
  const monthsAvailable = [...new Set(all.map((r) => ym(r.date)))].sort();
  const q = (m: string) => `/calendar?stock=${stockId}&month=${m}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">ปฏิทิน</h1>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="month" value={month} />
          <select name="stock" className="input w-auto" defaultValue={stockId}>
            {stocks.map((s) => <option key={s.id} value={s.id}>{s.symbol}</option>)}
          </select>
          <button className="btn-ghost border border-slate-200">เปลี่ยน</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={q(shift(month, -1))} className="btn-ghost border border-slate-200">‹</Link>
          <span className="min-w-36 text-center text-lg font-medium">{TH_MONTHS[mon - 1]} {year + 543}</span>
          <Link href={q(shift(month, 1))} className="btn-ghost border border-slate-200">›</Link>
        </div>
        <div className="flex flex-wrap gap-1">
          {monthsAvailable.map((m) => (
            <Link key={m} href={q(m)} className={`rounded-md px-2 py-1 text-xs ${m === month ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {TH_MONTHS[Number(m.slice(5)) - 1]} {Number(m.slice(0, 4)) + 543}
            </Link>
          ))}
        </div>
      </div>

      {/* สรุปเดือน */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card"><p className="text-xs text-slate-500">วันที่มีข้อมูล</p><p className="text-2xl font-semibold">{monthRecs.length}</p></div>
        <div className="card"><p className="text-xs text-slate-500">ฟัน 1 ตัวถูก</p><p className={`text-2xl font-semibold ${monthRecs.length && hit1 / monthRecs.length > 0.4 ? "text-emerald-600" : ""}`}>{monthRecs.length ? `${hit1}/${monthRecs.length}` : "-"}</p><p className="text-xs text-slate-500">{monthRecs.length ? `${Math.round((hit1 / monthRecs.length) * 100)}% · สุ่ม ≈ 34%` : ""}</p></div>
        <div className="card"><p className="text-xs text-slate-500">คู่โผล่ ≥1</p><p className="text-2xl font-semibold">{monthRecs.length ? `${hit2}/${monthRecs.length}` : "-"}</p><p className="text-xs text-slate-500">{monthRecs.length ? `${Math.round((hit2 / monthRecs.length) * 100)}% · สุ่ม ≈ 57%` : ""}</p></div>
        <div className="card"><p className="text-xs text-slate-500">ทิศทาง</p><p className="text-sm"><span className="text-emerald-600">ปิด+ {st.all.closeUp}</span> · <span className="text-red-600">ปิด− {st.all.closeDown}</span></p><p className="text-xs text-slate-500">เปิด+→ปิด+ {st.whenOpenUp.count ? `${st.patterns.upUp}/${st.whenOpenUp.count}` : "-"} · เปิด−→ปิด− {st.whenOpenDown.count ? `${st.patterns.downDown}/${st.whenOpenDown.count}` : "-"}</p></div>
      </div>

      {/* ปฏิทิน */}
      <div className="card overflow-x-auto p-0">
        <div className="grid min-w-[700px] grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {WEEKDAYS.map((w, i) => <div key={w} className={`py-2 ${i >= 5 ? "text-slate-400" : ""}`}>{w}</div>)}
        </div>
        <div className="grid min-w-[700px] grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-28 border-b border-r border-slate-100 bg-slate-50/50" />;
            const key = `${month}-${String(day).padStart(2, "0")}`;
            const x = byDate.get(key);
            const weekend = i % 7 >= 5;
            return (
              <div key={i} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${weekend ? "bg-slate-50/50" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${weekend ? "text-slate-400" : "text-slate-600"}`}>{day}</span>
                  {x && (
                    x.hit1 === null ? <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800">รอปิด</span>
                    : x.hit2.length === 2 ? <span className="rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-800">✓✓</span>
                    : x.hit2.length ? <span className="rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-800">✓</span>
                    : <span className="rounded bg-red-100 px-1 text-[10px] text-red-800">✗</span>
                  )}
                </div>
                {x && (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-1">
                      {x.pair.map((d) => { const ok = x.hit1 === null ? null : x.hit2.includes(d); return (
                        <span key={d} className={`flex h-6 w-6 items-center justify-center rounded font-mono text-sm font-bold ${ok ? "bg-amber-400 text-white" : ok === false ? "bg-slate-200 text-slate-500 line-through" : "bg-amber-100 text-amber-900"}`}>{d}</span>
                      ); })}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      เปิด <span className="font-mono">{top2(x.r.openValue)}/{bottom2(x.r.openChange)}</span>
                      <span className={x.r.openChange < 0 ? "text-red-600" : "text-emerald-600"}> {fmtChange(x.r.openChange, 0)}</span>
                    </div>
                    {hasClose(x.r) ? (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        ปิด <Digits value={top2(x.r.closeValue)} hilite={x.hit2} tone="blue" /><Digits value={bottom2(x.r.closeChange)} hilite={x.hit2} tone="blue" />
                        <span className={x.r.closeChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(x.r.closeChange, 0)}</span>
                      </div>
                    ) : <div className="text-[10px] text-slate-400">ยังไม่มีปิด</div>}
                    <div className="text-[10px] tabular-nums text-slate-400">{fmtNum(x.r.openValue, 0)} → {hasClose(x.r) ? fmtNum(x.r.closeValue, 0) : "?"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500">เลข 2 ตัว = ฟันของวันนั้น (จากเลขเปิด) · ✓ = โผล่ 1 ตัว · ✓✓ = โผล่ทั้งคู่ · ✗ = ไม่โผล่ · เหลืองในเลขปิด = เลขที่ฟันแล้วโผล่</p>
    </div>
  );
}
