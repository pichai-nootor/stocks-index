import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { todayThai } from "@/lib/intraday";
import { DaySummary } from "@/components/day-summary";
import { MonthBoard } from "@/components/month-board";
import { regularSummary, vipSummary, monthMoney } from "@/lib/day-summary";
import { BET, STAKES, parseStake } from "@/lib/bet";

const shift = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const monthEnd = (ymd: string) => { const d = new Date(`${ymd.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1, 0); return d.toISOString().slice(0, 10); };

/**
 * หน้าแรก: สรุปผลของวัน — หุ้นปกติ + หุ้น VIP เข้ากี่งวด ไม่เข้ากี่งวด (ส่วนอื่นเข้าจากเมนู)
 *   ?stake=5…50 เงินต่อเลข (ค่าเริ่มต้น 20) — ทุน/ได้/กำไรทั้งหน้าคิดตามค่านี้
 *   ?date=YYYY-MM-DD ดูวันอื่นได้ (ค่าเริ่มต้น = วันนี้) · แถบรวมเดือน = เดือนของวันที่เลือก ตั้งแต่วันที่ 1 ถึงสิ้นเดือน (เดือนปัจจุบันถึงวันนี้)
 */
export default async function SummaryPage({ searchParams }: PageProps<"/summary">) {
  const { userId } = await requireUser();
  const today = todayThai();
  const sp = await searchParams;
  const asked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const day = asked > today ? today : asked;
  const stake = parseStake(sp.stake);
  /** ลิงก์ของหน้านี้ที่จำเงินต่อเลขไว้ (ค่าเริ่มต้นไม่ต้องใส่) */
  const href = (q: { date?: string; stake?: number }) => {
    const p = new URLSearchParams();
    if (q.date) p.set("date", q.date);
    const st = q.stake ?? stake;
    if (st !== BET.stake) p.set("stake", String(st));
    const qs = p.toString();
    return `/summary${qs ? `?${qs}` : ""}`;
  };
  const stocks = await prisma.stock.findMany({ where: { userId }, include: { records: { orderBy: { date: "asc" } } }, orderBy: { symbol: "asc" } });
  const [regular, vip] = [regularSummary(stocks, day, stake), await vipSummary(userId, day, stake, day === today)];
  const to = monthEnd(day) < today ? monthEnd(day) : today;
  const m = await monthMoney(userId, stocks, to, stake);
  const month = { label: `${new Date(day).toLocaleDateString("th-TH", { month: "short", year: "2-digit" })} (1–${Number(to.slice(8))})`, regular: m.regular, vip: m.vip, days: m.days, stake };
  const isToday = day === today;
  return (
    <div className="space-y-4">
      {/* เลือกวัน: ก่อนหน้า · ปฏิทิน · ถัดไป · วันนี้ — ฟอร์ม GET ธรรมดา (ไม่ต้องใช้ JS) */}
      <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={href({ date: shift(day, -1) })} className="btn-ghost border border-slate-200">‹ วันก่อน</Link>
        <input type="date" name="date" defaultValue={day} max={today} className="input w-44 px-2 py-1" />
        {stake !== BET.stake && <input type="hidden" name="stake" value={stake} />}
        <button type="submit" className="btn-ghost border border-slate-200">ดู</button>
        {!isToday && <Link href={href({ date: shift(day, 1) })} className="btn-ghost border border-slate-200">วันถัดไป ›</Link>}
        {!isToday && <Link href={href({})} className="btn-primary">กลับมาวันนี้</Link>}
      </form>
      {/* เงินต่อเลข: กดแล้วทุน/ได้/กำไรทั้งหน้าคิดใหม่ (วันที่เลือกอยู่คงเดิม) */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-slate-500">ลงทุนเลขละ</span>
        {STAKES.map((s) => (
          <Link key={s} href={href({ date: isToday ? undefined : day, stake: s })} className={`rounded-md border px-2.5 py-0.5 tabular-nums ${s === stake ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>{s}</Link>
        ))}
        <span className="text-slate-500">บาท</span>
      </div>
      <DaySummary dateLabel={`${isToday ? "วันนี้ · " : ""}${new Date(day).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}`} regular={regular} vip={vip} month={month} />
      <MonthBoard label={month.label} items={m.items} />
    </div>
  );
}
