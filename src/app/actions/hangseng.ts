"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { HANGSENG_STOCKS, hangSengDaily, hangSengResults } from "@/lib/stocks/hangseng";

export type HangSengSetupState = { error?: string; pm?: number; am?: number } | undefined;

const r2 = (x: number) => Math.round(x * 100) / 100;
/** เก็บย้อนหลังแค่ 50 วันทำการ — พอให้สถิติบนหน้าดูได้ แต่ไม่หนักเครื่อง (ผู้ใช้ขอ 12 ต.ค. 69) */
const KEEP_DAYS = 50;

/**
 * เพิ่มหุ้น "HSI เช้า" / "HSI บ่าย" (ถ้ายังไม่มี) แล้วนำเข้าวันที่ขาดใน 50 วันทำการล่าสุดจาก Yahoo (^HSI)
 *   ผล = ราคา 12:00 / 16:00 ฮ่องกง · ล่างเทียบปิดทางการวันก่อน (ปิดรายวันของ Yahoo)
 */
export async function setupHangSeng(prev: HangSengSetupState): Promise<HangSengSetupState> {
  void prev;
  const { userId } = await requireUser();
  const daily = await hangSengDaily("3mo");
  if (daily.length < 10) return { error: "ดึงประวัติ Hang Seng Index จาก Yahoo ไม่ได้" };
  const FROM = daily[Math.max(1, daily.length - KEEP_DAYS)].date;
  const counts: { pm: number; am: number } = { pm: 0, am: 0 };
  for (const def of HANGSENG_STOCKS) {
    const session = def.symbol.includes("เช้า") ? "am" : "pm";
    const results = await hangSengResults(session);
    const stock = await prisma.stock.upsert({ where: { userId_symbol: { userId, symbol: def.symbol } }, create: { userId, symbol: def.symbol, name: def.name }, update: {} });
    const have = new Set((await prisma.record.findMany({ where: { stockId: stock.id }, select: { date: true } })).map((r) => r.date.toISOString().slice(0, 10)));
    const rows = [];
    for (let i = 1; i < daily.length; i++) {
      const d = daily[i], prevClose = daily[i - 1].close; // ปิดทางการ ไม่ใช่ราคา 16:00 ที่เก็บเป็นผล
      const close = results[d.date];
      if (d.date < FROM || have.has(d.date) || close === undefined) continue;
      rows.push({ stockId: stock.id, date: new Date(`${d.date}T00:00:00.000Z`), openValue: d.open, openChange: r2(d.open - prevClose), closeValue: close, closeChange: r2(close - prevClose) });
    }
    if (rows.length) await prisma.record.createMany({ data: rows });
    counts[session] = rows.length;
  }
  revalidatePath("/stocks"); revalidatePath("/dashboard");
  return counts;
}
