"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { CHINA_STOCKS, chinaDaily, chinaMorningCloses } from "@/lib/stocks/china";

export type ChinaSetupState = { error?: string; pm?: number; am?: number } | undefined;

const r2 = (x: number) => Math.round(x * 100) / 100;
const FROM = "2026-09-23"; // ผู้ใช้สั่งล้างของเก่าแล้วเริ่มเก็บใหม่ตั้งแต่วันนี้ (ข้อมูลย้อนหลังรอบเช้าสร้างจากแท่งกราฟ ไม่ใช่ค่าทางการ)

/**
 * เพิ่มหุ้น "CHINA เช้า" / "CHINA บ่าย" (ถ้ายังไม่มี) แล้วนำเข้าประวัติจาก Yahoo (399001.SZ) เฉพาะวันที่ยังไม่มี
 *   บ่าย = ปิดวัน 15:00 จีน · เช้า = แท่ง 1 ชม. 11:30 จีน (Yahoo ให้ ~60 วัน)
 *   ล่างของทั้งสองรอบเทียบกับปิดวันก่อน — ตรงกับที่ผลหวยใช้ (ตรวจแล้ว 18–21 ส.ค. 69)
 */
export async function setupChina(prev: ChinaSetupState): Promise<ChinaSetupState> {
  void prev;
  const { userId } = await requireUser();
  const daily = await chinaDaily("2y");
  if (daily.length < 10) return { error: "ดึงประวัติ SZSE Component จาก Yahoo ไม่ได้" };
  const am = await chinaMorningCloses("60d");
  const counts: { pm: number; am: number } = { pm: 0, am: 0 };
  for (const def of CHINA_STOCKS) {
    const session = def.symbol.includes("เช้า") ? "am" : "pm";
    const stock = await prisma.stock.upsert({ where: { userId_symbol: { userId, symbol: def.symbol } }, create: { userId, symbol: def.symbol, name: def.name }, update: {} });
    const have = new Set((await prisma.record.findMany({ where: { stockId: stock.id }, select: { date: true } })).map((r) => r.date.toISOString().slice(0, 10)));
    // ปิดงวดก่อนที่บันทึกไว้เอง เชื่อถือได้กว่า Yahoo (Yahoo รายวันมีวันหาย เช่น 22 ก.ย. 69 ของ SZSE)
    const recorded = new Map((await prisma.record.findMany({ where: { stockId: stock.id, closeValue: { not: null } }, select: { date: true, closeValue: true } })).map((r) => [r.date.toISOString().slice(0, 10), r.closeValue!]));
    const rows = [];
    for (let i = 1; i < daily.length; i++) {
      const d = daily[i], prevClose = recorded.get(daily[i - 1].date) ?? daily[i - 1].close;
      if (d.date < FROM || have.has(d.date)) continue;
      const close = session === "pm" ? d.close : am[d.date];
      if (close === undefined) continue;
      rows.push({ stockId: stock.id, date: new Date(`${d.date}T00:00:00.000Z`), openValue: d.open, openChange: r2(d.open - prevClose), closeValue: close, closeChange: r2(close - prevClose) });
    }
    if (rows.length) await prisma.record.createMany({ data: rows });
    counts[session] = rows.length;
  }
  revalidatePath("/stocks"); revalidatePath("/dashboard");
  return counts;
}
