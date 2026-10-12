"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { EGYPT_STOCK, egyptNextTradingDay, fetchEgyptQuote } from "@/lib/stocks/egypt";

export type EgyptOpenState = { error?: string; date?: string } | undefined;

/**
 * เปิดแถวของวันซื้อขายถัดไปทันที — อียิปต์ประกาศ เปิด = ปิดวันก่อน จึงฟันธงได้ตั้งแต่ตลาดยังไม่เปิด (ไม่ต้องรอ 15:00 ไทย)
 * ใช้ปิดล่าสุดที่บันทึกไว้เป็นราคาเปิด และค่าเปลี่ยนแปลงตอนเปิด = 0 เหมือนที่เว็บประกาศ
 */
export async function openEgyptNextDay(prev: EgyptOpenState): Promise<EgyptOpenState> {
  void prev;
  const { userId } = await requireUser();
  const stock = await prisma.stock.findFirst({ where: { userId, symbol: EGYPT_STOCK.symbol } });
  if (!stock) return { error: "ยังไม่มีหุ้น EGX30" };
  const last = await prisma.record.findFirst({ where: { stockId: stock.id, closeValue: { not: null } }, orderBy: { date: "desc" } });
  if (!last?.closeValue) return { error: "ยังไม่มีราคาปิดล่าสุด" };
  const date = egyptNextTradingDay(last.date.toISOString().slice(0, 10));
  const exists = await prisma.record.findFirst({ where: { stockId: stock.id, date: new Date(`${date}T00:00:00.000Z`) } });
  if (exists) return { error: `วัน ${date} บันทึกไว้แล้ว` };
  // ใช้ราคาเปิดจริงของวันนั้นถ้าตลาดเปิดแล้ว (แท่งแรกในไฟล์รายนาที) — ไม่งั้นค่าเปลี่ยนแปลงจะเป็น 0 และช่องเปิดจะว่าง
  const q = await fetchEgyptQuote();
  const realOpen = q && q.tradingDate === date && q.open > 0 ? q.open : null;
  const openValue = realOpen ?? last.closeValue;
  const openChange = realOpen ? r2(realOpen - last.closeValue) : 0;
  await prisma.record.create({ data: { stockId: stock.id, date: new Date(`${date}T00:00:00.000Z`), openValue, openChange } });
  revalidatePath("/dashboard"); revalidatePath(`/stocks/${stock.id}`);
  return { date };
}

export type EgyptSetOpenState = { error?: string; ok?: string } | undefined;

/**
 * กรอกราคาเปิดของวันนี้เอง (ก๊อปจาก investing.com ช่อง "ราคาเปิด")
 *   investing บล็อกการดึงจากเซิร์ฟเวอร์ (403) จึงดึงอัตโนมัติไม่ได้ — วางตัวเลขแล้วระบบคิดค่าเปลี่ยนแปลงให้เอง
 *   ค่าเปลี่ยนแปลงตอนเปิด = ราคาเปิด − ปิดวันก่อน (ไม่แตะ D ซึ่งมาจากปิดวันก่อนเสมอ)
 */
export async function setEgyptOpen(prev: EgyptSetOpenState, form: FormData): Promise<EgyptSetOpenState> {
  void prev;
  const { userId } = await requireUser();
  const open = Number(String(form.get("open") ?? "").replace(/,/g, ""));
  const recordId = String(form.get("recordId") ?? "");
  if (!Number.isFinite(open) || open <= 0) return { error: "กรอกราคาเปิดให้ถูกต้อง" };
  const rec = await prisma.record.findFirst({ where: { id: recordId, stock: { userId } } });
  if (!rec) return { error: "ไม่พบแถวของวันนี้" };
  const prevClose = r2(rec.openValue - rec.openChange);
  await prisma.record.update({ where: { id: rec.id }, data: { openValue: r2(open), openChange: r2(open - prevClose) } });
  revalidatePath(`/stocks/${rec.stockId}`);
  return { ok: `บันทึกแล้ว: เปิด ${r2(open).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${open - prevClose >= 0 ? "+" : ""}${r2(open - prevClose)})` };
}

export type EgyptSetupState = { error?: string; added?: number; updated?: number; total?: number } | undefined;
const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * นำเข้าประวัติ EGX30 จากไฟล์ CSV ของ investing.com ที่ผู้ใช้โหลดเอง (แหล่งเดียวที่ใช้เป็นประวัติ — ไม่ดึงประวัติจาก mubasher แล้ว)
 *   หัวไฟล์ไทย: "วันเดือนปี","ล่าสุด","ราคาเปิด","สูงสุด","ต่ำสุด","ปริมาณ","% เปลี่ยน" · วันที่ MM/DD/YYYY
 *   (อังกฤษก็ได้: Date,Price,Open,High,Low,Vol.,Change %)
 * เก็บ: ปิด = "ล่าสุด" · เปิด = "ราคาเปิด" ตามที่ตลาดประกาศ (= ปิดวันก่อน) · เปลี่ยนแปลงตอนปิด คิดใหม่ทั้งชุดหลังนำเข้า
 */
export async function importEgyptCsv(prev: EgyptSetupState, form: FormData): Promise<EgyptSetupState> {
  void prev;
  const { userId } = await requireUser();
  const file = form.get("file");
  const text = typeof file === "string" ? file : file instanceof File ? await file.text() : "";
  if (!text.trim()) return { error: "ยังไม่ได้เลือกไฟล์ CSV" };

  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cell = (l: string) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows: { date: string; close: number; open: number }[] = [];
  for (const line of lines.slice(1)) {
    const c = line.includes('","') ? line.slice(1, -1).split('","') : cell(line);
    if (c.length < 3) continue;
    const m = c[0].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) continue;
    const num = (s: string) => Number(s.replace(/,/g, ""));
    const close = num(c[1]), open = num(c[2]);
    if (!Number.isFinite(close) || !Number.isFinite(open)) continue;
    rows.push({ date: `${m[3]}-${m[1]}-${m[2]}`, close, open });
  }
  if (!rows.length) return { error: "อ่านไฟล์ไม่ได้ — ต้องเป็น CSV จาก investing.com (วันเดือนปี, ล่าสุด, ราคาเปิด)" };
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const stock = await prisma.stock.upsert({ where: { userId_symbol: { userId, symbol: EGYPT_STOCK.symbol } }, create: { userId, symbol: EGYPT_STOCK.symbol, name: EGYPT_STOCK.name }, update: {} });
  const existing = await prisma.record.findMany({ where: { stockId: stock.id }, orderBy: { date: "asc" } });
  const byDate = new Map(existing.map((r) => [r.date.toISOString().slice(0, 10), r]));
  let added = 0, updated = 0;
  for (const row of rows) {
    const cur = byDate.get(row.date);
    if (!cur) {
      await prisma.record.create({ data: { stockId: stock.id, date: new Date(`${row.date}T00:00:00.000Z`), openValue: row.open, openChange: 0, closeValue: row.close, closeChange: 0, note: "investing.com" } });
      added++;
    } else if (cur.closeValue === null || Math.abs(cur.closeValue - row.close) > 0.005 || Math.abs(cur.openValue - row.open) > 0.005) {
      await prisma.record.update({ where: { id: cur.id }, data: { openValue: row.open, closeValue: row.close, note: "investing.com" } });
      updated++;
    }
  }
  // คิด "เปลี่ยนแปลงตอนปิด" ใหม่ทั้งชุด (เทียบปิดของวันซื้อขายก่อนหน้าที่มีจริง) — ค่านี้คือเลขล่าง
  const all = await prisma.record.findMany({ where: { stockId: stock.id }, orderBy: { date: "asc" } });
  for (let i = 1; i < all.length; i++) {
    const cur = all[i], before = all[i - 1];
    if (cur.closeValue === null || before.closeValue === null) continue;
    const change = r2(cur.closeValue - before.closeValue);
    if (cur.closeChange === null || Math.abs(cur.closeChange - change) > 0.005) await prisma.record.update({ where: { id: cur.id }, data: { closeChange: change } });
  }
  revalidatePath("/stocks"); revalidatePath("/dashboard"); revalidatePath(`/stocks/${stock.id}`);
  return { added, updated, total: all.length };
}
