"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SINGAPORE_STOCK, singaporeDaily, fetchSingaporeQuote } from "@/lib/stocks/singapore";

export type SingaporeSetupState = { error?: string; added?: number } | undefined;

const r2 = (x: number) => Math.round(x * 100) / 100;
/** เก็บย้อนหลัง 50 วันทำการ — พอให้สถิติบนหน้าดูได้ แต่ไม่หนักเครื่อง (แบบเดียวกับฮั่งเส็ง) */
const KEEP_DAYS = 50;

/**
 * เพิ่มหุ้น "SGX" (ถ้ายังไม่มี) แล้วนำเข้าวันที่ขาดใน 50 วันทำการล่าสุดจาก Yahoo (^STI)
 *   ผล = ปิดทางการ (แบบ investing) · ล่างเทียบปิดวันก่อน · เปิด = เปิดของวันจาก Yahoo
 */
export async function setupSingapore(prev: SingaporeSetupState): Promise<SingaporeSetupState> {
  void prev;
  const { userId } = await requireUser();
  const daily = await singaporeDaily("6mo");
  if (daily.length < 10) return { error: "ดึงประวัติ Straits Times Index จาก Yahoo ไม่ได้" };
  const FROM = daily[Math.max(1, daily.length - KEEP_DAYS)].date;
  const stock = await prisma.stock.upsert({ where: { userId_symbol: { userId, symbol: SINGAPORE_STOCK.symbol } }, create: { userId, symbol: SINGAPORE_STOCK.symbol, name: SINGAPORE_STOCK.name }, update: {} });
  const have = new Set((await prisma.record.findMany({ where: { stockId: stock.id }, select: { date: true } })).map((r) => r.date.toISOString().slice(0, 10)));
  const rows = [];
  for (let i = 1; i < daily.length; i++) {
    const d = daily[i], prevClose = daily[i - 1].close;
    if (d.date < FROM || have.has(d.date)) continue;
    rows.push({ stockId: stock.id, date: new Date(`${d.date}T00:00:00.000Z`), openValue: d.open, openChange: r2(d.open - prevClose), closeValue: d.close, closeChange: r2(d.close - prevClose) });
    have.add(d.date);
  }
  // Yahoo มักยังไม่ออกแท่งรายวันของวันล่าสุดหลังตลาดปิด → เติมงวดนั้นจากแท่งนาที (ราคาประมูลปิด) ถ้าปิดแล้ว
  const q = await fetchSingaporeQuote();
  if (q?.closed && !have.has(q.tradingDate) && q.tradingDate > daily[daily.length - 1].date) {
    rows.push({ stockId: stock.id, date: new Date(`${q.tradingDate}T00:00:00.000Z`), openValue: q.open, openChange: r2(q.open - q.prevClose), closeValue: q.last, closeChange: r2(q.last - q.prevClose) });
  }
  if (rows.length) await prisma.record.createMany({ data: rows });
  revalidatePath("/stocks"); revalidatePath("/dashboard"); revalidatePath("/summary");
  return { added: rows.length };
}
