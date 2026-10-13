/**
 * สัญญากลางของ "สูตรต่อตลาด" — แต่ละตลาดมีไฟล์ของตัวเอง (formulas/<ตลาด>.ts) ไม่ import กันข้ามไฟล์
 * หน้า /vip เรียกผ่าน formulas/index.ts เท่านั้น
 */
export type VipDraw = { top: string; bottom: string; open?: number | null };
export type VipPick = {
  formula: string; label: string; digits: [string, string]; note: string;
  /** D สดของวันนั้น (ทศนิยมของราคาอ้างอิง = ราคา − diff) — ใช้เลือกเลขเจาะจากกรณีที่เป็นไปได้จริง */
  liveD?: number | null;
  /** อันดับเลข 0–9 ทั้งหมดของสูตร (ดี→แย่) — ตลาดที่มีใช้เลือกคู่ของเลขเจาะ */
  order?: string[];
};
export type VipDrillSet = { digit: string; numbers: string[] };
/** เลขเจาะที่ล็อกไว้ในแถว VipResult.drill (JSON) — ไม่มี/อ่านไม่ได้ = null (ให้คิดด้วยสูตรแทน) */
export function lockedDrill(json: string | null | undefined): VipDrillSet[] | null {
  if (!json) return null;
  try { const v = JSON.parse(json); return Array.isArray(v) && v.every((x) => typeof x?.digit === "string" && Array.isArray(x?.numbers)) ? v : null; } catch { return null; }
}
export type VipScore = { n: number; star: number; any: number };

export type MarketFormula = {
  /** ชื่อสูตรหลักที่แสดงบนการ์ด */
  name: string;
  /** สรุปหลักฐาน/ที่มาสั้น ๆ (แสดงใต้การ์ด) */
  evidence: string;
  /** ฟันงวดถัดไปจากประวัติ (เก่า→ใหม่) และราคาเปิดของงวดนั้น (ถ้ามี) — null ถ้าข้อมูลยังไม่พอ */
  /** round = รอบที่กำลังจะออก (1 = เช้า, 2 = บ่าย) — ตลาด 2 รอบต้องใช้ ไม่งั้นรอบบ่ายจะฟันเหมือนรอบเช้าตอนที่ผลเช้ายังไม่ออก */
  pick(history: VipDraw[], open?: number | null, round?: number, live?: { price?: number | null; diff?: number | null }): VipPick | null;
  /** สูตรทดลอง (ถ้ามี) — null ถ้าไม่มีสูตร/ข้อมูลไม่พอ */
  experimental?: { name: string; how: string; caveat: string; pick(open: number | null | undefined, history: VipDraw[]): VipPick | null };
  /** สูตรทดลองที่สอง — ใช้ผลของ "หุ้นปกติ" ของประเทศเดียวกันในวันเดียวกัน (ตลาดที่ผลปกติออกก่อน VIP) */
  experimental2?: { name: string; how: string; caveat: string; pick(regular: { top: string; bottom: string } | null | undefined): VipPick | null };
  /** เลขเจาะ 2 ตัว (กลับได้) จากเลขที่ฟัน */
  drill(pick: VipPick, history: VipDraw[]): VipDrillSet[];
  /** จำนวนงวดขั้นต่ำก่อนฟัน */
  minHistory: number;
  /**
   * วันที่ (YYYY-MM-DD) ที่สูตรปัจจุบันเริ่มล็อกเลข — เลขที่ล็อกไว้ก่อนวันนี้มาจากสูตรเก่า
   * หน้า /vip จะแสดงเลขของสูตรปัจจุบัน (ฟันย้อนหลังจากงวดก่อนหน้าเท่านั้น) แทน และโชว์เลขเก่าที่ล็อกไว้เป็นหมายเหตุ · ไม่ระบุ = ยึดเลขที่ล็อกทุกงวด
   */
  lockedFrom?: string;
  /** วันที่ (YYYY-MM-DD) ที่สูตรปัจจุบันเริ่มใช้ — โชว์ในหมายเหตุของงวดที่ไม่มีเลขล็อก (เลขคิดย้อนหลังด้วยสูตรนี้) */
  since?: string;
  /** สูตรทุกช่องของตลาดนี้ไม่ใช้ราคาเปิด → ซ่อนปุ่ม "ใส่ราคาเปิด" ในตาราง (ราคาที่ระบบเก็บเองยังแสดงอยู่) */
  noManualOpen?: boolean;
  /** โอกาส "เจาะมา" ถ้าเลือกคู่แบบสุ่ม (วัดจากข้อมูลของตลาดนั้น) — ไม่ระบุ = ป้ายเดิม ~42% */
  drillRandom?: number;
};

export const DIGITS10 = "0123456789".split("");
/** เลขที่ "ออก" ของงวด = เลขโดดใน 2 ตัวบน (2 หลักท้ายของบน 3) + 2 ตัวล่าง — หลักร้อยของบนไม่นับ (ผู้ใช้แทงจาก 2 ตัวบน/ล่าง) */
export const resultDigits = (top: string, bottom: string) => [...new Set((top.slice(-2) + bottom).split(""))];
export const canon2 = (m: string) => (m[0] <= m[1] ? m : m[1] + m[0]);
/** เลข 2 ตัว m มาไหม: เท่ากับ 2 ตัวบน (2 หลักท้ายของบน 3) หรือ 2 ตัวล่าง ตรงหรือกลับ */
export const drillHit = (m: string, top: string, bottom: string) => canon2(m) === canon2(top.slice(-2)) || canon2(m) === canon2(bottom);
/** โอกาสถ้าสุ่ม: เลขหนึ่งอยู่ในผล 4 หลัก (2 บน + 2 ล่าง) ≈ 34% · อย่างน้อย 1 ใน 2 ≈ 59% */
export const RANDOM_ONE = 1 - Math.pow(0.9, 4);
export const RANDOM_TWO = 1 - Math.pow(0.8, 4);

/** คะแนน walk-forward ของสูตรหลัก + สูตรทดลอง (งวดที่ i ใช้เฉพาะงวดก่อนหน้า) */
export function gradeFormula(f: MarketFormula, history: VipDraw[]): { main: VipScore; experimental: VipScore; drill: { n: number; hit: number } } {
  const main: VipScore = { n: 0, star: 0, any: 0 }, experimental: VipScore = { n: 0, star: 0, any: 0 }, drill = { n: 0, hit: 0 };
  const score = (s: VipScore, p: VipPick | null, d: VipDraw) => {
    if (!p) return;
    const digits = resultDigits(d.top, d.bottom);
    s.n++; if (digits.includes(p.digits[0])) s.star++; if (p.digits.some((x) => digits.includes(x))) s.any++;
  };
  for (let i = 0; i < history.length; i++) {
    const hist = history.slice(0, i), d = history[i];
    const p = f.pick(hist, d.open);
    score(main, p, d);
    if (p) { drill.n++; if (f.drill(p, hist).some((s) => s.numbers.some((m) => drillHit(m, d.top, d.bottom)))) drill.hit++; }
    if (f.experimental) score(experimental, f.experimental.pick(d.open, hist), d);
  }
  return { main, experimental, drill };
}
