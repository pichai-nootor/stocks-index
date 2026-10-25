"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { guessLocked, SYS_METHOD } from "@/lib/flow";
import { flowDays, openedSlots, lockFlowSystem } from "@/lib/flow-lock";

export type FlowGuessState = { error?: string; saved?: string } | undefined;

/** บันทึกเลขไหลที่ทาย (2 ตัวต่างกัน) — ทับของวิธีเดิมวันเดิมได้จนถึงรอบแรก 09:30 แล้วล็อก */
export async function saveFlowGuess(prev: FlowGuessState, form: FormData): Promise<FlowGuessState> {
  void prev;
  const { userId } = await requireUser();
  const date = String(form.get("date") ?? "");
  const method = String(form.get("method") ?? "").trim().slice(0, 40) || "คิดเอง";
  const digits = [...new Set(String(form.get("digits") ?? "").replace(/\D/g, "").split(""))];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "วันที่ไม่ถูกต้อง" };
  if (method.startsWith(SYS_METHOD)) return { error: `ชื่อวิธี "${SYS_METHOD}" สงวนไว้ให้เลขที่ระบบคิด — ตั้งชื่ออื่น` };
  if (digits.length !== 2) return { error: "ใส่เลข 2 ตัวที่ไม่ซ้ำกัน เช่น 34" };
  if (guessLocked(date)) return { error: "วันนี้รอบแรกออกแล้ว (09:30) — ล็อกแล้ว ทายวันถัดไปได้" };
  const d = digits.sort().join("");
  await prisma.flowGuess.upsert({ where: { userId_date_method: { userId, date, method } }, create: { userId, date, method, digits: d }, update: { digits: d } });
  revalidatePath("/flow");
  return { saved: `${method}: ${d.split("").join(" ")} (${date})` };
}

/** ลบเลขทาย — ได้เฉพาะก่อนล็อก */
export async function deleteFlowGuess(form: FormData) {
  const { userId } = await requireUser();
  const id = String(form.get("id") ?? "");
  const g = await prisma.flowGuess.findFirst({ where: { id, userId } });
  if (g && !g.method.startsWith(SYS_METHOD) && !guessLocked(g.date)) await prisma.flowGuess.delete({ where: { id } });
  revalidatePath("/flow");
}

export type AnalyzeState = { msg?: string; error?: string } | undefined;
/** ปุ่ม "วิเคราะห์เลย": คิด + ล็อกเลขไหลของระบบจากผลที่มีตอนนี้ ไม่รอ (บางวันบางตลาดปิด) · ล็อกแล้วไม่เขียนทับ → บอกเลขที่ล็อกไว้ */
export async function analyzeFlowNow(prev: AnalyzeState): Promise<AnalyzeState> {
  void prev;
  const { userId } = await requireUser();
  const stocks = await prisma.stock.findMany({ where: { userId }, include: { records: true } });
  const r = await lockFlowSystem(userId, flowDays(stocks), openedSlots(stocks), new Date(), true);
  revalidatePath("/flow"); revalidatePath("/summary");
  if (!r) return { error: "ตอนนี้ยังคิดไม่ได้ ลองใหม่อีกครั้ง" };
  if (!r.ready) return { error: `ผลของวันที่ ${r.prevDate ?? "ก่อนหน้า"} มีรอบปิดวันไม่ถึง 4 ตลาด — รอผลออกก่อน` };
  const g = await prisma.flowGuess.findUnique({ where: { userId_date_method: { userId, date: r.date, method: SYS_METHOD } } });
  return { msg: `เลขไหลของ ${r.date}: ${g?.digits.split("").join(" ")} (ล็อกแล้ว)` };
}
