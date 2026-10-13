import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasClose } from "@/lib/stats";
import { top2, bottom2 } from "@/lib/digits";
import { pickTwoFor, amDigitsFor } from "@/lib/formulas/stocks";
import { todayThai } from "@/lib/intraday";
import { Digits } from "@/components/digit-badges";
import { PickDigits, HitBadge } from "@/components/pick-view";
import { DowJonesSetup } from "./dowjones-setup";
import { isDowJones } from "@/lib/stocks/dowjones";

/**
 * ตลาดเรียงตามเวลาผลออก (ไทย) — รอบเช้า/บ่ายของตลาดเดียวกันอยู่การ์ดเดียว
 *   manual = รอบที่ผู้ใช้กรอกเปิดเอง (ระบบดึงเปิดบ่ายผิด — ดู memory pm-open-manual)
 */
const MARKETS: { title: string; source: string; rows: { symbol: string; round?: string; time: string; manual?: boolean }[] }[] = [
  // time = เวลาผลออก (ไทย)
  { title: "นิเคอิ", source: "Nikkei 225 · Yahoo", rows: [{ symbol: "NIKKEI เช้า", round: "เช้า", time: "09:30 น." }, { symbol: "NIKKEI บ่าย", round: "บ่าย", time: "13:30 น.", manual: true }] },
  { title: "จีน", source: "SZSE Component · Yahoo", rows: [{ symbol: "CHINA เช้า", round: "เช้า", time: "10:30 น." }, { symbol: "CHINA บ่าย", round: "บ่าย", time: "14:00 น.", manual: true }] },
  { title: "ฮั่งเส็ง", source: "Hang Seng Index · Yahoo", rows: [{ symbol: "HSI เช้า", round: "เช้า", time: "11:00 น." }, { symbol: "HSI บ่าย", round: "บ่าย", time: "15:00 น.", manual: true }] },
  { title: "อินเดีย", source: "BSE SENSEX · BSE / Yahoo", rows: [{ symbol: "BSE SENSEX", time: "17:00 น." }] },
  { title: "อียิปต์", source: "EGX 30 · mubasher.info", rows: [{ symbol: "EGX30", time: "18:30 น." }] },
  { title: "ดาวโจนส์", source: "Dow Jones · Yahoo ^DJI", rows: [{ symbol: "DOW JONES", time: "03:05 น. (คืนถัดไป)" }] },
];

const thDay = (d: Date) => d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function StocksPage() {
  const { userId } = await requireUser();
  const today = todayThai();
  const stocks = await prisma.stock.findMany({ where: { userId }, include: { records: { orderBy: { date: "asc" } } } });
  const bySymbol = new Map(stocks.map((s) => [s.symbol, s]));
  const known = new Set(MARKETS.flatMap((m) => m.rows.map((r) => r.symbol)));
  const others = stocks.filter((s) => !known.has(s.symbol));

  /** สถานะของงวดล่าสุด: เลขฟัน · ผล · เข้าไหม — คิดแบบเดียวกับหน้า report (pickTwoFor) */
  const latest = (s: (typeof stocks)[number]) => {
    const r = s.records[s.records.length - 1];
    if (!r) return null;
    const history = s.records.filter(hasClose).filter((x) => x.date < r.date);
    const two = pickTwoFor(s.symbol, r.openValue, r.openChange, history, { date: r.date, am: amDigitsFor(stocks, s.symbol) });
    const done = hasClose(r);
    const pick = two.amWait && !done ? [] : two.digits.map((d) => d.digit); // รอบบ่ายจีน/นิเคอิ: ยังไม่มีผลเช้า = ยังไม่มีเลขฟัน
    const top = done ? top2(r.closeValue!) : null, bottom = done ? bottom2(r.closeChange!) : null;
    const hits = top && bottom ? pick.filter((d) => (top + bottom).includes(d)) : null;
    return { r, pick, top, bottom, hits, isToday: r.date.toISOString().slice(0, 10) === today };
  };

  const renderRow = ({ symbol, round, time, manual }: { symbol: string; round?: string; time: string; manual?: boolean }) => {
    const s = bySymbol.get(symbol);
    if (!s) return null;
    const x = latest(s);
    return (
      <Link key={s.id} href={`/stocks/${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 transition hover:bg-slate-50 lg:flex-nowrap">
        <div className="w-24 shrink-0">
          <p className="font-medium text-slate-800">{round ?? s.symbol}</p>
          <p className="text-xs text-slate-500">ผลออก {time}</p>
        </div>
        {!x ? <span className="text-xs text-slate-400">ยังไม่มีข้อมูล</span> : (
          <>
            <div className="w-14 shrink-0 text-xs leading-tight text-slate-500">{thDay(x.r.date)}{x.isToday && <span className="mt-0.5 block w-fit rounded bg-blue-50 px-1 text-blue-700">วันนี้</span>}</div>
            {x.pick.length ? <PickDigits digits={x.pick} hit={x.hits} size="xs" /> : <span className="text-xs text-amber-700">⏳ รอผลเช้า</span>}
            <span className="flex items-center gap-1">
              {x.top && x.bottom ? <><Digits value={x.top} hilite={x.pick} tone="blue" /><span className="text-slate-300">/</span><Digits value={x.bottom} hilite={x.pick} tone="blue" /></> : manual ? <span className="text-xs text-slate-400">เปิดบ่ายกรอกเอง</span> : null}
            </span>
            <span className="ml-auto shrink-0"><HitBadge pick={x.pick} hits={x.hits} pending="รอผล" /></span>
          </>
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">หุ้นปกติ</h1>
          <p className="text-sm text-slate-500">เรียงตามเวลาผลออก (ไทย) · แสดงงวดล่าสุดของแต่ละรอบ · กดเพื่อดูประวัติและกรอกเปิด</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {MARKETS.filter((m) => m.rows.some((r) => bySymbol.has(r.symbol))).map((m) => (
          <section key={m.title} className="card p-3">
            <div className="flex items-baseline justify-between px-3 pb-1">
              <h2 className="font-semibold">{m.title}</h2>
              <span className="text-xs text-slate-400">{m.source}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {m.rows.map((r) => renderRow(r))}
            </div>
          </section>
        ))}
        {others.length > 0 && (
          <section className="card p-3">
            <h2 className="px-3 pb-1 font-semibold">อื่น ๆ</h2>
            <div className="divide-y divide-slate-100">
              {others.map((s) => renderRow({ symbol: s.symbol, time: "—" }))}
            </div>
          </section>
        )}
      </div>
      {!stocks.some((s) => isDowJones(s.symbol)) && <div className="card"><DowJonesSetup label="เพิ่มหุ้นดาวโจนส์ + ดึงย้อนหลัง 50 วัน" /></div>}
    </div>
  );
}
