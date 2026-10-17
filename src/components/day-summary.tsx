import Link from "next/link";
import { Digits } from "@/components/digit-badges";
import { BET, betCost } from "@/lib/bet";
import type { MoneyTotal } from "@/lib/day-summary";

export type DaySummaryItem = {
  key: string;
  label: string;
  href: string;
  /** เลขที่ฟัน [★, ตัวรอง] — null = ยังไม่ได้ฟัน */
  pick: string[] | null;
  /** ผล 2 ตัวบน / 2 ตัวล่าง (ถ้าออกแล้ว) */
  top?: string;
  bottom?: string;
  status: "star" | "second" | "miss" | "pending";
  /** ข้อความแทนเลขฟันตอนยังฟันไม่ได้ (เช่น รอบบ่ายที่รอผลรอบเช้า) */
  wait?: string;
  /** หมายเหตุใต้แถว (เช่น เลขจากสูตรคิดย้อนหลัง ไม่ใช่เลขที่ล็อกไว้) */
  note?: string;
  /** เลขเจาะ 2 ชุด (ชุดละ 6) และตัวที่มา */
  drill?: string[][];
  drillHits?: string[];
  /** เงิน (ตามวิธีแทงใน lib/bet.ts): ทุน · ใบที่ถูก · ได้ · กำไร — ผลยังไม่ออกมีแค่ทุน */
  cost?: number;
  tickets?: number;
  win?: number;
  profit?: number;
};

const baht = (n: number) => n.toLocaleString("en-US");
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${baht(Math.abs(n))}`;

/** ผลเงินรวมของรายการที่ผลออกแล้ว */
function money(items: DaySummaryItem[]) {
  const done = items.filter((x) => x.profit !== undefined);
  return { n: done.length, cost: done.reduce((a, x) => a + x.cost!, 0), win: done.reduce((a, x) => a + x.win!, 0), profit: done.reduce((a, x) => a + x.profit!, 0), waitCost: items.filter((x) => x.profit === undefined).reduce((a, x) => a + (x.cost ?? 0), 0) };
}

function MoneyLine({ items, big = false }: { items: DaySummaryItem[]; big?: boolean }) {
  const m = money(items);
  return (
    <p className={big ? "text-sm" : "text-xs text-slate-600"}>
      ลงทุน {baht(m.cost)} · ได้ {baht(m.win)} · <span className={`font-semibold ${m.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{m.profit >= 0 ? "กำไร" : "ขาดทุน"} {signed(m.profit)}</span>
      <span className="text-slate-400"> ({m.n} งวดที่ออกแล้ว{m.waitCost ? ` · รอผลอีก ${baht(m.waitCost)}` : ""})</span>
    </p>
  );
}

const BADGE: Record<DaySummaryItem["status"], { text: string; cls: string }> = {
  star: { text: "✓ ★ เข้า", cls: "bg-emerald-100 text-emerald-800" },
  second: { text: "✓ ตัวรองเข้า", cls: "bg-emerald-50 text-emerald-700" },
  miss: { text: "✗ ไม่เข้า", cls: "bg-red-100 text-red-800" },
  pending: { text: "รอผล", cls: "bg-slate-100 text-slate-500" },
};

/**
 * ป้ายเลขเจาะ — บอกแค่ข้อความ (เจาะเข้า / เจาะไม่เข้า / เลขเจาะ) ส่วนเลข 2 ชุดอยู่ใน tooltip
 *   ชี้ (คอม) หรือแตะ (มือถือ — focus) เพื่อดู · ใช้ CSS ล้วน ไม่ต้องเป็น client component
 */
function DrillTip({ drill, hits }: { drill: string[][]; hits?: string[] }) {
  const done = hits !== undefined;
  const label = !done ? "เลขเจาะ" : hits.length ? "เจาะเข้า" : "เจาะไม่เข้า";
  const cls = !done ? "border border-slate-200 text-slate-500" : hits.length ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500";
  return (
    <span tabIndex={0} className="group relative cursor-help rounded outline-none">
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-max max-w-[16rem] rounded-md border border-slate-200 bg-white p-2 text-left shadow-lg group-hover:block group-focus:block">
        <span className="block text-[11px] text-slate-500">{!done ? "เลขเจาะ 2 ชุด (กลับได้) — รอผล" : hits.length ? `เข้า ${hits.join(" ")}` : "ไม่มีตัวไหนเข้า"}</span>
        {drill.map((set, k) => (
          <span key={k} className="mt-1 flex flex-wrap gap-x-1.5 font-mono text-xs text-slate-600">
            {set.map((m) => <span key={m} className={hits?.includes(m) ? "rounded bg-emerald-100 px-1 font-semibold text-emerald-800" : ""}>{m}</span>)}
          </span>
        ))}
      </span>
    </span>
  );
}

function Group({ title, items }: { title: string; items: DaySummaryItem[] }) {
  const hit = items.filter((x) => x.status === "star" || x.status === "second").length;
  const star = items.filter((x) => x.status === "star").length;
  const miss = items.filter((x) => x.status === "miss").length;
  const wait = items.filter((x) => x.status === "pending").length;
  const drillHit = items.filter((x) => x.drillHits?.length).length;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm">
          <span className="font-semibold text-emerald-700">เข้า {hit}</span>
          <span className="text-slate-400"> (★ {star})</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-semibold text-red-700">ไม่เข้า {miss}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-semibold text-amber-700">เจาะเข้า {drillHit}</span>
          {wait > 0 && <><span className="mx-1.5 text-slate-300">·</span><span className="text-slate-500">รอผล {wait}</span></>}
        </p>
      </div>
      <MoneyLine items={items} />
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">วันนี้ยังไม่มีงวด</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {items.map((x) => (
            <li key={x.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
              <Link href={x.href} className="w-36 shrink-0 truncate text-blue-700 hover:underline">{x.label}</Link>
              {x.wait && !x.pick ? <span className="min-w-0 flex-1 text-xs text-amber-700">⏳ {x.wait}</span>
                : <span className="w-20 shrink-0 font-mono text-xs text-slate-600">{x.pick ? <>★{x.pick[0]} {x.pick[1]}</> : "–"}</span>}
              <span className="flex items-center gap-1">
                {x.top !== undefined && x.bottom !== undefined ? <><Digits value={x.top} hilite={x.pick ?? []} tone="blue" /><span className="text-slate-300">/</span><Digits value={x.bottom} hilite={x.pick ?? []} tone="blue" /></> : null}
              </span>
              <span className="ml-auto flex items-center gap-1">
                {x.profit !== undefined ? (
                  <span title={`ลงทุน ${baht(x.cost!)} · ถูก ${x.tickets} ใบ ได้ ${baht(x.win!)}`} className={`w-16 text-right text-xs font-semibold tabular-nums ${x.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{signed(x.profit)}</span>
                ) : x.cost ? <span className="w-16 text-right text-xs tabular-nums text-slate-400">ทุน {baht(x.cost)}</span> : null}
                {x.drill && <DrillTip drill={x.drill} hits={x.drillHits} />}
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${BADGE[x.status].cls}`}>{BADGE[x.status].text}</span>
              </span>
              {x.note && <p className="w-full text-[11px] text-slate-400">ⓘ {x.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function P({ v }: { v: number }) {
  return <span className={`font-semibold ${v >= 0 ? "text-emerald-700" : "text-red-700"}`}>{signed(v)}</span>;
}

/** แถบรวมเงินของเดือน (วันที่ 1 ถึงวันนี้) — หุ้นปกติ + VIP */
function MonthBar({ month }: { month: { label: string; regular: MoneyTotal; vip: MoneyTotal; days: number; stake?: number } }) {
  const stake = month.stake ?? BET.stake;
  const t = { n: month.regular.n + month.vip.n, cost: month.regular.cost + month.vip.cost, win: month.regular.win + month.vip.win, profit: month.regular.profit + month.vip.profit };
  // เดือนที่ยังไม่ได้ใช้ระบบ (ไม่มีเลขล็อกเลย) → ไม่แสดงเงิน (ผู้ใช้ขอ 17 ต.ค. 69)
  if (!t.n) return <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">เดือน {month.label} ยังไม่ได้ใช้ระบบ — ไม่มีผลจริง</p>;
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-sm">
        <span className="font-medium">รวมเดือน {month.label}:</span> ลงทุน {baht(t.cost)} · ได้ {baht(t.win)} · {t.profit >= 0 ? "กำไร" : "ขาดทุน"} <P v={t.profit} />
        <span className="text-slate-400"> ({month.days} วัน · รวม {t.n} งวดจากทุกหุ้นและทุกรอบ)</span>
      </p>
      <p className="text-xs text-slate-600">หุ้นปกติ <P v={month.regular.profit} /> <span className="text-slate-400">({month.regular.n} งวด)</span> · หุ้น VIP <P v={month.vip.profit} /> <span className="text-slate-400">({month.vip.n} งวด)</span> · เฉลี่ยวันละ <P v={month.days ? Math.round(t.profit / month.days) : 0} /></p>
      <p className="text-[11px] text-slate-400">วิธีแทง: รูดเลขฟัน 2 ตัว (19 ประตู) เลขละ {stake} บาท บน+ล่าง · เจาะ 12 ตัว ตัวละ {stake} กลับเลข บน+ล่าง · จ่ายบาทละ {BET.payout} → ทุน {baht(betCost(2, 12, stake))} ต่องวด · ถูก 1 ใบ = {baht(stake * BET.payout)} · ตัวเลขของวันที่เลือกอยู่ที่หัวแต่ละฝั่งด้านล่าง</p>
    </div>
  );
}

/** สรุปผลของวัน: หุ้นปกติ + หุ้น VIP เข้ากี่งวด ไม่เข้ากี่งวด (นับ "เข้า" = เลขฟัน 2 ตัว มาอย่างน้อย 1 ตัว) */
export function DaySummary({ dateLabel, regular, vip, month }: { dateLabel: string; regular: DaySummaryItem[]; vip: DaySummaryItem[]; month: { label: string; regular: MoneyTotal; vip: MoneyTotal; days: number; stake?: number } }) {
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">สรุปผล · {dateLabel}</h2>
        <p className="text-xs text-slate-500">เข้า = เลขฟัน 2 ตัวมาอย่างน้อย 1 ตัว (ใน 2 ตัวบนหรือล่าง) · เจาะเข้า = เลขเจาะตรง 2 ตัวบนหรือล่าง กลับได้ (ชี้ที่ป้ายเพื่อดูเลข) · VIP ใช้เลขที่ล็อกไว้ก่อนผลออก · ไม่รวมอินเดีย VIP (เก็บสถิติก่อน)</p>
      </div>
      <MonthBar month={month} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Group title="หุ้นปกติ" items={regular} />
        <Group title="หุ้น VIP" items={vip} />
      </div>
    </section>
  );
}
