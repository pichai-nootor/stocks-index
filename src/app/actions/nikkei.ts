"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NIKKEI_STOCKS, nikkeiDaily, nikkeiMorningCloses } from "@/lib/stocks/nikkei";

export type NikkeiSetupState = { error?: string; pm?: number; am?: number } | undefined;

const r2 = (x: number) => Math.round(x * 100) / 100;
const dateOnly = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
/** ผู้ใช้สั่งล้างข้อมูลเก่าแล้วเริ่มเก็บใหม่ตั้งแต่ 23 ก.ย. 69 (ข้อมูลรอบเช้าที่สร้างจากแท่งกราฟย้อนหลังไม่น่าไว้ใจ) */
const FROM = "2026-09-23";

/**
 * เพิ่มหุ้น "NIKKEI เช้า" / "NIKKEI บ่าย" (ถ้ายังไม่มี) แล้วนำเข้าประวัติจาก Yahoo:
 *   บ่าย = ปิดวัน 10 ปี · เช้า = ปิดภาคเช้า 11:30 JST เท่าที่ Yahoo ให้ (~60 วัน) — เฉพาะวันที่ยังไม่มีในระบบ
 */
export async function setupNikkei(prev: NikkeiSetupState): Promise<NikkeiSetupState> {
  void prev;
  const { userId } = await requireUser();
  const daily = await nikkeiDaily("10y");
  if (daily.length < 10) return { error: "ดึงประวัติ Nikkei 225 จาก Yahoo ไม่ได้" };
  const am = await nikkeiMorningCloses("60d");
  const counts = { pm: 0, am: 0 };
  for (const def of NIKKEI_STOCKS) {
    const stock = await prisma.stock.upsert({ where: { userId_symbol: { userId, symbol: def.symbol } }, create: { userId, symbol: def.symbol, name: def.name }, update: {} });
    const have = new Set((await prisma.record.findMany({ where: { stockId: stock.id }, select: { date: true } })).map((r) => r.date.toISOString().slice(0, 10)));
    const session = def.symbol.includes("เช้า") ? "am" : "pm";
    const rows: { stockId: string; date: Date; openValue: number; openChange: number; closeValue: number; closeChange: number }[] = [];
    for (let i = 1; i < daily.length; i++) {
      const d = daily[i], prev = daily[i - 1].close;
      if (d.date < FROM || have.has(d.date)) continue;
      const close = session === "pm" ? d.close : am[d.date];
      if (close === undefined) continue;
      rows.push({ stockId: stock.id, date: dateOnly(d.date), openValue: d.open, openChange: r2(d.open - prev), closeValue: close, closeChange: r2(close - prev) });
    }
    if (rows.length) await prisma.record.createMany({ data: rows });
    counts[session] = rows.length;
  }
  revalidatePath("/stocks"); revalidatePath("/dashboard"); revalidatePath("/digits");
  return counts;
}
