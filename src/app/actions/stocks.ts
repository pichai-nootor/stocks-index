"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "./auth";
import { parseInvestingCsv } from "@/lib/csv-import";
import { checkOpen, fmtNum, fmtChange } from "@/lib/stats";

const stockSchema = z.object({
  symbol: z.string().trim().min(1, "กรุณาระบุชื่อหุ้น").toUpperCase(),
  name: z.string().trim().optional(),
});

export async function createStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = stockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const exists = await prisma.stock.findUnique({
    where: { userId_symbol: { userId, symbol: parsed.data.symbol } },
  });
  if (exists) return { error: `มีหุ้น ${parsed.data.symbol} อยู่แล้ว` };

  await prisma.stock.create({
    data: { userId, symbol: parsed.data.symbol, name: parsed.data.name || null },
  });
  revalidatePath("/stocks");
  revalidatePath("/dashboard");
  return undefined;
}

export async function deleteStock(formData: FormData) {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await prisma.stock.deleteMany({ where: { id, userId } });
  revalidatePath("/stocks");
  revalidatePath("/dashboard");
  redirect("/stocks");
}

const recordSchema = z.object({
  stockId: z.string().min(1),
  date: z.string().min(1, "กรุณาระบุวันที่"),
  openValue: z.coerce.number({ message: "ค่าเปิดต้องเป็นตัวเลข" }).positive("ค่าเปิดต้องมากกว่า 0"),
  openChange: z.coerce.number({ message: "เปลี่ยนแปลงตอนเปิดต้องเป็นตัวเลข" }),
  note: z.string().trim().optional(),
});

/** ผลของฟอร์มกรอกเปิด: ถ้า mismatch จะมีค่าที่แนะนำให้ผู้ใช้เลือกใช้หรือยืนยันบันทึกตามเดิม */
export type OpenState =
  | { error?: string; mismatch?: { suggestedOpenChange: number; lastClose: number; lastCloseDate: string; impliedPrevClose: number } }
  | undefined;

/**
 * เปิด − เปลี่ยนแปลง ต้องเท่ากับปิดล่าสุดก่อนวันนั้น ไม่งั้น D ผิดและฟันเลขผิดทั้งวัน
 * ผู้ใช้ยืนยันบันทึกตามที่กรอกได้ (force=1) กรณีมีวันที่ยังไม่ได้บันทึกก่อนหน้า
 */
async function verifyOpen(stockId: string, date: Date, openValue: number, openChange: number, formData: FormData): Promise<OpenState> {
  if (formData.get("force") === "1") return undefined;
  const closed = await prisma.record.findMany({ where: { stockId, date: { lt: date }, closeValue: { not: null } }, select: { date: true, closeValue: true } });
  const c = checkOpen(closed, date, openValue, openChange);
  if (!c.mismatch || !c.lastClose || c.suggestedOpenChange === null) return undefined;
  const lastDate = c.lastClose.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  return {
    error: `เปิด − เปลี่ยนแปลง = ${fmtNum(c.impliedPrevClose)} แต่ปิดล่าสุดที่บันทึกไว้ (${lastDate}) = ${fmtNum(c.lastClose.closeValue)} → เปลี่ยนแปลงตอนเปิดควรเป็น ${fmtChange(c.suggestedOpenChange)}`,
    mismatch: { suggestedOpenChange: c.suggestedOpenChange, lastClose: c.lastClose.closeValue, lastCloseDate: lastDate, impliedPrevClose: c.impliedPrevClose },
  };
}

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const closeSchema = z.object({
  id: z.string().min(1),
  closeValue: z.preprocess(emptyToUndef, z.coerce.number({ message: "ค่าปิดต้องเป็นตัวเลข" }).positive("ค่าปิดต้องมากกว่า 0")),
  closeChange: z.preprocess(emptyToUndef, z.coerce.number({ message: "เปลี่ยนแปลงตอนปิดต้องเป็นตัวเลข" })),
});

export async function createRecord(_prev: OpenState, formData: FormData): Promise<OpenState> {
  const { userId } = await requireUser();
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { stockId, date, openValue, openChange, note } = parsed.data;
  const stock = await prisma.stock.findFirst({ where: { id: stockId, userId } });
  if (!stock) return { error: "ไม่พบหุ้น" };

  const dup = await prisma.record.findFirst({ where: { stockId, date: new Date(date) } });
  if (dup) return { error: "วันนี้บันทึกไปแล้ว — เติมค่าปิดได้ในตารางประวัติ" };
  const bad = await verifyOpen(stockId, new Date(date), openValue, openChange, formData);
  if (bad) return bad;

  await prisma.record.create({
    data: { stockId, date: new Date(date), openValue, openChange, note: note || null },
  });
  revalidatePath(`/stocks/${stockId}`);
  revalidatePath("/dashboard");
  revalidatePath("/predict");
  return undefined;
}

/** หน้าวิเคราะห์: บันทึกเลขเปิดของวัน (ถ้ามีอยู่แล้วและยังไม่ปิด → อัปเดต) แล้วพาไปดูฟันธง */
export async function saveOpenAndForecast(_prev: OpenState, formData: FormData): Promise<OpenState> {
  const { userId } = await requireUser();
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { stockId, date, openValue, openChange } = parsed.data;
  const stock = await prisma.stock.findFirst({ where: { id: stockId, userId } });
  if (!stock) return { error: "ไม่พบหุ้น" };

  const existing = await prisma.record.findFirst({ where: { stockId, date: new Date(date) } });
  if (existing && existing.closeValue !== null) {
    return { error: "วันนี้มีผลปิดแล้ว — แก้ไขได้จากหน้าหุ้น" };
  }
  const bad = await verifyOpen(stockId, new Date(date), openValue, openChange, formData);
  if (bad) return bad;
  if (existing) {
    await prisma.record.update({ where: { id: existing.id }, data: { openValue, openChange } });
  } else {
    await prisma.record.create({ data: { stockId, date: new Date(date), openValue, openChange } });
  }
  revalidatePath(`/stocks/${stockId}`);
  revalidatePath("/digits");
  revalidatePath("/dashboard");
  if (formData.get("redirectTo") === "dashboard") redirect("/dashboard?saved=1");
  redirect(`/digits?stock=${stockId}&date=${date}&openValue=${openValue}&openChange=${openChange}&saved=1`);
}

/** เติมค่าปิดให้วันที่บันทึกเปิดไว้แล้ว */
export async function fillClose(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = closeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { id, closeValue, closeChange } = parsed.data;
  const record = await prisma.record.findFirst({ where: { id, stock: { userId } }, select: { stockId: true } });
  if (!record) return { error: "ไม่พบรายการ" };

  await prisma.record.update({ where: { id }, data: { closeValue, closeChange } });
  revalidatePath(`/stocks/${record.stockId}`);
  revalidatePath("/dashboard");
  revalidatePath("/predict");
  revalidatePath("/digits");
  return undefined;
}

export async function deleteRecord(formData: FormData) {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const record = await prisma.record.findFirst({
    where: { id, stock: { userId } },
    select: { stockId: true },
  });
  if (!record) return;
  await prisma.record.delete({ where: { id } });
  revalidatePath(`/stocks/${record.stockId}`);
  revalidatePath("/dashboard");
  revalidatePath("/predict");
}

export type ImportState = { error?: string; imported?: number; skipped?: number; duplicates?: number } | undefined;

/** นำเข้า CSV ประวัติราคา (Investing.com) เข้าหุ้นที่เลือก — ข้ามวันที่ที่มีอยู่แล้ว */
export async function importCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { userId } = await requireUser();
  const stockId = String(formData.get("stockId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์ CSV" };
  if (file.size > 2_000_000) return { error: "ไฟล์ใหญ่เกิน 2MB" };

  const stock = await prisma.stock.findFirst({ where: { id: stockId, userId } });
  if (!stock) return { error: "ไม่พบหุ้น" };

  const { rows, skipped, error } = parseInvestingCsv(await file.text());
  if (error) return { error };
  if (!rows.length) return { error: "ไม่มีแถวที่นำเข้าได้" };

  const existing = new Set(
    (await prisma.record.findMany({ where: { stockId }, select: { date: true } })).map((r) => r.date.getTime()),
  );
  const fresh = rows.filter((r) => !existing.has(r.date.getTime()));
  if (fresh.length) {
    await prisma.record.createMany({ data: fresh.map((r) => ({ stockId, ...r })) });
  }
  revalidatePath(`/stocks/${stockId}`);
  revalidatePath("/dashboard");
  revalidatePath("/digits");
  revalidatePath("/predict");
  return { imported: fresh.length, skipped, duplicates: rows.length - fresh.length };
}

/* ---------- ดึงจาก Yahoo: เปิด / ปิด / ราคาสด ---------- */

import { fetchQuote } from "@/lib/yahoo";
import { istMinutes, CALL_DEADLINE_IST, CALL_DEADLINE_THAI } from "@/lib/intraday";

const dateOnly = (ymd: string) => new Date(ymd);

/** เช้า: ดึงค่าเปิดวันซื้อขายล่าสุดจาก Yahoo แล้วบันทึก (ไม่มีปัญหากรอกผิด) */
export async function saveOpenFromYahoo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const stockId = String(formData.get("stockId") ?? "");
  const stock = await prisma.stock.findFirst({ where: { id: stockId, userId } });
  if (!stock) return { error: "ไม่พบหุ้น" };
  const q = await fetchQuote(stock.symbol);
  if (!q) return { error: `ดึงราคา ${stock.symbol} จาก Yahoo ไม่ได้ (ไม่รู้จักสัญลักษณ์ หรือเชื่อมต่อไม่ได้) — กรอกเองด้านล่าง` };
  const date = dateOnly(q.tradingDate);
  const openChange = Math.round((q.open - q.prevClose) * 100) / 100;
  const existing = await prisma.record.findFirst({ where: { stockId, date } });
  if (existing?.closeValue !== null && existing?.closeValue !== undefined) return { error: `วันที่ ${q.tradingDate} มีผลปิดแล้ว` };
  if (existing) await prisma.record.update({ where: { id: existing.id }, data: { openValue: q.open, openChange } });
  else await prisma.record.create({ data: { stockId, date, openValue: q.open, openChange } });
  revalidatePath("/dashboard"); revalidatePath("/digits"); revalidatePath(`/stocks/${stockId}`);
  redirect("/dashboard?saved=1");
}

/** ระหว่างวัน: อ่านราคาสดจาก Yahoo แล้วบันทึกเป็นจุดฟันสดของวัน (ครั้งเดียว — กดซ้ำ = อัปเดตจนกว่าจะมีปิด) */
export async function saveLiveFromYahoo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const record = await prisma.record.findFirst({ where: { id, stock: { userId } }, include: { stock: true } });
  if (!record) return { error: "ไม่พบรายการ" };
  if (record.closeValue !== null) return { error: "วันนี้มีผลปิดแล้ว" };
  const q = await fetchQuote(record.stock.symbol);
  if (!q) return { error: "ดึงราคาสดไม่ได้" };
  if (q.tradingDate !== record.date.toISOString().slice(0, 10)) return { error: `แหล่งราคายังอยู่ที่วัน ${q.tradingDate} — ตลาดยังไม่เปิดสำหรับวันนี้` };
  if (q.closed) return { error: "ตลาดปิดแล้ว — กด “เติมราคาปิดอัตโนมัติ” แทน" };
  // หลังเส้นตายห้ามทับคำฟันเดิม ไม่งั้นราคาใกล้ปิดจะทำให้ "ถูก" แบบไม่ยุติธรรม
  if (istMinutes(q.lastAt) > CALL_DEADLINE_IST) return { error: `เลยเส้นตาย ${CALL_DEADLINE_THAI} น. แล้ว — คำฟันที่บันทึกไว้ก่อนหน้าคงเดิม` };
  await prisma.record.update({ where: { id }, data: { liveValue: q.last, liveAt: q.lastAt } });
  revalidatePath("/dashboard"); revalidatePath(`/stocks/${record.stockId}`);
  return undefined;
}

/** เย็น: เติมค่าปิดของวันจาก Yahoo */
export async function fillCloseFromYahoo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const record = await prisma.record.findFirst({ where: { id, stock: { userId } }, include: { stock: true } });
  if (!record) return { error: "ไม่พบรายการ" };
  const q = await fetchQuote(record.stock.symbol);
  if (!q) return { error: "ดึงราคาจาก Yahoo ไม่ได้" };
  if (q.tradingDate !== record.date.toISOString().slice(0, 10)) return { error: `Yahoo มีข้อมูลถึงวัน ${q.tradingDate} ไม่ตรงกับรายการนี้` };
  if (!q.closed) return { error: `ตลาดยังไม่ปิด (ล่าสุด ${q.last.toFixed(2)}) — รอหลัง 17:00 น. ไทย` };
  const prev = record.openValue - record.openChange;
  await prisma.record.update({ where: { id }, data: { closeValue: q.last, closeChange: Math.round((q.last - prev) * 100) / 100 } });
  revalidatePath("/dashboard"); revalidatePath("/digits"); revalidatePath("/calendar"); revalidatePath(`/stocks/${record.stockId}`);
  return undefined;
}

const liveManualSchema = z.object({
  id: z.string().min(1),
  price: z.coerce.number({ message: "ราคาต้องเป็นตัวเลข" }).positive("ราคาต้องมากกว่า 0"),
});

/** ระหว่างวัน: กรอกราคาที่เห็นจากหน้าจอจริง (Yahoo ดีเลย์ ~15 นาที) → บันทึกเป็นจุดฟันสด ณ เวลานี้ */
export async function saveLiveManual(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = liveManualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, price } = parsed.data;
  const record = await prisma.record.findFirst({ where: { id, stock: { userId } } });
  if (!record) return { error: "ไม่พบรายการ" };
  if (record.closeValue !== null) return { error: "วันนี้มีผลปิดแล้ว" };
  const prev = record.openValue - record.openChange;
  if (Math.abs(price - prev) / prev > 0.1) return { error: `ราคา ${price} ห่างจากปิดเมื่อวาน ${prev.toFixed(2)} เกิน 10% — พิมพ์ผิดหรือเปล่า` };
  if (istMinutes(new Date()) > CALL_DEADLINE_IST) return { error: `เลยเส้นตาย ${CALL_DEADLINE_THAI} น. แล้ว — คำฟันที่บันทึกไว้ก่อนหน้าคงเดิม` };
  await prisma.record.update({ where: { id }, data: { liveValue: price, liveAt: new Date() } });
  revalidatePath("/dashboard"); revalidatePath(`/stocks/${record.stockId}`);
  return undefined;
}

const editSchema = z.object({
  id: z.string().min(1),
  openValue: z.coerce.number({ message: "ค่าเปิดต้องเป็นตัวเลข" }).positive("ค่าเปิดต้องมากกว่า 0"),
  openChange: z.coerce.number({ message: "เปลี่ยนแปลงตอนเปิดต้องเป็นตัวเลข" }),
  closeValue: z.preprocess(emptyToUndef, z.coerce.number({ message: "ค่าปิดต้องเป็นตัวเลข" }).positive("ค่าปิดต้องมากกว่า 0").optional()),
  closeChange: z.preprocess(emptyToUndef, z.coerce.number({ message: "เปลี่ยนแปลงตอนปิดต้องเป็นตัวเลข" }).optional()),
});

/** แก้ไขตัวเลขของวันที่บันทึกไว้แล้ว (เปิด และ/หรือ ปิด) — เว้นช่องปิดว่างทั้งคู่ = ยังไม่มีปิด */
export async function updateRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, openValue, openChange, closeValue, closeChange } = parsed.data;
  if ((closeValue === undefined) !== (closeChange === undefined)) return { error: "ค่าปิดกับเปลี่ยนแปลงตอนปิด ต้องกรอกทั้งคู่หรือเว้นว่างทั้งคู่" };
  const record = await prisma.record.findFirst({ where: { id, stock: { userId } }, select: { stockId: true } });
  if (!record) return { error: "ไม่พบรายการ" };
  await prisma.record.update({ where: { id }, data: { openValue, openChange, closeValue: closeValue ?? null, closeChange: closeChange ?? null } });
  revalidatePath(`/stocks/${record.stockId}`); revalidatePath("/dashboard"); revalidatePath("/digits"); revalidatePath("/calendar");
  return undefined;
}
