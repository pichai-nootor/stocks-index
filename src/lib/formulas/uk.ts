/**
 * สูตรของ "หุ้นอังกฤษ VIP" (FTSE 100 ของ stocks-vip.com · ออกผล 21:50 ไทย รอบเดียว ทุกวัน) — วิเคราะห์จากเลขที่ออกของอังกฤษ VIP เองเท่านั้น
 * ผลแสดงเป็นรางวัล 5 หลัก (บน = 3 หลักท้ายของรางวัลที่ 1 · ล่าง = 2 หลักท้ายของรางวัลที่ 2) แต่มาจากราคาในกราฟ FTSE ของเว็บเหมือนตลาด VIP อื่น
 *   (บน = ทศนิยมราคาแถวสุดท้าย · ล่าง = ทศนิยม diff ที่เว็บให้ ซึ่งไม่ตรง ราคา − เปิด) → ราคาเปิดใช้ทายผลไม่ได้ ระบบเก็บไว้ตรวจย้อนหลังเท่านั้น
 *   เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง → สุ่ม ★ ≈ 38% · 2 ตัว ≈ 64% (สูงกว่าตลาด VIP อื่นที่ ~33/57)
 *
 * ประวัติ 1,378 งวด (25 พ.ย. 65 → 12 ต.ค. 69) จาก raakaadee.com ใน vip-history/uk.json — ตรงกับเว็บต้นทาง 5/5 งวด · ขาด 16 ก.พ.–27 มี.ค. 66
 *
 * ทดสอบ walk-forward (ครึ่ง A = ถึง 11 ม.ค. 68 · B = หลังจากนั้น · ★ / 2 ตัว · สุ่ม A 38.0/63.9 · B 37.6/63.5):
 *   ▸ รวมเลขที่ออกน้อยช่วงสั้น 15+20+25+30+35 งวด: A ★39.9 / 2 ตัว 66.7 · B 39.9 / 67.3 · ปีล่าสุด 40.8 / 68.2 — นิ่งสุดทั้งสองครึ่ง (เลือกใช้)
 *     ★ ปีล่าสุดกระจายครบ 10 เลข (มากสุดเลข 3 อยู่ 66 วัน)
 *   ▸ เลขเย็นช่วงยาว 200–400 งวด ★ สูงกว่า (A 41.6–43.0 · B 38.2–41.8) แต่ 2 ตัวครึ่งหลังเท่าสุ่ม และ ★ ติดเลข 3 ถึง 100–156 วันต่อปี
 *     = ความเอียงของเลขระยะยาว ไม่ใช่การถ่วงดุล → ไม่ใช้ (บทเรียนอินเดียติดเลข 8)
 *     เทียบเงินจริง (รูด+เจาะ เลขละ 20): สูตรหลัก +212 / +196 ต่องวด ทั้งสองครึ่ง · เย็น 300 +299 / +124 ขาดทุนสะสมลึกกว่า (−59,360 vs −45,600)
 *     → ผู้ใช้ให้ยึดสูตรเดียว (13 ต.ค. 69) — ไม่มีช่องทดลอง
 *   ▸ ไม่ชนะสุ่ม: เลขร้อน 10/30/100/300 · เลขเมื่อวาน (34.0/35.5) · หายนานสุด (33.5/34.0) · มาร์คอฟ · วันในสัปดาห์
 *   ได้เปรียบสุ่มแค่ ~2 จุด (★) / ~3–4 จุด (2 ตัว) — อ่อนกว่าสิงคโปร์ เพราะผลเป็นหวยออกรางวัล
 * เลขเจาะ 2 ชุด × 6: ไม่มีวิธีไหนชนะสุ่มนิ่ง (คู่ออกบ่อย/ออกน้อย 44.1–49.1 · สุ่ม 46.8–48.8)
 *   → จับคู่เลขที่ฟันกับเลขที่ออกน้อยรองลงมา (A 47.9 · B 48.7 · ปีล่าสุด 48.8) ไปในทางเดียวกับเลขฟัน — ถือว่าเท่าสุ่ม
 */
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const UK_MIN_HISTORY = 35;
const UK_WINDOWS = [15, 20, 25, 30, 35] as const;
const UK_DRILL_PER_DIGIT = 6;
export const UK_BASE = { starA: 0.399, anyA: 0.667, starB: 0.399, anyB: 0.673, starYear: 0.408, anyYear: 0.682, randomStar: 0.378, randomAny: 0.637 } as const;

/** อันดับเลข: ความถี่ต่องวดรวมทุกช่วง (น้อย = มาก่อน · เสมอ → เลขมาก) */
function coldOrder(history: VipDraw[], windows: readonly number[]) {
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const counts = Object.fromEntries(DIGITS10.map((d) => [d, windows.map((w) => sets.slice(-w).filter((s) => s.has(d)).length)])) as Record<string, number[]>;
  const score = (d: string) => windows.reduce((s, w, k) => s + counts[d][k] / w, 0);
  return { order: [...DIGITS10].sort((a, b) => score(a) - score(b) || Number(b) - Number(a)), counts };
}

function pickUk(history: VipDraw[], windows: readonly number[] = UK_WINDOWS, label = "สูตรอังกฤษ VIP"): VipPick | null {
  if (history.length < UK_MIN_HISTORY) return null;
  const { order, counts } = coldOrder(history, windows);
  const why = (d: string) => `${d} (ออก ${windows.map((w, k) => `${counts[d][k]}/${w}`).join(" · ")})`;
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  return {
    order, formula: windows.length > 1 ? "uk-cold-ens" : `uk-cold${windows[0]}`, label, digits: [order[0], order[1]],
    note: `เลขที่ออกน้อยช่วงสั้น (รวม ${windows.join("/")} งวด): ${why(order[0])}, ${why(order[1])} · อันดับถัดไป ${order.slice(2, 5).join(", ")} · ทดสอบ 1,278 งวด ★ ${pct(UK_BASE.starA)} ทั้งสองครึ่ง · 2 ตัว ${pct(UK_BASE.anyA)} / ${pct(UK_BASE.anyB)} (สุ่ม ${pct(UK_BASE.randomStar)} / ${pct(UK_BASE.randomAny)})`,
  };
}

/** เลขเจาะ: เลขที่ฟัน + เลขที่ออกน้อยรองลงมาตามอันดับเดียวกัน (ตัดคู่ของเมื่อวาน) ชุดละ 6 */
function drillUk(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const order = pick.order ?? coldOrder(history, UK_WINDOWS).order;
  const pos = Object.fromEntries(order.map((d, k) => [d, k])) as Record<string, number>;
  const prev = history[history.length - 1];
  const skip = prev ? [canon2(prev.top.slice(-2)), canon2(prev.bottom)] : [];
  const row = (d: string, taken: string[]) => DIGITS10.filter((x) => x !== d && !taken.includes(canon2(d + x)))
    .sort((x, y) => pos[x] - pos[y] || x.localeCompare(y))
    .slice(0, UK_DRILL_PER_DIGIT).map((x) => d + x);
  const [a, b] = pick.digits;
  const rowA = row(a, skip);
  const rowB = row(b, [...skip, ...rowA.map(canon2)]);
  return [{ digit: a, numbers: rowA }, { digit: b, numbers: rowB }];
}

export const ukFormula: MarketFormula = {
  name: "สูตรอังกฤษ VIP — เลขที่ออกน้อยช่วงสั้น (รวม 15/20/25/30/35 งวด)",
  evidence: "**วิเคราะห์จากเลขที่ออกของอังกฤษ VIP เองเท่านั้น** (1,378 งวด 25 พ.ย. 65–12 ต.ค. 69 จาก raakaadee ตรงกับเว็บต้นทาง) · เส้นสุ่มสูงกว่าตลาดอื่น (★ 38% · 2 ตัว 64%) · ราคาเปิด/ปิดเก็บอัตโนมัติจากกราฟของเว็บแต่ใช้ทายผลไม่ได้ (diff แถวผลถูกขยับ เหมือนตลาด VIP อื่น) · เลขที่ออกน้อยในช่วง 15–35 งวดชนะสุ่มทั้งสองครึ่ง: ★ 39.9% / 39.9% · 2 ตัว 66.7% / 67.3% · ปีล่าสุด 40.8% / 68.2% · เลขเย็นช่วงยาว ★ สูงกว่าแต่ติดเลข 3 เกือบครึ่งปี จึงไม่ใช้ · เลขร้อน เลขเมื่อวาน หายนานสุด มาร์คอฟ ไม่ชนะสุ่ม · เลขเจาะไม่มีวิธีไหนชนะสุ่มนิ่ง (~48%) · ได้เปรียบสุ่มน้อย (~2–4 จุด) · ย้อนหลังกำไรเฉลี่ย ~+200 ต่องวด (เลขละ 20) ทั้งสองครึ่ง ขาดทุนสะสมลึกสุด −45,600 · เว็บต้นทางเก็บผลย้อนหลังแค่ 5 วัน — ดึงผลอย่าให้ห่างเกิน 5 วัน",
  pick: (history) => pickUk(history),
  drill: drillUk,
  noManualOpen: true, // ผู้ใช้ไม่ต้องกรอกราคาเปิด (13 ต.ค. 69) — สูตรไม่ใช้ ระบบเก็บเองจากกราฟถ้าทัน
  minHistory: UK_MIN_HISTORY,
  drillRandom: 0.478,
};
