import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { todayThai } from "@/lib/intraday";
import { DaySummary, type DaySummaryItem } from "@/components/day-summary";
import { vipSummary, monthMoney, EURO_VIP } from "@/lib/day-summary";
import { BET, STAKES, parseStake, betResult } from "@/lib/bet";
import { europeBack } from "@/lib/europe-back";
import { RangePicker } from "@/components/range-picker";

const shift = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const monthEnd = (ymd: string) => { const d = new Date(`${ymd.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1, 0); return d.toISOString().slice(0, 10); };
const TITLE = "หุ้น VIP ยุโรป";
const baht = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("th-TH")}`;
const tone = (x: number) => (x > 0 ? "text-emerald-600" : x < 0 ? "text-rose-600" : "");
const pct = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)}%` : "—");

/**
 * รายงาน "หุ้น VIP ยุโรป" (อังกฤษ · เยอรมัน · รัสเซีย) — เมนูแยก (ผู้ใช้ขอ 29 ต.ค. 69: "แยกเมนูออกมา กลัวสับกันมั่ว")
 *   โครงเดียวกับหน้าสรุปผล แต่ยอดคิดเฉพาะ 3 ตลาดนี้ ไม่ปนรายงานหลัก (ทั้งสามอยู่ใน REPORT_SKIP_VIP)
 *   ?stake=5…50 · ?date=YYYY-MM-DD เหมือนหน้าสรุปผล
 */
export default async function EuropePage({ searchParams }: PageProps<"/europe">) {
  const { userId } = await requireUser();
  const today = todayThai();
  const sp = await searchParams;
  const asked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const day = asked > today ? today : asked;
  const stake = parseStake(sp.stake);
  // ช่วงย้อนหลัง (?from=&to= · ผู้ใช้ 29 ต.ค. 69: "อิงจาก filter เดือน") — ไม่เลือก = เดือนของวันที่เลือกด้านบน
  const isYmd = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const picked = isYmd(sp.from) && isYmd(sp.to) && sp.from <= sp.to ? { from: sp.from, to: sp.to > today ? today : sp.to } : null;
  const href = (q: { date?: string; stake?: number }) => {
    const p = new URLSearchParams();
    if (q.date) p.set("date", q.date);
    const st = q.stake ?? stake;
    if (st !== BET.stake) p.set("stake", String(st));
    if (picked) { p.set("from", picked.from); p.set("to", picked.to); }
    const qs = p.toString();
    return `/europe${qs ? `?${qs}` : ""}`;
  };
  const isToday = day === today;
  const nextDay = shift(today, 1);
  // ล็อกเลขงวดที่รอผล (กติกาเดียวกับหน้าสรุปผล: ล็อกครั้งเดียว ไม่เขียนทับ) + งวดถัดไป
  const items = await vipSummary(userId, day, stake, isToday, EURO_VIP);
  const next = isToday ? await vipSummary(userId, nextDay, stake, true, EURO_VIP) : [];
  const to = monthEnd(day) < today ? monthEnd(day) : today;
  const m = await monthMoney(userId, [], to, stake, EURO_VIP);
  const label = `${new Date(day).toLocaleDateString("th-TH", { month: "short", year: "2-digit" })} (1–${Number(to.slice(8))})`;
  // ย้อนหลัง (สูตรปัจจุบันฟันทุกงวดจากงวดก่อนหน้า) — แยกจากรายงานผลจริงด้านบน
  const bFrom = picked?.from ?? `${day.slice(0, 7)}-01`, bTo = picked?.to ?? to;
  const bm = await europeBack(userId, EURO_VIP, bFrom, bTo, stake);
  // จุดกำไร/ขาดทุนรายวันในปฏิทิน (รวม 3 ตลาด) — คิดทั้งหมดครั้งเดียว
  const allBack = await europeBack(userId, EURO_VIP, "2000-01-01", today, stake);
  // การ์ดของวัน: ครบ 3 ตลาดเสมอ (ผู้ใช้ 29 ต.ค. 69: "ทำไมแสดงแค่อังกฤษ") — งวดที่ไม่ได้ล็อก ใส่ผลย้อนหลังพร้อมหมายเหตุ · ยอดรวมเดือนด้านบนยังนับเฉพาะเลขล็อก
  const cardItems: DaySummaryItem[] = EURO_VIP.flatMap((mk): DaySummaryItem[] => {
    const real = items.find((x) => x.key === `${mk.code}-2`);
    if (real) return [real];
    const r = allBack.find((x) => x.code === mk.code)?.draws.find((y) => y.d === day);
    if (!r) return [];
    const top = r.top.slice(-2), b = betResult(r.pick, r.drill.flat(), top, r.bottom, stake);
    return [{ key: `${mk.code}-2`, label: mk.label, href: `/vip?market=${mk.code}`, pick: r.pick, drill: r.drill, drillHits: r.drillHits, top, bottom: r.bottom, ...b, status: r.star ? "star" : r.any ? "second" : "miss", note: "ย้อนหลัง — ยังไม่ได้ล็อกเลขในวันนั้น (คิดด้วยสูตรปัจจุบัน) · ไม่นับในรวมเดือน" }];
  });
  const dayProfit: Record<string, number> = {};
  for (const x of allBack) for (const r of x.draws) dayProfit[r.d] = (dayProfit[r.d] ?? 0) + r.profit;
  const firstBack = Object.keys(dayProfit).sort()[0] ?? bFrom;
  const baseQ = new URLSearchParams({ ...(isToday ? {} : { date: day }), ...(stake !== BET.stake ? { stake: String(stake) } : {}) }).toString();
  const rangeName = `${new Date(bFrom).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} – ${new Date(bTo).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`;
  const backMonths = [...new Set(bm.flatMap((x) => x.months.map((y) => y.m)))].sort().reverse();
  const monthName = (mk: string) => new Date(`${mk}-01`).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  const thLabel = (d: string) => new Date(d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{TITLE} <span className="text-sm font-normal text-slate-500">อังกฤษ 21:50 · เยอรมัน 22:50 · รัสเซีย 23:50 · รายงานแยก ไม่ปนกับหน้าสรุปผล</span></h1>
      <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={href({ date: shift(day, -1) })} className="btn-ghost border border-slate-200">‹ วันก่อน</Link>
        <input key={day} type="date" name="date" defaultValue={day} max={today} className="input w-44 px-2 py-1" />
        {stake !== BET.stake && <input type="hidden" name="stake" value={stake} />}
        <button type="submit" className="btn-ghost border border-slate-200">ดู</button>
        {!isToday && <Link href={href({ date: shift(day, 1) })} className="btn-ghost border border-slate-200">วันถัดไป ›</Link>}
        {!isToday && <Link href={href({})} className="btn-primary">กลับมาวันนี้</Link>}
      </form>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-slate-500">ลงทุนเลขละ</span>
        {STAKES.map((s) => (
          <Link key={s} href={href({ date: isToday ? undefined : day, stake: s })} className={`rounded-md border px-2.5 py-0.5 tabular-nums ${s === stake ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>{s}</Link>
        ))}
        <span className="text-slate-500">บาท</span>
      </div>
      <DaySummary
        vipTitle={TITLE}
        note="นับเฉพาะเลขที่ล็อกไว้ก่อนผลออก · เยอรมัน/รัสเซีย เพิ่ม 29 ต.ค. 69 — เริ่มนับจากงวดแรกที่ล็อก · เข้า = เลขฟัน 2 ตัวมาอย่างน้อย 1 ตัว · เจาะเข้า = ตรง 2 ตัวบนหรือล่าง กลับได้"
        dateLabel={`${isToday ? "วันนี้ · " : ""}${thLabel(day)}`}
        regular={[]}
        vip={cardItems}
        month={{ label, regular: m.regular, vip: m.vip, days: m.days, stake }}
        next={next.some((x) => x.pick) ? { label: thLabel(nextDay), items: next } : undefined}
      />


      <section id="back" className="card scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">ย้อนหลัง · ถ้าใช้สูตรปัจจุบันมาตลอด</h2>
          <RangePicker from={bFrom} to={bTo} min={firstBack} max={today} base={`/europe?${baseQ}`} dayProfit={dayProfit} anchor="back" />
          <span className="text-xs text-slate-500">{rangeName}</span>
        </div>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">⚠️ ไม่ใช่ผลจริง — แต่ละงวดระบบฟันด้วยสูตรปัจจุบันจากผลก่อนหน้างวดนั้นเท่านั้น แต่สูตรถูกเลือกโดยดูข้อมูลชุดนี้มาก่อน ตัวเลขจึงอาจสูงกว่าที่จะได้จริง · ใช้ดูว่าระยะยาวได้หรือเสีย และช่วงแย่ ๆ ลึกแค่ไหน · เลขละ {stake} · สุ่มเดา ★ ~38% · 2 ตัว ~64%</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {bm.map((x) => (
            <div key={x.code} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{x.label}</span>
                <span className="text-xs text-slate-400">{x.n.toLocaleString("th-TH")} งวด</span>
              </div>
              <div className={`text-2xl font-semibold tabular-nums ${tone(x.profit)}`}>{baht(x.profit)}</div>
              <div className="text-xs text-slate-600">★ เข้า {pct(x.star, x.n)} · 2 ตัว {pct(x.any, x.n)} · เจาะเข้า {pct(x.drill, x.n)}</div>
              <div className="text-xs text-slate-500">เดือนกำไร {x.months.filter((y) => y.profit > 0).length}/{x.months.length} · ขาดทุนสะสมลึกสุด −{x.drawdown.toLocaleString("th-TH")}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-2 py-1.5 text-left">เดือน</th>{bm.map((x) => <th key={x.code} className="px-2 py-1.5 text-right">{x.label.replace("หุ้น", "").replace(" VIP", "")}</th>)}<th className="px-2 py-1.5 text-right">รวม 3 ตลาด</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backMonths.map((mk) => {
                const v = bm.map((x) => x.months.find((y) => y.m === mk)?.profit), t = v.reduce<number>((a, y) => a + (y ?? 0), 0);
                return (
                  <tr key={mk}>
                    <td className="px-2 py-1">{monthName(mk)}</td>
                    {v.map((y, i) => <td key={i} className={`px-2 py-1 text-right tabular-nums ${y === undefined ? "text-slate-300" : tone(y)}`}>{y === undefined ? "—" : baht(y)}</td>)}
                    <td className={`px-2 py-1 text-right font-medium tabular-nums ${tone(t)}`}>{baht(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {bm.map((x) => (
          <details key={x.code} className="text-sm">
            <summary className="cursor-pointer text-slate-600">{x.label} · รายงวด ({x.draws.length} งวด ใหม่ → เก่า)</summary>
            <div className="mt-2 max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr><th className="px-2 py-1.5 text-left">งวด</th><th className="px-2 py-1.5 text-center">ผล บน/ล่าง</th><th className="px-2 py-1.5 text-center">ฟัน</th><th className="px-2 py-1.5 text-center">เข้า</th><th className="px-2 py-1.5 text-left">เจาะ</th><th className="px-2 py-1.5 text-right">กำไร</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {x.draws.map((r) => (
                    <tr key={r.d}>
                      <td className="px-2 py-1 whitespace-nowrap">{new Date(r.d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</td>
                      <td className="px-2 py-1 text-center font-mono">{r.top}/{r.bottom}</td>
                      <td className="px-2 py-1 text-center font-mono font-semibold">{r.pick.join("-")}</td>
                      <td className="px-2 py-1 text-center">{r.star ? <span className="text-emerald-600">★✓</span> : r.any ? <span className="text-emerald-600">✓</span> : <span className="text-rose-500">✗</span>}</td>
                      <td className="px-2 py-1 font-mono text-xs" title={r.drill.map((s) => s.join(" ")).join(" · ")}>{r.drillHits.length ? <span className="text-emerald-600">{r.drillHits.join(", ")}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${tone(r.profit)}`}>{baht(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
