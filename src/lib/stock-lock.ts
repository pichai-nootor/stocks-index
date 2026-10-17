/**
 * ล็อกเลขฟัน + เลขเจาะของหุ้นปกติ (ผู้ใช้แทงจริงตั้งแต่ ต.ค. 69) — กติกาเดียวกับ VIP: ล็อกครั้งเดียวตอนโชว์ก่อนผลปิด ไม่เขียนทับ
 *   รายงานนับเฉพาะงวดที่มีเลขล็อก → ผลจริง ไม่เปลี่ยนตามสูตรที่แก้ทีหลัง
 *   แก้ราคาเปิดก่อนผลปิด → actions/stocks.ts ล้างเลขล็อก แล้วล็อกใหม่ตอนโชว์ครั้งถัดไป
 */
import type { Record as Row, Stock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasClose } from "@/lib/stats";
import { pickTwoFor, amDigitsFor } from "@/lib/formulas/stocks";

/** เลขที่ล็อกของแถวนี้ (ไม่มี/ไม่ครบ → null) */
export function lockedStockPick(r: Pick<Row, "pick" | "drill">): { pick: [string, string]; drill: string[][] } | null {
  const p = r.pick?.split("-");
  if (p?.length !== 2 || !r.drill) return null;
  try {
    const d = JSON.parse(r.drill) as string[][];
    return Array.isArray(d) ? { pick: [p[0], p[1]], drill: d } : null;
  } catch {
    return null;
  }
}

/** ล็อกทุกแถวที่ยังรอผลปิดและยังไม่มีเลขล็อก (รอบบ่ายที่ยังรอผลเช้า = ยังไม่ใช่เลขจริง ไม่ล็อก) · แก้ stocks ในที่ด้วย ให้หน้าที่เรียกเห็นเลขล็อกทันที */
export async function lockStockPicks(stocks: (Stock & { records: Row[] })[]): Promise<void> {
  for (const s of stocks) {
    const am = amDigitsFor(stocks, s.symbol);
    for (const r of s.records) {
      if (hasClose(r) || r.pick) continue;
      const before = s.records.filter(hasClose).filter((x) => x.date < r.date);
      const two = pickTwoFor(s.symbol, r.openValue, r.openChange, before, { date: r.date, am });
      if (two.amWait) continue;
      const data = { pick: two.digits.map((x) => x.digit).join("-"), drill: JSON.stringify(two.drill.sets.map((x) => x.numbers.map((n) => n.number))) };
      const n = await prisma.record.updateMany({ where: { id: r.id, pick: null }, data });
      if (n.count) Object.assign(r, data);
    }
  }
}

/** ล็อกของหุ้นทุกตัวของผู้ใช้ (หน้าที่โหลดหุ้นตัวเดียว — รอบบ่ายต้องใช้ผลเช้าจากอีกตัว) */
export async function lockUserStockPicks(userId: string): Promise<void> {
  const pending = await prisma.record.count({ where: { stock: { userId }, closeValue: null, pick: null } });
  if (!pending) return;
  await lockStockPicks(await prisma.stock.findMany({ where: { userId }, include: { records: { orderBy: { date: "asc" } } } }));
}
