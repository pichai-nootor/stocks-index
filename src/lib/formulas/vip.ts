/**
 * สูตรฟันเลขของ "หุ้น VIP" — แยกจากสูตร SENSEX (src/lib/digits.ts, stats.ts) โดยสิ้นเชิง ไม่ import กัน
 * ผล VIP = บน 3 หลัก + ล่าง 2 หลัก → เลขที่ออก = เลขโดดใน 2 ตัวบน (2 หลักท้าย) + 2 ตัวล่าง (หลักร้อยของบนไม่นับ)
 *
 * มี 2 สูตร ให้ระบบเก็บคะแนนคู่กัน (walk-forward: งวดที่ i ใช้เฉพาะงวดก่อนหน้า) — ยังไม่มีสูตรไหนพิสูจน์ได้ว่าชนะสุ่ม
 *   A. เลขร้อน       — 2 เลขที่ออกบ่อยสุดในผลที่เก็บไว้
 *   B. จากตัวเปิด    — สมมติว่าล่าง = ทศนิยม(ปิด − เปิด) เหมือนที่ฟีดทำระหว่างวัน → D = ทศนิยมของเปิด แล้วไล่ทุกกรณี
 *                      (ตรวจแล้ว 18 ก.ย. 69 แถวผลของเว็บไม่ตรงสูตรนี้ จึงเป็นแค่สมมติฐาน รอคะแนนตัดสิน)
 */

import genericModel from "@/data/vip-history/generic-model.json";
import genericDailyModel from "@/data/vip-history/generic-daily-model.json";
import { DIGITS10 as DIGITS, resultDigits, canon2, RANDOM_ONE, RANDOM_TWO, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";
export type { VipDraw, VipPick } from "./types";

export const VIP_MIN_HISTORY = 7;
export const VIP_RANDOM_ONE = RANDOM_ONE;
export const VIP_RANDOM_TWO = RANDOM_TWO;

const uniq = (s: string) => [...new Set(s.split(""))];
/** เลขโดดในผล (บน 3 + ล่าง 2) */
export const vipResultDigits = resultDigits;

/* ---------- A. โมเดลรวม (เรียนจากจีน+ฮั่งเส็ง 3,800 งวด) — ใช้กับตลาดที่ประวัติยังน้อย ---------- */

/**
 * เครื่องออกเลขของ VIP ทุกตลาดที่ตรวจมีนิสัยเดียวกัน (โมเดลที่ฝึกด้วยฮั่งเส็งทายจีนได้ 35.9%, ฝึกด้วยจีนทายฮั่งเส็งได้ 34.4%)
 * จึงรวมประวัติจีน+ฮั่งเส็ง ฝึกโมเดล logistic 35 ตัวแปรที่ "ไม่ใช้ตัวเลขเอง" (ใช้แต่พฤติกรรม: ออกใน 1–6 งวดก่อน, ตำแหน่งใน 2 งวดก่อน,
 * ความถี่ 30/100 งวด, หายกี่งวด, รอบ, วัน, เลขคณิตกับงวดก่อน) → ทดสอบนอกตัวอย่าง: ฮั่งเส็ง ★ 36.5% / จีน 36.6% (สุ่ม 34.4%)
 * ใช้กับอินเดีย/นิเคอิ/ไต้หวัน/เกาหลี ที่ยังไม่มีประวัติพอฝึกเอง — เป็นการยืมนิสัยเครื่อง ยังต้องพิสูจน์กับตลาดนั้นด้วยคะแนนสะสม
 * เดิมใช้ "เลขร้อน" (ออกบ่อยใน 15 งวด) วัดแล้วได้ 31.6–31.9% แย่กว่าสุ่ม จึงเลิก · น้ำหนักอยู่ใน src/data/vip-history/generic-model.json (ml5.py)
 *
 * **(27 ก.ย. 69) แยกโมเดลของ "ตลาดวันละรอบ" ออกมา** — generic-daily-model.json
 *   ปัญหา: โมเดลรวมตัวเดิมฝึกจากตลาด 2 รอบ/วัน ตัวแปรที่แรงที่สุดคือ "ออกใน 1–6 งวดก่อน" กับ "ตำแหน่งใน 2 งวดก่อน"
 *   ซึ่งของจีน/ฮั่งเส็ง/นิเคอิ "งวดก่อนหน้า" มักหมายถึง *อีกรอบของวันเดียวกัน* แต่ของอินเดีย/ไต้หวัน/เกาหลีหมายถึง *เมื่อวาน* → คนละนิสัยกัน
 *   แก้: ฝึกโมเดลอีกตัวจาก "รอบสุดท้ายของวัน" เท่านั้น ลำดับงวดจึงเป็นวันต่อวันแบบเดียวกับตลาดวันละรอบ
 *   วัดจริงโดยกันเกาหลี (1,364 งวด วันละรอบ ไม่อยู่ในชุดฝึก) ไว้ทดสอบ:
 *     ฝึกจากทุกรอบ (แบบเดิม)      ★ 35.1% · 2 ตัว 57.9%   (สุ่ม 32.9 / 57.1) → ช่อง 2 ตัวแทบไม่ต่างจากสุ่ม
 *     ฝึกจากรอบสุดท้ายของวัน       ★ 36.6% · 2 ตัว 60.8%   → ดีขึ้น +1.5 / +2.9 จุด
 *   ⚠ ยังไม่ผ่านเกณฑ์นัยสำคัญ: McNemar ★ p = 0.41 · 2 ตัว p = 0.098 · แบ่ง 4 ช่วงแล้วชนะชัดเฉพาะช่วงที่ 3 (อีก 2 ช่วงดีขึ้นนิดเดียว ช่วงสุดท้ายแย่กว่าเล็กน้อย)
 *   → เลือกใช้เพราะ "เข้ากับโครงสร้างตลาดมากกว่า + ดีขึ้นทั้งสองค่า + ไม่เคยแย่ลงมาก" ไม่ใช่เพราะพิสูจน์ได้แล้ว ต้องเก็บคะแนนจริงต่อ
 *   โมเดลตัวจริงฝึกจาก 5,451 งวด (รอบสุดท้ายของวันของจีน+ฮั่งเส็ง+นิเคอิ + เกาหลีทั้งหมด) — ตัวเลขข้างบนคือค่าที่วัดตอนกันเกาหลีออก
 */
const GW = genericModel.coef as number[];
const GB = genericModel.intercept as number;
const GDW = genericDailyModel.coef as number[];
const GDB = genericDailyModel.intercept as number;
/** ตลาดนี้ออกวันละรอบเดียวไหม — ไม่มีงวด "รอบเช้า" ในประวัติเลย (อินเดีย/ไต้หวัน/เกาหลี) */
const isDailyMarket = (history: VipDraw[]) => !history.some((h) => (h as DrawMeta).round === 1);
type DrawMeta = { round?: number; date?: Date | string; weekday?: number };
const weekdayOf = (d: DrawMeta) => d.weekday ?? (d.date ? (new Date(d.date).getUTCDay() + 6) % 7 : 1);

function genericFeatures(history: VipDraw[], d: string, round: number, weekday: number): number[] {
  const n = history.length;
  const at = (j: number) => history[n - j];
  const has = (h: VipDraw, x: string) => vipResultDigits(h.top, h.bottom).includes(x);
  const f: number[] = [];
  for (let j = 1; j <= 6; j++) f.push(j <= n && has(at(j), d) ? 1 : 0);
  for (let j = 1; j <= 2; j++) { const h = at(j); const t = h.top.slice(-2), b = h.bottom; f.push(h.top[0] === d ? 1 : 0, t[0] === d ? 1 : 0, t[1] === d ? 1 : 0, b[0] === d ? 1 : 0, b[1] === d ? 1 : 0); }
  let c30 = 0, c100 = 0;
  for (let j = 1; j <= 100 && j <= n; j++) { if (has(at(j), d)) { c100++; if (j <= 30) c30++; } }
  f.push(c30, c100);
  let gap = 0;
  for (let j = 1; j < 200; j++) { if (j > n || has(at(j), d)) break; gap++; }
  f.push(Math.min(gap, 50));
  f.push(round);
  for (let w = 0; w < 7; w++) f.push(weekday === w ? 1 : 0);
  const p = at(1); const pt = p.top.slice(-2), pb = p.bottom; const di = Number(d);
  const n0 = (x: number) => ((x % 10) + 10) % 10;
  f.push(di === n0(Number(pt[0]) + Number(pt[1])) ? 1 : 0, di === n0(Number(pb[0]) + Number(pb[1])) ? 1 : 0, di === Math.abs(Number(pt[0]) - Number(pt[1])) ? 1 : 0, di === Math.abs(Number(pb[0]) - Number(pb[1])) ? 1 : 0,
    di === n0(Number(pt[1]) + 1) ? 1 : 0, di === n0(Number(pt[1]) - 1) ? 1 : 0, di === n0(Number(pb[1]) + 1) ? 1 : 0, di === n0(Number(pb[1]) - 1) ? 1 : 0);
  return f;
}

/** ค่าพยากรณ์ของเลข 0–9 สำหรับงวดถัดไปจากโมเดลรวม (เรียงมาก→น้อย) */
export function genericScores(history: VipDraw[], round = 2, weekday = 1): { digit: string; p: number }[] {
  return DIGITS.map((d) => { const x = genericFeatures(history, d, round, weekday); const z = x.reduce((s, v, i) => s + v * GW[i], GB); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; }).sort((a, b) => b.p - a.p || b.digit.localeCompare(a.digit));
}

/** เหมือน genericScores แต่ใช้โมเดลที่ฝึกจาก "รอบสุดท้ายของวัน" — สำหรับตลาดที่ออกวันละรอบ (งวดก่อนหน้า = เมื่อวาน) */
export function genericDailyScores(history: VipDraw[], weekday = 1): { digit: string; p: number }[] {
  return DIGITS.map((d) => { const x = genericFeatures(history, d, 2, weekday); const z = x.reduce((s, v, i) => s + v * GDW[i], GDB); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; }).sort((a, b) => b.p - a.p || b.digit.localeCompare(a.digit));
}

export function vipHotPick(history: VipDraw[]): VipPick | null {
  if (history.length < VIP_MIN_HISTORY) return null;
  const last = history[history.length - 1] as VipDraw & DrawMeta;
  const daily = isDailyMarket(history);
  // ตลาดวันละรอบ: งวดถัดไปคือ "รอบสุดท้ายของวันพรุ่งนี้" เสมอ → round = 2 ตรงกับที่ฝึก
  // (เดิมโค้ดให้ round = 1 กับตลาดพวกนี้ ขัดกับคอมเมนต์ของตัวเองและขัดกับข้อมูลที่ใช้ฝึก)
  const round = daily ? 2 : last.round === 1 ? 2 : 1;
  const wd = weekdayOf(last); const weekday = last.round === 1 ? wd : (wd + 1) % 7;
  const s = daily ? genericDailyScores(history, weekday) : genericScores(history, round, weekday);
  const src = daily ? "โมเดลรวมวันละรอบ (นิสัยเครื่องจากรอบสุดท้ายของวัน จีน+ฮั่งเส็ง+นิเคอิ+เกาหลี 5,451 งวด)" : "โมเดลรวม (นิสัยเครื่องจากจีน+ฮั่งเส็ง)";
  // ตลาดที่ประวัติของตัวเองยังน้อย: ค่าอ้างอิงมาจากเกาหลี ไม่ใช่จากตลาดนี้ — และจะ "พิสูจน์ด้วยสถิติของตลาดนี้เอง" ต้องใช้งวดเยอะมาก
  //   ★ 33.0% → 37.3% ต้อง 911 งวด · 2 ตัว 57.1% → 60.9% ต้อง 1,321 งวด (นัยสำคัญ 5% power 80%) → ไต้หวันออกวันละงวด = 2.5–3.6 ปี
  //   ดังนั้นอย่าตัดสินสูตรจากสถิติของตลาดเล็ก ให้ดูว่าไม่เพี้ยนไปจากค่าอ้างอิงมาก ๆ พอ
  const bench = daily
    ? ` · วัดกับเกาหลีที่โมเดลไม่เคยเห็น 1,264 งวด: ★ 36.6% · 2 ตัว 60.8% (สุ่ม 32.9 / 57.1)`
      + (history.length < 100 ? ` · ⚠ ตลาดนี้มีประวัติแค่ ${history.length} งวด — ตัวเลขข้างต้นเป็นค่าอ้างอิงจากเกาหลี ไม่ใช่ผลของตลาดนี้ (จะพิสูจน์ด้วยสถิติของตลาดนี้เองต้องใช้ ~900 งวดขึ้นไป) อย่าตัดสินจากผลไม่กี่งวด` : "")
    : "";
  return { formula: "hot", label: daily ? "โมเดลรวมวันละรอบ" : "โมเดลรวม", digits: [s[0].digit, s[1].digit], note: `${src} ให้ ${s[0].digit}: ${(100 * s[0].p).toFixed(1)}% · ${s[1].digit}: ${(100 * s[1].p).toFixed(1)}% (สุ่ม 33%) · อันดับถัดไป ${s.slice(2, 5).map((x) => `${x.digit} ${(100 * x.p).toFixed(0)}%`).join(", ")}${bench}` };
}

/* ---------- B. จากตัวเปิด (โครงสร้าง ล่าง = ปิด − เปิด) ---------- */

const pad2 = (n: number) => String(((n % 100) + 100) % 100).padStart(2, "0");
/** ทศนิยม 2 หลักของราคาเปิด */
export const vipOpenCents = (open: number) => Math.round(Math.abs(open) * 100) % 100;

/**
 * ไล่ทุกกรณี: ทศนิยมปิด 00–99 × ทิศทาง (ปิดสูง/ต่ำกว่าเปิด) = 200 กรณี น้ำหนักเท่ากัน
 *   ล่าง = (ปิดcents − D) ถ้าขึ้น, (D − ปิดcents) ถ้าลง (mod 100) · 2 ตัวบน = ปิดcents (หลักร้อยไม่นับ)
 * แล้วนับว่าเลข 0–9 โผล่ในผลกี่ % — เลือก 2 ตัวที่ "อย่างน้อย 1 โผล่" สูงสุด
 */
export function vipOpenProbs(open: number): { digit: string; p: number }[] {
  const D = vipOpenCents(open);
  const count: Record<string, number> = {};
  let total = 0;
  for (let c = 0; c < 100; c++) for (const up of [true, false]) {
    const bottom = pad2(up ? c - D : D - c);
    const set = uniq(pad2(c) + bottom);
    for (const d of set) count[d] = (count[d] ?? 0) + 1;
    total++;
  }
  return DIGITS.map((digit) => ({ digit, p: (count[digit] ?? 0) / total })).sort((x, y) => y.p - x.p || y.digit.localeCompare(x.digit));
}

export function vipOpenPick(open: number | null | undefined): VipPick | null {
  if (open === null || open === undefined || !Number.isFinite(open)) return null;
  const D = vipOpenCents(open);
  const probs = vipOpenProbs(open);
  // ตัวคู่: ตัวที่ทำให้ "อย่างน้อย 1 ใน 2 โผล่" สูงสุด เมื่อจับกับตัวแรก
  const first = probs[0].digit;
  let best: { d: string; any: number } | null = null;
  for (const { digit } of probs.slice(1)) {
    let any = 0, total = 0;
    for (let c = 0; c < 100; c++) for (const up of [true, false]) {
      const set = pad2(c) + pad2(up ? c - D : D - c);
      if (set.includes(first) || set.includes(digit)) any++;
      total++;
    }
    if (!best || any / total > best.any + 1e-12) best = { d: digit, any: any / total };
  }
  return { formula: "open", label: "B. จากตัวเปิด", digits: [first, best!.d], note: `D = ${pad2(D)} · โมเดลให้ ${Math.round(probs[0].p * 100)}% / อย่างน้อย 1 ${Math.round((best!.any) * 100)}%` };
}

/* ---------- คะแนนย้อนหลังของทั้ง 2 สูตร ---------- */

export type VipScore = { n: number; star: number; any: number };
export type VipGrade = { hot: VipScore; open: VipScore };

/** history เรียงเก่า→ใหม่ · สูตร B ให้คะแนนเฉพาะงวดที่รู้ราคาเปิด */
export function gradeVipFormulas(history: VipDraw[]): VipGrade {
  const hot: VipScore = { n: 0, star: 0, any: 0 }, open: VipScore = { n: 0, star: 0, any: 0 };
  const score = (s: VipScore, pick: VipPick | null, draw: VipDraw) => {
    if (!pick) return;
    const digits = vipResultDigits(draw.top, draw.bottom);
    s.n++; if (digits.includes(pick.digits[0])) s.star++; if (pick.digits.some((d) => digits.includes(d))) s.any++;
  };
  for (let i = 0; i < history.length; i++) {
    score(hot, vipHotPick(history.slice(0, i)), history[i]);
    score(open, vipOpenPick(history[i].open), history[i]);
  }
  return { hot, open };
}

/* ---------- เลขเจาะ (เลข 2 ตัว) ของ VIP — กลับได้ ---------- */

export const VIP_DRILL_PER_DIGIT = 6;
export type { VipDrillSet } from "./types";
const canon = canon2;

/**
 * เจาะจากเลขที่ฟัน: ชุดละ 6 เลข "dX" โดย X = เลขอื่นเรียงตามความร้อน (ความถี่ในผลที่เก็บ) เลขคู่ที่ฟันอีกตัวมาก่อน
 * dX กับ Xd นับเป็นเลขเดียวกัน (กลับได้) จึงไม่ซ้ำข้ามชุด — ทุกเลข 2 ตัวมีโอกาสใกล้เคียงกัน ชุดนี้คือ "ไม่แย่กว่าสุ่ม" ไม่ใช่สูตรทำนาย
 */
export function vipDrill(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const counts: Record<string, number> = {};
  for (const h of history) for (const d of vipResultDigits(h.top, h.bottom)) counts[d] = (counts[d] ?? 0) + 1;
  const [a, b] = pick.digits;
  const used = new Set<string>();
  const set = (d: string, other: string): VipDrillSet => {
    const partners = DIGITS.filter((x) => x !== d && !used.has(canon(d + x)))
      .sort((x, y) => (x === other ? -1 : y === other ? 1 : 0) || (counts[y] ?? 0) - (counts[x] ?? 0) || x.localeCompare(y))
      .slice(0, VIP_DRILL_PER_DIGIT);
    const numbers = partners.map((x) => d + x);
    for (const m of numbers) used.add(canon(m));
    return { digit: d, numbers };
  };
  return [set(a, b), set(b, a)];
}

/** เลข 2 ตัว m มาไหม: เท่ากับ 2 ตัวบน (2 หลักท้ายของบน 3) หรือ 2 ตัวล่าง ตรงหรือกลับ */
export function vipDrillHit(m: string, top: string, bottom: string) {
  const t2 = top.slice(-2);
  return canon(m) === canon(t2) || canon(m) === canon(bottom);
}

/** สูตรทั่วไป (ใช้กับอินเดีย VIP และตลาดที่ยังไม่มีไฟล์ของตัวเอง) ในรูปแบบสัญญากลาง */
export const genericFormula: MarketFormula = {
  name: "สูตร VIP ทั่วไป — โมเดลรวมนิสัยเครื่อง (เรียนจากจีน+ฮั่งเส็ง 3,800 งวด)",
  evidence: "ใช้กับตลาดที่ประวัติยังไม่พอฝึกเอง: เครื่องออกเลขของ VIP ทุกตลาดที่ตรวจมีนิสัยเดียวกัน (โมเดลที่ฝึกด้วยฮั่งเส็งทายจีนได้ 35.9%) จึงรวมจีน+ฮั่งเส็งฝึกโมเดล 35 ตัวแปรที่ใช้แต่พฤติกรรม ไม่ใช้ตัวเลขเอง — ทดสอบนอกตัวอย่าง ★ 36.5–36.6% / 2 ตัว 61–62% (สุ่ม 34.4 / 59) · วิเคราะห์ใหม่ทุกงวดจากผลล่าสุด 1–6 งวด, ตำแหน่ง, ความถี่, หายกี่งวด, รอบ, วัน · กับตลาดนี้ยังต้องพิสูจน์ด้วยคะแนนสะสม",
  pick: vipHotPick,
  experimental: {
    name: "สูตรทดลอง B (จากทศนิยมราคาเปิด)",
    how: "ระหว่างวันฟีดของเว็บใช้กฎ ล่าง = ทศนิยม(ราคา − เปิด) ถ้าผลสุดท้ายใช้กฎเดียวกัน เลขล่างจะถูกบังคับด้วย D (ทศนิยมของราคาเปิด) → ไล่ทุกกรณี ทศนิยมปิด 00–99 × ขึ้น/ลง = 200 กรณี แล้วนับว่าเลขไหนโผล่บ่อยสุด",
    caveat: "วัน D ส่วนใหญ่เลขเสมอกัน 6–8 ตัว ตัวที่แสดงคือกฎตัดสินเสมอ “เลขมากก่อน” ไม่ใช่สัญญาณ · และ 18–19 ก.ย. 69 ผลจริงของเว็บไม่ตรงกฎนี้ → ให้คะแนนสะสมเป็นตัวตัดสิน",
    pick: (open) => vipOpenPick(open),
  },
  drill: vipDrill,
  minHistory: VIP_MIN_HISTORY,
};
