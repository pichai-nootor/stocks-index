"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "./auth";

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

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const closeSchema = z.object({
  id: z.string().min(1),
  closeValue: z.preprocess(emptyToUndef, z.coerce.number({ message: "ค่าปิดต้องเป็นตัวเลข" }).positive("ค่าปิดต้องมากกว่า 0")),
  closeChange: z.preprocess(emptyToUndef, z.coerce.number({ message: "เปลี่ยนแปลงตอนปิดต้องเป็นตัวเลข" })),
});

export async function createRecord(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { stockId, date, openValue, openChange, note } = parsed.data;
  const stock = await prisma.stock.findFirst({ where: { id: stockId, userId } });
  if (!stock) return { error: "ไม่พบหุ้น" };

  const dup = await prisma.record.findFirst({ where: { stockId, date: new Date(date) } });
  if (dup) return { error: "วันนี้บันทึกไปแล้ว — เติมค่าปิดได้ในตารางประวัติ" };

  await prisma.record.create({
    data: { stockId, date: new Date(date), openValue, openChange, note: note || null },
  });
  revalidatePath(`/stocks/${stockId}`);
  revalidatePath("/dashboard");
  revalidatePath("/predict");
  return undefined;
}

/** หน้าวิเคราะห์: บันทึกเลขเปิดของวัน (ถ้ามีอยู่แล้วและยังไม่ปิด → อัปเดต) แล้วพาไปดูฟันธง */
export async function saveOpenAndForecast(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
  if (existing) {
    await prisma.record.update({ where: { id: existing.id }, data: { openValue, openChange } });
  } else {
    await prisma.record.create({ data: { stockId, date: new Date(date), openValue, openChange } });
  }
  revalidatePath(`/stocks/${stockId}`);
  revalidatePath("/digits");
  revalidatePath("/dashboard");
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
