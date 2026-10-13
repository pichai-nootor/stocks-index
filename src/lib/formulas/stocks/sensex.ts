/**
 * สูตรของ "BSE SENSEX" — เครื่องคิดจริงอยู่ที่ src/lib/digits.ts และ src/lib/stats.ts (ไม่แตะ)
 * ไฟล์นี้เป็นจุดอ้างอิงของ SENSEX ในทะเบียนสูตรต่อหุ้น: ค่าอ้างอิง 10 ปีที่หน้าจอใช้เทียบอยู่แล้วส่งออกจาก digits.ts
 */
import { pickTwo, type TwoPick } from "@/lib/digits";
import type { RecordLike } from "@/lib/stats";
export { DIGIT_BASE_RATE, PAIR_BASE, DRILL_BASE } from "@/lib/digits";
export { DIRECTION_TIERS } from "@/lib/stats";

/**
 * คู่ผูก (ต้องมาครบทั้ง 2 ตัว) ของ SENSEX — วัดจากข้อมูล SENSEX เอง 2,462 วัน (ก.ย. 2016 → ก.ย. 2026)
 *   ถูกครบ 17.6% (สุ่ม ~10%) · ครึ่งแรก 16.8% ครึ่งหลัง 18.4% — นิ่ง
 *   งวดที่โมเดลให้ ≥23.5%: ถูกจริง 23.4% (282 วัน) · งวดอื่น 16.8% → เกณฑ์นี้ใช้กับ SENSEX ได้จริง
 *   โมเดลตรงกับของจริงทุกช่วง: 16%→14% · 17%→16% · 18%→18% · 20%→19% · 24%→22%
 *   (ต่างจากอียิปต์ที่เกณฑ์นี้กลับด้าน จึงปิดไว้ — ของใครของมัน)
 */
export const SENSEX_PAIR = { both: 0.176, strong: 0.234, strongDays: 282, other: 0.168, days: 2462, threshold: 0.235 } as const;

/** ฟันของ SENSEX (และหุ้นที่ยังไม่มีไฟล์ของตัวเอง) — เครื่องไล่ 200 กรณีจาก D · เลขเสมอ → เลขมากก่อน · กฎของ SENSEX อยู่ที่นี่ที่เดียว */
export function pickSensex(openValue: number, openChange: number, history: RecordLike[]): TwoPick {
  return pickTwo(openValue, openChange, history);
}
