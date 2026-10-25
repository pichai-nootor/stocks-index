import { prisma } from "@/lib/prisma";
import { flowSlotOf, resultOf, systemGuess, nextGuessDate, guessLocked, FLOW_ROUNDS, SYS_SLOTS, type FlowResult, type FlowSlot } from "@/lib/flow";

const ORDER = new Map(FLOW_ROUNDS.map((r, i) => [r.slot, i]));
type StockRows = { symbol: string; records: { date: Date; closeValue: number | null; closeChange: number | null }[] }[];

/** ผลจริงของผู้ใช้ → วัน → รอบ (เรียงตามเวลา) */
export function flowDays(stocks: StockRows) {
  const byDay = new Map<string, FlowResult[]>();
  for (const s of stocks) {
    const slot = flowSlotOf(s.symbol);
    if (!slot) continue;
    for (const r of s.records) {
      if (r.closeValue === null || r.closeChange === null) continue;
      const d = r.date.toISOString().slice(0, 10);
      const l = byDay.get(d) ?? [];
      if (!l.some((x) => x.slot === slot)) l.push(resultOf(slot, r.closeValue, r.closeChange));
      byDay.set(d, l);
    }
  }
  for (const l of byDay.values()) l.sort((a, b) => ORDER.get(a.slot)! - ORDER.get(b.slot)!);
  return byDay;
}

/** วัน → รอบที่ "เปิด" (มีแถวข้อมูลเปิดแล้ว ปิดยังไม่ต้องมี) · ไม่มีแถว = วันนั้นตลาดนั้นปิด (ผู้ใช้ 23 ต.ค. 69) */
export function openedSlots(stocks: StockRows) {
  const m = new Map<string, Set<FlowSlot>>();
  for (const s of stocks) {
    const slot = flowSlotOf(s.symbol);
    if (slot) for (const r of s.records) { const d = r.date.toISOString().slice(0, 10); m.set(d, (m.get(d) ?? new Set()).add(slot)); }
  }
  return m;
}

/** วันทำการถัดไปที่ยังไม่ล็อก (ข้ามเสาร์–อาทิตย์) */
export function nextFlowDate(now = new Date()) {
  let d = nextGuessDate(now);
  while ([0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return d;
}

/**
 * ล็อกเลขไหลของระบบสำหรับวันทำการถัดไป — สร้างครั้งเดียว ไม่เขียนทับ และต้องก่อน 09:30 ของวันนั้น (เหมือนเลขฟันที่ล็อก)
 *   ใช้ผลของวันล่าสุดก่อนหน้า · ครบ = หลัง 16:00 ไทยของวันนั้น (ทุกตลาดเปิดแล้ว อียิปต์เปิด ~15:00) และรอบปิดวันทุกตัวที่มีข้อมูลเปิด มีผลปิดแล้ว
 *   ตัวไหนไม่มีข้อมูลเปิด = วันนั้นปิด ไม่ต้องรอ (ผู้ใช้ 23 ต.ค. 69)
 *   force = ผู้ใช้กด "วิเคราะห์เลย": ไม่รอ ใช้ผลที่มีตอนนี้ (ยังต้อง ≥4 รอบปิดวัน และก่อน 09:30 · ล็อกแล้วไม่เขียนทับ)
 */
export async function lockFlowSystem(userId: string, byDay: Map<string, FlowResult[]>, opened: Map<string, Set<FlowSlot>>, now = new Date(), force = false) {
  const date = nextFlowDate(now);
  if (guessLocked(date, now)) return null;
  const prevDate = [...byDay.keys()].filter((d) => d < date).sort().at(-1);
  const prev = prevDate ? byDay.get(prevDate)! : null;
  const g = prev && systemGuess(prev);
  // ยังรอ: ก่อน 16:00 ไทย หรือมีตัวที่เปิดแล้ว (มีข้อมูลเปิด) แต่ผลปิดยังไม่มา
  const pending = prev ? SYS_SLOTS.filter((x) => opened.get(prevDate!)?.has(x) && !prev.some((r) => r.slot === x)) : [];
  const wait = !force && !!prev && (now < new Date(`${prevDate}T09:00:00.000Z`) || pending.length > 0);
  if (!g || wait) return { date, prevDate, ready: false as const, canForce: !!g };
  for (const x of g) {
    if (x.digits.length < 2) continue;
    await prisma.flowGuess.upsert({ where: { userId_date_method: { userId, date, method: x.method } }, create: { userId, date, method: x.method, digits: x.digits.join("") }, update: {} });
  }
  return { date, prevDate, ready: true as const, why: g[0].why };
}
