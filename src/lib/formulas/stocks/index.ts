/**
 * ทะเบียนสูตรต่อหุ้น (ปกติ) — ไฟล์นี้แค่ "ส่งต่อ" ไปยังไฟล์ของหุ้นแต่ละตัว ไม่มีกฎของหุ้นตัวไหนอยู่ที่นี่
 *   แก้สูตรหุ้นไหน → แก้ formulas/stocks/<หุ้น>.ts ของหุ้นนั้นเท่านั้น (china / nikkei / egypt / sensex / hangseng / dowjones)
 *   หุ้นใหม่ = เพิ่มไฟล์ของตัวเอง แล้วเพิ่มบรรทัดใน pickTwoFor
 *   ทุกหน้าที่โชว์ผลฟัน (หน้าแรก/รายงาน/ตารางหุ้น/หน้าหุ้น/วิเคราะห์เลข) ต้องเรียกผ่าน pickTwoFor → เลขตรงกันทุกหน้า
 */
import { nikkeiSession } from "@/lib/stocks/nikkei";
import { isEgypt } from "@/lib/stocks/egypt";
import { chinaSession } from "@/lib/stocks/china";
import { hangSengSession } from "@/lib/stocks/hangseng";
import { isDowJones } from "@/lib/stocks/dowjones";
import { top2, bottom2, type TwoPick } from "@/lib/digits";
import type { RecordLike } from "@/lib/stats";
import { pickHangSeng } from "./hangseng";
import { pickDowJones } from "./dowjones";
import { pickEgypt } from "./egypt";
import { pickChina } from "./china";
import { pickNikkei } from "./nikkei";
import { pickSensex } from "./sensex";

export type StockFormulaId = "sensex" | "nikkei" | "egypt" | "china" | "hangseng" | "dowjones";
export const stockFormulaId = (symbol: string): StockFormulaId => (nikkeiSession(symbol) ? "nikkei" : isEgypt(symbol) ? "egypt" : chinaSession(symbol) ? "china" : hangSengSession(symbol) ? "hangseng" : isDowJones(symbol) ? "dowjones" : "sensex");

const amSessionOf = (symbol: string) => (chinaSession(symbol) === "pm" ? "cn" : nikkeiSession(symbol) === "pm" ? "nk" : null);
/** หุ้นนี้ใช้เลขรอบเช้าไหม (รอบบ่ายจีน/นิเคอิ — กฎอยู่ใน china.ts / nikkei.ts) */
export const usesAmDigits = (symbol: string) => !!amSessionOf(symbol);
/** วันที่ (ISO) → เลขที่ออกรอบเช้า (บน 2 ตัว + ล่าง) */
export type AmDigits = Map<string, string[]>;
type AmSource = { symbol: string; records: { date: Date; closeValue: number | null; closeChange: number | null }[] };
/** ผลรอบเช้าของตลาดเดียวกับ symbol (รอบบ่าย) จากรายการหุ้นของผู้ใช้ — แค่ดึงข้อมูล ไม่ใช่สูตร · หุ้นอื่นได้ map ว่าง */
export function amDigitsFor(stocks: AmSource[], symbol: string): AmDigits {
  const m = amSessionOf(symbol);
  const am = m && stocks.find((s) => (m === "cn" ? chinaSession(s.symbol) : nikkeiSession(s.symbol)) === "am");
  const out: AmDigits = new Map();
  if (am) for (const r of am.records) if (r.closeValue !== null && r.closeChange !== null) out.set(r.date.toISOString().slice(0, 10), [...new Set(top2(r.closeValue) + bottom2(r.closeChange))]);
  return out;
}

/**
 * ฟัน 2 ตัว + เจาะ ของหุ้นตัวนี้ — ส่งต่อไปไฟล์ของหุ้นนั้น
 *   ctx: วันที่ของงวด + ผลรอบเช้า (รอบบ่ายจีน/นิเคอิ — ทุกหน้าต้องส่ง) · ยังไม่มีผลเช้า → amWait = true (ยังไม่ใช่เลขจริง ห้ามโชว์เป็นเลขฟัน)
 */
export function pickTwoFor(symbol: string, openValue: number, openChange: number, history: RecordLike[], ctx?: { date: Date; am: AmDigits }): TwoPick & { amWait?: boolean } {
  const amOfDay = ctx?.am.get(ctx.date.toISOString().slice(0, 10));
  const hs = hangSengSession(symbol), cn = chinaSession(symbol), nk = nikkeiSession(symbol);
  if (hs) return pickHangSeng(openValue, openChange, history, hs);
  if (isDowJones(symbol)) return pickDowJones(openValue, openChange, history);
  if (isEgypt(symbol)) return pickEgypt(openValue, openChange, history);
  if (cn) return pickChina(openValue, openChange, history, cn, amOfDay);
  if (nk) return pickNikkei(openValue, openChange, history, nk, amOfDay);
  return pickSensex(openValue, openChange, history);
}
