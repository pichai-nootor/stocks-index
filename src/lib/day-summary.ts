/**
 * สรุปผลของวัน (หน้าแรก) — หุ้นปกติ + หุ้น VIP ของวันที่ (ไทย) เดียวกัน
 *   "เข้า" = เลขฟัน 2 ตัว (★ + ตัวรอง) มาอย่างน้อย 1 ตัวในผล 2 ตัวบน/ล่าง
 *   VIP ยึดเลขที่ล็อกไว้ก่อนผลออก (สิ่งที่ผู้ใช้เห็นจริง) · ไม่มีเลขล็อก → ฟันจากงวดก่อนหน้าด้วยสูตรของตลาดนั้น
 *   เลขเจาะ 2 ชุด × 6 ตัว คำนวณแบบเดียวกับหน้าหุ้น/หน้า VIP · เจาะมา = ตรง 2 ตัวบนหรือล่าง กลับได้
 */
import type { Record as Row, Stock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasClose } from "@/lib/stats";
import { top2, bottom2 } from "@/lib/digits";
import { pickTwoFor, amDigitsFor } from "@/lib/formulas/stocks";
import { formulaFor } from "@/lib/formulas";
import { resultDigits, drillHit, lockedDrill } from "@/lib/formulas/types";
import { VIP_MARKETS, vipWaitReason } from "@/lib/vip";
import { lockedStockPick } from "@/lib/stock-lock";
import type { DaySummaryItem } from "@/components/day-summary";
import { betCost, betResult } from "@/lib/bet";

/**
 * ตลาด VIP ที่ยังไม่นับในหน้าสรุป (ผู้ใช้สั่ง 12 ต.ค. 69): อินเดีย VIP ยังไม่น่าลงทุน — เก็บสถิติทุกวันในหน้า VIP ต่อไปจนครบ ~100 งวดก่อน
 *   เอารหัสออกจากลิสต์นี้เมื่อจะกลับมานับ
 */
export const REPORT_SKIP_VIP: readonly string[] = ["in", "uk"]; // uk: ผู้ใช้ให้เอาออกจากรายงานก่อน 14 ต.ค. 69 (ยังเก็บผลในหน้า VIP)
const REPORT_VIP = VIP_MARKETS.filter((m) => !REPORT_SKIP_VIP.includes(m.code));


const status = (pick: string[] | null, digits: string[] | null): DaySummaryItem["status"] =>
  !digits || !pick ? "pending" : digits.includes(pick[0]) ? "star" : digits.includes(pick[1]) ? "second" : "miss";

/** หุ้นปกติ: แถวของวันนี้ (มีปิดแล้ว = ตัดสิน · ยังไม่ปิด = รอผล) */
export function regularSummary(stocks: (Stock & { records: Row[] })[], today: string, stake?: number): DaySummaryItem[] {
  return stocks.flatMap((s): DaySummaryItem[] => {
    const rec = s.records.find((r) => r.date.toISOString().slice(0, 10) === today);
    if (!rec) return [];
    const before = s.records.filter(hasClose).filter((r) => r.date < rec.date);
    const two = pickTwoFor(s.symbol, rec.openValue, rec.openChange, before, { date: rec.date, am: amDigitsFor(stocks, s.symbol) });
    // รอบบ่ายจีน/นิเคอิ: ฟันจากเลขรอบเช้าด้วย → ผลเช้ายังไม่เข้าระบบ = ยังไม่มีเลขจริง (ไม่โชว์เลข บอกว่ารออะไร)
    if (two.amWait && !hasClose(rec)) return [{ key: s.id, label: s.symbol, href: `/stocks/${s.id}`, pick: null, cost: betCost(2, 12, stake), status: "pending", wait: "รอผลรอบเช้าเข้าระบบ → บันทึกปิดรอบเช้าที่หน้าหุ้น" }];
    // ยึดเลขที่ล็อกไว้ (lockStockPicks) · ผลปิดแล้วแต่ไม่มีเลขล็อก = ก่อนเริ่มนับผลจริง → ไม่แสดง (ผู้ใช้ขอ 17 ต.ค. 69)
    const locked = lockedStockPick(rec);
    if (hasClose(rec) && !locked) return [];
    const pick = locked?.pick ?? two.digits.map((x) => x.digit);
    const drill = locked?.drill ?? two.drill.sets.map((x) => x.numbers.map((n) => n.number));
    if (!hasClose(rec)) return [{ key: s.id, label: s.symbol, href: `/stocks/${s.id}`, pick, drill, cost: betCost(pick.length, drill.flat().length, stake), status: "pending" }];
    const top = top2(rec.closeValue!), bottom = bottom2(rec.closeChange!);
    // เจาะมา = ตรง 2 ตัวบนหรือล่าง กลับได้ (กติกาเดียวกับหน้าหุ้น)
    const drillHits = drill.flat().filter((m) => drillHit(m, top, bottom));
    return [{ key: s.id, label: s.symbol, href: `/stocks/${s.id}`, pick, drill, drillHits, top, bottom, ...betResult(pick, drill.flat(), top, bottom, stake), status: status(pick, [...new Set(top + bottom)]) }];
  });
}

/**
 * หุ้น VIP: ทุกตลาด × ทุกรอบของวันนี้
 *   lock = true (ดูวันนี้): งวดที่ยังรอผลและยังไม่มีเลขล็อก → ล็อกเลขที่แสดงไว้ทันที (กติกาเดียวกับหน้า VIP: ล็อกครั้งเดียว ไม่เขียนทับ)
 *   เพื่อให้เลขที่ผู้ใช้เห็นใน report = เลขที่ใช้ตัดสินหลังผลออก แม้ไม่ได้เปิดหน้า VIP และแม้สูตรถูกแก้ทีหลัง (ผู้ใช้ย้ำ 13 ต.ค. 69)
 */
export async function vipSummary(userId: string, today: string, stake?: number, lock = false): Promise<DaySummaryItem[]> {
  const date = new Date(`${today}T00:00:00.000Z`);
  const rows = await prisma.vipResult.findMany({ where: { userId, date } });
  const out: DaySummaryItem[] = [];
  for (const m of REPORT_VIP) {
    for (const round of m.rounds) {
      const row = rows.find((r) => r.market === m.code && r.round === round);
      const label = m.rounds.length > 1 ? `${m.label} ${round === 1 ? "เช้า" : "บ่าย"}` : m.label;
      const done = !!row && row.top !== "";
      // ยังฟันไม่ได้จริง (งวดก่อนหน้ายังไม่มีผลในระบบ — รวมรอบบ่ายที่รอผลเช้า) → ไม่โชว์/ไม่ล็อกเลข บอกว่ารออะไร (กติกาเดียวกับหน้า VIP)
      if (!done && !row?.pick) {
        const prevKeys = await prisma.vipResult.findMany({ where: { userId, market: m.code, NOT: { top: "" }, date: { gte: new Date(date.getTime() - 86400000), lte: date } }, select: { date: true, round: true } });
        const wait = vipWaitReason(m.code, today, round, (d, r) => prevKeys.some((x) => x.date.toISOString().slice(0, 10) === d && x.round === r));
        if (wait) {
          out.push({ key: `${m.code}-${round}`, label, href: `/vip?market=${m.code}`, pick: null, cost: betCost(2, 12, stake), status: "pending", wait });
          continue;
        }
      }
      // ประวัติก่อนงวดนี้ → ใช้คำนวณเลขเจาะ (และเลขฟันถ้าไม่ได้ล็อกไว้) ด้วยสูตรของตลาดนั้น — แบบเดียวกับหน้า VIP
      const F = formulaFor(m.code);
      const hist = await prisma.vipResult.findMany({
        where: { userId, market: m.code, NOT: { top: "" }, OR: [{ date: { lt: date } }, { date, round: { lt: round } }] },
        orderBy: [{ date: "asc" }, { round: "asc" }],
      });
      const computed = F.pick(hist, row?.open ?? null, round);
      if (lock && !done && computed && !row?.pick) {
        const key = { userId_market_date_round: { userId, market: m.code, date, round } };
        const data = { pick: computed.digits.join("-"), drill: JSON.stringify(F.drill(computed, hist)) }; // ล็อกเลขฟัน + เลขเจาะพร้อมกัน
        await prisma.vipResult.upsert({ where: key, create: { userId, market: m.code, date, round, top: "", bottom: "", source: "web", ...data }, update: {} });
        await prisma.vipResult.updateMany({ where: { userId, market: m.code, date, round, pick: null }, data });
      }
      const lockedPick = row?.pick ?? (lock && !done && computed ? computed.digits.join("-") : null);
      const locked = lockedPick && (!F.lockedFrom || today >= F.lockedFrom) ? lockedPick.split("-") : null;
      // งวดที่ผลออกแล้วแต่ไม่มีเลขล็อก (ก่อนเริ่มใช้จริง) → ไม่แสดงในรายงาน — รายงานนับเฉพาะผลจริง (ผู้ใช้ขอ 17 ต.ค. 69)
      if (done && locked?.length !== 2) continue;
      const p = computed && locked?.length === 2 ? { ...computed, digits: [locked[0], locked[1]] as [string, string] } : computed;
      const pick = p?.digits ?? null;
      const drill = p ? (locked && lockedDrill(row?.drill)) || F.drill(p, hist) : null;
      const drillNums = drill?.map((x) => x.numbers);
      const drillHits = done && drillNums ? drillNums.flat().filter((d) => drillHit(d, row!.top, row!.bottom)) : undefined;
      out.push({
        key: `${m.code}-${round}`, label, href: `/vip?market=${m.code}`, pick, drill: drillNums, drillHits,
        ...(done ? { top: row!.top.slice(-2), bottom: row!.bottom } : {}),
        ...(pick && drillNums ? (done ? betResult(pick, drillNums.flat(), row!.top.slice(-2), row!.bottom, stake) : { cost: betCost(pick.length, drillNums.flat().length, stake) }) : {}),
        status: done ? status(pick, resultDigits(row!.top, row!.bottom)) : "pending",
      });
    }
  }
  return out;
}

export type MoneyTotal = { n: number; cost: number; win: number; profit: number };
const addTo = (t: MoneyTotal, r: { cost: number; win: number; profit: number }) => { t.n++; t.cost += r.cost; t.win += r.win; t.profit += r.profit; };

/** ผลรายตัว (หุ้น/ตลาด × รอบ) ของเดือน — ใช้ทำ dashboard */
export type MonthItem = MoneyTotal & {
  key: string; label: string; href: string; group: "ปกติ" | "VIP";
  star: number; any: number; drill: number;
  /** กำไรสะสมหลังแต่ละงวด (ไว้วาดกราฟเส้นเล็ก) */
  curve: number[];
};

/**
 * ผลรวมเงินของเดือน (วันที่ 1 ถึง `to`) — ทุกงวดที่ผลออกแล้ว · เลขฟัน/เจาะคิดแบบเดียวกับการ์ดรายวัน
 *   VIP โหลดประวัติตลาดละครั้งแล้วตัดตามงวด (ไม่ query ซ้ำทีละงวด) · คืนผลรายตัวด้วย (items)
 */
export async function monthMoney(userId: string, stocks: (Stock & { records: Row[] })[], to: string, stake?: number) {
  const from = `${to.slice(0, 7)}-01`;
  const inMonth = (d: Date) => { const s = d.toISOString().slice(0, 10); return s >= from && s <= to; };
  const regular: MoneyTotal = { n: 0, cost: 0, win: 0, profit: 0 }, vip: MoneyTotal = { n: 0, cost: 0, win: 0, profit: 0 };
  const days = new Set<string>(); // วันที่มีผลออก (ไว้บอกว่า "กี่วัน" แยกจาก "กี่งวด")
  const items: MonthItem[] = [];
  const item = (key: string, label: string, href: string, group: MonthItem["group"]): MonthItem => ({ key, label, href, group, n: 0, cost: 0, win: 0, profit: 0, star: 0, any: 0, drill: 0, curve: [] });
  /** บันทึกผล 1 งวดลงทั้งยอดรวมกลุ่มและรายตัว */
  const record = (total: MoneyTotal, it: MonthItem, pick: string[], drill: string[], top: string, bottom: string) => {
    const r = betResult(pick, drill, top, bottom, stake);
    addTo(total, r); addTo(it, r);
    const dg = [...new Set(top + bottom)];
    if (dg.includes(pick[0])) it.star++;
    if (pick.some((d) => dg.includes(d))) it.any++;
    if (drill.some((m) => drillHit(m, top, bottom))) it.drill++;
    it.curve.push(it.profit);
  };
  for (const s of stocks) {
    const closed = s.records.filter(hasClose);
    const it = item(s.id, s.symbol, `/stocks/${s.id}`, "ปกติ");
    closed.forEach((rec) => {
      if (!inMonth(rec.date)) return;
      // นับเฉพาะงวดที่มีเลขล็อกไว้ก่อนผลปิด = ผลจริง · ไม่มีล็อก → ไม่นับ ไม่คิดย้อนหลัง (ผู้ใช้ขอ 17 ต.ค. 69)
      const locked = lockedStockPick(rec);
      if (!locked) return;
      days.add(rec.date.toISOString().slice(0, 10));
      record(regular, it, locked.pick, locked.drill.flat(), top2(rec.closeValue!), bottom2(rec.closeChange!));
    });
    if (it.n) items.push(it);
  }
  for (const m of REPORT_VIP) {
    const F = formulaFor(m.code);
    const all = await prisma.vipResult.findMany({ where: { userId, market: m.code, NOT: { top: "" } }, orderBy: [{ date: "asc" }, { round: "asc" }] });
    const per = new Map(m.rounds.map((r) => [r, item(`${m.code}-${r}`, m.rounds.length > 1 ? `${m.label} ${r === 1 ? "เช้า" : "บ่าย"}` : m.label, `/vip?market=${m.code}`, "VIP")]));
    all.forEach((row, i) => {
      if (!inMonth(row.date)) return;
      const it = per.get(row.round as 1 | 2);
      if (!it) return;
      const hist = all.slice(0, i);
      // นับเฉพาะงวดที่มีเลขล็อกไว้ก่อนผลออก (เลขฟัน + เลขเจาะ) = ผลจริง · ไม่มีล็อก (ก่อนเริ่มใช้จริง) → ไม่นับ ไม่คิดย้อนหลัง (ผู้ใช้ขอ 17 ต.ค. 69)
      const locked = row.pick && (!F.lockedFrom || row.date.toISOString().slice(0, 10) >= F.lockedFrom) ? row.pick.split("-") : null;
      if (locked?.length !== 2) return;
      const digits: [string, string] = [locked[0], locked[1]];
      const drill = lockedDrill(row.drill) ?? (() => { const c = F.pick(hist, row.open, row.round); return c ? F.drill({ ...c, digits }, hist) : null; })();
      if (!drill) return;
      days.add(row.date.toISOString().slice(0, 10));
      record(vip, it, digits, drill.flatMap((x) => x.numbers), row.top.slice(-2), row.bottom);
    });
    for (const it of per.values()) if (it.n) items.push(it);
  }
  return { from, regular, vip, days: days.size, items };
}
