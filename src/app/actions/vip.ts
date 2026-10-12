"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formulaFor } from "@/lib/formulas";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "./auth";
import { fetchVipHistory, fetchVipToday, isVipMarket, vipTop3, vipBottom2, vipMarket, pastCloseThai, vipWaitReason } from "@/lib/vip";

export type VipImportState = { error?: string; imported?: number; updated?: number; total?: number } | undefined;

const dateOnly = (s: string) => new Date(`${s}T00:00:00.000Z`);

/** ดึงผลย้อนหลังจากเว็บ (≈15 วัน) มาเก็บ — วันที่มีอยู่แล้วไม่ทับของที่กรอกเอง แต่เติม open/close ให้ถ้าดึงได้ */
export async function importVipHistory(_prev: VipImportState, formData: FormData): Promise<VipImportState> {
  const { userId } = await requireUser();
  const market = String(formData.get("market") ?? "");
  if (!isVipMarket(market)) return { error: "ไม่รู้จักตลาด" };
  const rows = await fetchVipHistory(market);
  if (!rows) return { error: "ดึงผลจาก stocks-vip.com ไม่ได้ (เว็บล่มหรือเปลี่ยน API) — กรอกเองด้านล่างได้" };
  const today = await fetchVipToday(market);
  let imported = 0, updated = 0;
  for (const r of rows) {
    const date = dateOnly(r.date);
    // ราคา ณ เวลาออกผลของรอบนั้น (ถ้าฟีดวันเดียวกันและตรงกับผล) — รอบสุดท้ายใช้แถวสุดท้าย, รอบอื่นใช้แถวตามเวลา
    const rp = today && today.date === r.date ? today.rounds.find((x) => x.round === r.round) : undefined;
    const cand = rp ? { price: rp.price, diff: rp.diff } : today && today.date === r.date && today.feedDone && r.round === Math.max(...vipMarket(market).rounds) ? { price: today.last, diff: today.diff } : null;
    // ตลาดที่ฟีดไม่มีราคาเปิด (ฮั่งเส็ง/เกาหลี) ให้เก็บแค่ราคาปิด+diff — ห้ามใส่ open (ฟีดของสองตลาดนี้ให้ราคาล่าสุดเป็นภาพนิ่ง ไม่ใช่ราคาเปิด)
    const prices = cand && today && vipTop3(cand.price) === r.top && vipBottom2(cand.diff) === r.bottom ? { ...(today.open !== null ? { open: today.open } : {}), close: cand.price, diff: cand.diff }
      : r.close !== undefined ? { close: r.close, diff: r.diff } : {};
    const existing = await prisma.vipResult.findUnique({ where: { userId_market_date_round: { userId, market, date, round: r.round } } });
    if (!existing) { await prisma.vipResult.create({ data: { userId, market, date, round: r.round, top: r.top, bottom: r.bottom, source: "web", ...prices } }); imported++; }
    else if (existing.top === "") { await prisma.vipResult.update({ where: { id: existing.id }, data: { top: r.top, bottom: r.bottom, ...prices } }); imported++; } // แถวรอผล (บันทึกเปิดไว้ตอนเช้า) → เติมผล
    else if (existing.source === "feed" && (existing.top !== r.top || existing.bottom !== r.bottom)) { await prisma.vipResult.update({ where: { id: existing.id }, data: { top: r.top, bottom: r.bottom, source: "web" } }); updated++; } // ผลทางการมาแล้วต่างจากที่อ่านจากฟีด → ยึดทางการ
    else if ((existing.open === null && "open" in prices) || (existing.close === null && "close" in prices)) { await prisma.vipResult.update({ where: { id: existing.id }, data: prices }); updated++; }
  }
  // endpoint ประวัติอัปเดตช้ากว่าเวลาออกผล (บางวันมาเช้าวันถัดไป) — รอบไหนเลยเวลาออกผลแล้วและประวัติยังไม่มี ใช้ราคาในฟีด ณ เวลาออกผลของรอบนั้นเป็นผล
  // (ตรวจ 18 ก.ย. 69 อินเดีย: แถวสุดท้ายของฟีด 969,004.29 / −92.32 = ผลทางการ 429 / 32 เป๊ะ · 20 ก.ย. จีนรอบเช้า: แถว 11:05 ของฟีด = ผล)
  if (today) {
    for (const round of vipMarket(market).rounds) {
      if (rows.some((r) => r.date === today.date && r.round === round)) continue;
      if (!pastCloseThai(market, today.date, new Date(), round)) continue;
      const rp = today.rounds.find((x) => x.round === round);
      // ใช้แถวสุดท้ายของฟีดเป็นผลได้เฉพาะเมื่อฟีดถึงแถวสุดท้ายจริง (ไม่ใช่แค่เลยเวลาออกผล) — ไม่งั้นจะบันทึกราคาระหว่างทางเป็นผล
      const cand = rp ? { price: rp.price, diff: rp.diff } : round === Math.max(...vipMarket(market).rounds) && today.feedDone ? { price: today.last, diff: today.diff } : null;
      if (!cand) continue;
      const date = dateOnly(today.date);
      const data = { top: vipTop3(cand.price), bottom: vipBottom2(cand.diff), ...(today.open !== null ? { open: today.open } : {}), close: cand.price, diff: cand.diff };
      const existing = await prisma.vipResult.findUnique({ where: { userId_market_date_round: { userId, market, date, round } } });
      if (!existing) { await prisma.vipResult.create({ data: { userId, market, date, round, source: "feed", ...data } }); imported++; }
      else if (existing.top === "") { await prisma.vipResult.update({ where: { id: existing.id }, data: { ...data, source: "feed" } }); imported++; }
    }
  }
  revalidatePath("/vip");
  return { imported, updated, total: rows.length };
}

const manualSchema = z.object({
  market: z.string().refine(isVipMarket, "ไม่รู้จักตลาด"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาระบุวันที่"),
  round: z.coerce.number().int().min(1).max(2),
  top: z.string().trim().regex(/^\d{3}$/, "บนต้องเป็นเลข 3 หลัก"),
  bottom: z.string().trim().regex(/^\d{2}$/, "ล่างต้องเป็นเลข 2 หลัก"),
  open: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number({ message: "ราคาเปิดต้องเป็นตัวเลข" }).positive().optional()),
});

/** กรอกผลเอง (เช่นวันที่เว็บไม่มีแล้ว) — ซ้ำวัน/รอบเดิม = แก้ทับ */
export async function addVipResult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { market, date, round, top, bottom, open } = parsed.data;
  if (!(vipMarket(market).rounds as readonly number[]).includes(round)) return { error: "ตลาดนี้ไม่มีรอบนั้น" };
  await prisma.vipResult.upsert({
    where: { userId_market_date_round: { userId, market, date: dateOnly(date), round } },
    create: { userId, market, date: dateOnly(date), round, top, bottom, source: "manual", open: open ?? null },
    update: { top, bottom, source: "manual", ...(open !== undefined ? { open } : {}) },
  });
  revalidatePath("/vip");
  return undefined;
}

/**
 * เก็บราคาเปิดของวันจากฟีดไว้ก่อนออกผล (แถว top/bottom ว่าง = รอผล) — หน้า /vip เรียกให้เองทุกครั้งที่โหลด ไม่ต้องกดอะไร
 * ฟีดมีแค่วันปัจจุบัน ถ้าไม่เก็บตอนนั้นจะไม่มีราคาเปิดของวันนั้นอีก
 */
/**
 * ล็อกเลขที่ฟันของงวดที่ยังไม่ออกผล — เก็บครั้งแรกครั้งเดียว ไม่เขียนทับ
 *   เพื่อให้เลขที่ผู้ใช้เห็นก่อนหวยออก = เลขที่ใช้ให้คะแนนหลังผลออก (ต่อให้สูตรถูกแก้ทีหลัง ประวัติก็ไม่เปลี่ยน)
 */
export async function lockVipPick(userId: string, market: string, date: Date, round: number) {
  if (!isVipMarket(market)) return;
  const row = await prisma.vipResult.findUnique({ where: { userId_market_date_round: { userId, market, date, round } } });
  if (!row || row.pick) return;
  // ห้ามล็อกรอบหลังก่อนที่ผลรอบก่อนของวันเดียวกันจะออก: สูตรใช้ "งวดล่าสุด" เป็นตัวแปรหลัก ถ้าล็อกตอนเช้าจะได้เลขเดียวกับรอบเช้าแล้วแก้ไม่ได้
  // (เห็นในข้อมูลจริง: ฮั่งเส็ง 25–27 ก.ย. 69 ล็อกรอบเช้า/บ่ายเป็นเลขเดียวกันทั้งคู่ · จีน/นิเคอิ 25–26 ก.ย. เช่นกัน) — ปล่อยให้ล็อกรอบนี้ตอนโหลดหน้าครั้งถัดไปหลังผลรอบเช้าเข้าแทน
  const earlier = (vipMarket(market).rounds as readonly number[]).filter((r) => r < round);
  if (earlier.length) {
    const done = await prisma.vipResult.count({ where: { userId, market, date, round: { in: earlier }, NOT: { top: "" } } });
    if (done < earlier.length) return;
  }
  const past = await prisma.vipResult.findMany({ where: { userId, market, NOT: { top: "" } }, orderBy: [{ date: "asc" }, { round: "asc" }] });
  // ผลงวดก่อนหน้ายังไม่เข้าระบบ → ห้ามล็อก (สูตรจะฟันจากประวัติที่ขาดงวดล่าสุด ได้เลขผิด)
  if (vipWaitReason(market, date.toISOString().slice(0, 10), round, (d, r) => past.some((x) => x.date.toISOString().slice(0, 10) === d && x.round === r))) return;
  const hist = past.filter((r) => r.date < date || (r.date.getTime() === date.getTime() && r.round < round)).map((r) => ({ top: r.top, bottom: r.bottom, round: r.round, date: r.date, open: r.open }));
  const F = formulaFor(market);
  const p = F.pick(hist, row.open, round);
  if (p) await prisma.vipResult.update({ where: { id: row.id }, data: { pick: p.digits.join("-") } });
}

export async function rememberVipOpen(userId: string, market: string, today: { date: string; open: number | null; last: number; diff: number; closed: boolean; feedDone: boolean; rounds: { round: number; price: number; diff: number }[] }) {
  if (!isVipMarket(market)) return;
  const date = dateOnly(today.date);
  for (const round of vipMarket(market).rounds) {
    const rp = today.rounds.find((x) => x.round === round);
    const close = rp ? { close: rp.price, diff: rp.diff } : round === Math.max(...vipMarket(market).rounds) && today.feedDone ? { close: today.last, diff: today.diff } : {};
    const existing = await prisma.vipResult.findUnique({ where: { userId_market_date_round: { userId, market, date, round } } });
    if (!existing) await prisma.vipResult.create({ data: { userId, market, date, round, top: "", bottom: "", open: today.open, source: "web", ...close } });
    else {
      // เติมทั้งราคาเปิด (ถ้าฟีดมี) และราคาปิด+diff ของรอบที่ออกผลแล้ว — ฮั่งเส็ง/เกาหลีไม่มีราคาเปิด ราคาปิดรายรอบจึงเป็นข้อมูลราคาเดียวที่เก็บได้
      const patch = { ...(existing.open === null && today.open !== null ? { open: today.open } : {}), ...(existing.close === null && "close" in close ? close : {}) };
      if (Object.keys(patch).length) await prisma.vipResult.update({ where: { id: existing.id }, data: patch });
    }
    await lockVipPick(userId, market, date, round); // ล็อกเลขที่ฟันของงวดนี้ไว้ทันที
  }
}

/** เติม/แก้ราคาเปิดของงวดเก่าที่ระบบไม่ทันเก็บ (สูตร B ใช้) */
export async function setVipOpen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const open = Number(formData.get("open"));
  if (!Number.isFinite(open) || open <= 0) return { error: "ราคาเปิดต้องเป็นตัวเลข" };
  const r = await prisma.vipResult.findFirst({ where: { id, userId } });
  if (!r) return { error: "ไม่พบงวด" };
  await prisma.vipResult.update({ where: { id }, data: { open } });
  revalidatePath("/vip");
  return undefined;
}

/** นำเข้าประวัติที่แนบมากับโปรแกรม (src/data/vip-history/<market>.json จาก raakaadee.com) — เพิ่มเฉพาะงวดที่ยังไม่มี */
export async function importVipBundled(_prev: VipImportState, formData: FormData): Promise<VipImportState> {
  const { userId } = await requireUser();
  const market = String(formData.get("market") ?? "");
  if (!isVipMarket(market)) return { error: "ไม่รู้จักตลาด" };
  let rows: [string, number, string, string][];
  try { rows = (await import(`@/data/vip-history/${market}.json`)).default; } catch { return { error: "ตลาดนี้ไม่มีไฟล์ประวัติแนบมา" }; }
  const existing = new Set((await prisma.vipResult.findMany({ where: { userId, market }, select: { date: true, round: true } })).map((r) => `${r.date.toISOString().slice(0, 10)}#${r.round}`));
  const data = rows.filter(([d, r]) => !existing.has(`${d}#${r}`)).map(([d, round, top, bottom]) => ({ userId, market, date: dateOnly(d), round, top, bottom, source: "bundled" }));
  if (data.length) await prisma.vipResult.createMany({ data });
  revalidatePath("/vip");
  return { imported: data.length, updated: 0, total: rows.length };
}

export async function deleteVipResult(formData: FormData) {
  const { userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await prisma.vipResult.deleteMany({ where: { id, userId } });
  revalidatePath("/vip");
}
