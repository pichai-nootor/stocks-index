/**
 * ทะเบียนสูตรต่อหุ้น (ปกติ) — สูตรของใครของมัน: หุ้นใหม่ = เพิ่มไฟล์ formulas/stocks/<ชื่อ>.ts แล้วลงทะเบียนตรงนี้
 * หน้าจอปัจจุบันของ SENSEX เรียก digits.ts ตรง ๆ (ไม่แตะ) — ทะเบียนนี้ให้โค้ดใหม่ ๆ ใช้หาไฟล์ของหุ้นแต่ละตัว
 */
import { nikkeiSession } from "@/lib/stocks/nikkei";
import { isEgypt } from "@/lib/stocks/egypt";
import { chinaSession } from "@/lib/stocks/china";
import { hangSengSession } from "@/lib/stocks/hangseng";
import { isDowJones } from "@/lib/stocks/dowjones";

export type StockFormulaId = "sensex" | "nikkei" | "egypt" | "china" | "hangseng" | "dowjones";
export const stockFormulaId = (symbol: string): StockFormulaId => (nikkeiSession(symbol) ? "nikkei" : isEgypt(symbol) ? "egypt" : chinaSession(symbol) ? "china" : hangSengSession(symbol) ? "hangseng" : isDowJones(symbol) ? "dowjones" : "sensex");

import { pickTwo, type TwoPick } from "@/lib/digits";
import type { RecordLike } from "@/lib/stats";
import { pickHangSeng } from "./hangseng";
import { pickDowJones } from "./dowjones";

/** ฟัน 2 ตัว + เจาะ ของหุ้นตัวนี้ — ฮั่งเส็ง/ดาวโจนส์ใช้สูตรของตัวเอง ตัวอื่นใช้เครื่องเดิม (ทุกหน้าที่โชว์ผลฟันต้องเรียกผ่านตรงนี้) */
export function pickTwoFor(symbol: string, openValue: number, openChange: number, history: RecordLike[]): TwoPick {
  const hs = hangSengSession(symbol);
  if (hs) return pickHangSeng(openValue, openChange, history, hs);
  if (isDowJones(symbol)) return pickDowJones(openValue, openChange, history);
  return pickTwo(openValue, openChange, history);
}
