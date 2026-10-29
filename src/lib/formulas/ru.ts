/**
 * สูตรของ "หุ้นรัสเซีย VIP" (stocks-vip.com /live/rux · ออกผล 23:50 ไทย รอบเดียว ทุกวัน) — วิเคราะห์จากเลขที่ออกของรัสเซีย VIP เองเท่านั้น
 * ผลมาจาก gcp.lottosuperrich.com เหมือนอังกฤษ VIP (บน = 3 หลักท้ายของรางวัลที่ 1 · ล่าง = 2 หลักท้ายของรางวัลที่ 2)
 *   เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง → สุ่ม ★ ≈ 38% · 2 ตัว ≈ 64%
 *
 * ประวัติ 1,718 งวด (1 ม.ค. 65 → 28 ต.ค. 69) จาก raakaadee.com ใน vip-history/ru.json — ตรงกับเว็บต้นทาง 5/5 งวด · ขาด 16 ก.พ.–27 มี.ค. 66
 *
 * ทดสอบ walk-forward 40 วิธี (ผู้ใช้ขอ 29 ต.ค. 69 · เริ่มงวดที่ 300 · แบ่ง 3 ส่วนเท่ากัน · ★ / 2 ตัว · สุ่ม 38.3/64.4 · 37.9/63.8 · 38.0/64.0):
 *   ▸ ตรงข้ามเยอรมัน — เครื่องของรัสเซีย "ออกซ้ำเลขช่วงสั้น": เลขที่ออกบ่อยใน 3 งวดล่าสุด (เสมอ → ออกล่าสุดกว่า)
 *     ★ 45.6 / 39.1 / 40.8 · 2 ตัว 67.8 / 66.0 / 68.5 ← ใช้ · ตระกูลเดียวกัน (ร้อน 5 งวด · ร้อนรวม 3/5/7 · ออกล่าสุด) ชนะสุ่มทั้ง 3 ส่วนเหมือนกัน = ไม่ใช่บังเอิญช่วงเดียว
 *   ▸ เลขเย็น 100–200 งวด ส่วนหลังดี แต่ส่วนแรกเท่าสุ่ม และเงินขาดทุน 2 ใน 3 ส่วน · เลขร้อน 10–300 งวด แพ้สุ่มช่วงหลัง · มาร์คอฟ / วันในสัปดาห์ เท่าสุ่ม
 * เลขเจาะ 2 ชุด × 6: คู่ที่ออกบ่อยใน 300 งวด ตัดเบิ้ล ตัดคู่ของเมื่อวาน — กำไรทั้ง 3 ส่วน (+295 / +201 / +298 ต่องวด เลขละ 20 · ทรุดลึกสุด −30,400)
 *   โอกาสเจาะมา 48.9% (สุ่ม 45.9%)
 */
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const RU_MIN_HISTORY = 300; // เลขเจาะใช้ 300 งวด
const RU_RECENT = 3;
const RU_PAIR_WINDOW = 300;
const RU_DRILL_PER_DIGIT = 6;
export const RU_BASE = { star: [0.456, 0.391, 0.408], any: [0.678, 0.66, 0.685], random: [0.381, 0.641] } as const;

/** อันดับเลข: ออกกี่งวดใน 3 งวดล่าสุด (มาก = มาก่อน) · เสมอ → ออกล่าสุดกว่า → เลขมาก */
function recentOrder(history: VipDraw[]) {
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const count = (d: string) => sets.slice(-RU_RECENT).filter((s) => s.has(d)).length;
  const gap = (d: string) => { let k = 0; for (let i = sets.length - 1; i >= 0 && !sets[i].has(d); i--) k++; return k; };
  return { order: [...DIGITS10].sort((a, b) => count(b) - count(a) || gap(a) - gap(b) || Number(b) - Number(a)), count };
}

function pickRu(history: VipDraw[]): VipPick | null {
  if (history.length < RU_MIN_HISTORY) return null;
  const { order, count } = recentOrder(history);
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  return {
    order, formula: "ru-recent3", label: "สูตรรัสเซีย VIP", digits: [order[0], order[1]],
    note: `เลขที่ออกซ้ำช่วงสั้น (${RU_RECENT} งวดล่าสุด): ${order[0]} (ออก ${count(order[0])}/${RU_RECENT}), ${order[1]} (ออก ${count(order[1])}/${RU_RECENT}) · อันดับถัดไป ${order.slice(2, 5).join(", ")} · ทดสอบ 1,418 งวด 3 ส่วน ★ ${RU_BASE.star.map(pct).join(" / ")} · 2 ตัว ${RU_BASE.any.map(pct).join(" / ")} (สุ่ม ${pct(RU_BASE.random[0])} / ${pct(RU_BASE.random[1])})`,
  };
}

/** เลขเจาะ: คู่ (เลขที่ฟัน + อีกตัว) ที่ออกเป็น 2 ตัวบน/ล่างบ่อยสุดใน 300 งวด ตัดเบิ้ล ตัดคู่ของเมื่อวาน ชุดละ 6 */
function drillRu(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const pairCount: Record<string, number> = {};
  for (const h of history.slice(-RU_PAIR_WINDOW)) for (const m of [canon2(h.top.slice(-2)), canon2(h.bottom)]) pairCount[m] = (pairCount[m] ?? 0) + 1;
  const prev = history[history.length - 1];
  const skip = prev ? [canon2(prev.top.slice(-2)), canon2(prev.bottom)] : [];
  const row = (d: string, taken: string[]) => DIGITS10.filter((x) => x !== d && !taken.includes(canon2(d + x)))
    .sort((x, y) => (pairCount[canon2(d + y)] ?? 0) - (pairCount[canon2(d + x)] ?? 0) || x.localeCompare(y))
    .slice(0, RU_DRILL_PER_DIGIT).map((x) => d + x);
  const [a, b] = pick.digits;
  const rowA = row(a, skip);
  const rowB = row(b, [...skip, ...rowA.map(canon2)]);
  return [{ digit: a, numbers: rowA }, { digit: b, numbers: rowB }];
}

export const ruFormula: MarketFormula = {
  name: "สูตรรัสเซีย VIP — เลขที่ออกซ้ำช่วงสั้น (3 งวดล่าสุด)",
  evidence: "**วิเคราะห์จากเลขที่ออกของรัสเซีย VIP เองเท่านั้น** (1,718 งวด 1 ม.ค. 65–28 ต.ค. 69 จาก raakaadee ตรงกับเว็บต้นทาง 5/5) · ทดสอบ 40 วิธี แบ่งประวัติ 3 ส่วน: เครื่องของรัสเซียออกซ้ำเลขช่วงสั้น — เลขที่ออกบ่อยใน 3 งวดล่าสุดชนะสุ่มทั้ง 3 ส่วน ★ 45.6% / 39.1% / 40.8% · 2 ตัว 67.8% / 66.0% / 68.5% (สุ่ม ~38 / 64) · วิธีตระกูลเดียวกัน (ร้อน 5 งวด · ออกล่าสุด) ชนะสุ่มทุกส่วนเหมือนกัน · เลขเย็น/ร้อนช่วงยาว มาร์คอฟ วันในสัปดาห์ ไม่นิ่ง · เลขเจาะ = คู่ที่ออกบ่อยใน 300 งวด เจาะมา 48.9% (สุ่ม 45.9%) · ย้อนหลังกำไรทั้ง 3 ส่วน (~+200–300 ต่องวด เลขละ 20) ขาดทุนสะสมลึกสุด −30,400 · เว็บต้นทางเก็บผลย้อนหลังแค่ 5 วัน — ดึงผลอย่าให้ห่างเกิน 5 วัน",
  pick: (history) => pickRu(history),
  drill: drillRu,
  noManualOpen: true, // สูตรไม่ใช้ราคาเปิด — ระบบเก็บเองจากกราฟถ้าทัน
  minHistory: RU_MIN_HISTORY,
  since: "2026-10-30",
  drillRandom: 0.459,
};
