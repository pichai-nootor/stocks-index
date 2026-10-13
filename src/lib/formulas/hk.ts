/**
 * สูตรของ "หุ้นฮั่งเส็ง VIP" (เช้า 10:35 / บ่าย 15:25 ไทย) — ไฟล์นี้ใช้เฉพาะตลาดนี้ ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม = 34.4% ต่อเลข, 2 ตัว ≥1 = 59%
 *
 * **คืนสูตรนี้ 13 ต.ค. 69 (ผู้ใช้สั่ง "ถ้าตัวเก่าดีกว่าเอาสูตรตัวเก่าได้เลย")** — 11–13 ต.ค. เคยเปลี่ยนเป็น "ฝึกใหม่เองจาก 1,000 งวดล่าสุดทุก 100 งวด"
 *   เทียบสองสูตรกับงวดชุดเดียวกัน (ทุกงวดหลัง 27 ก.ย. ที่โมเดลนี้ไม่เคยเห็น 32 งวด · รูด+เจาะ เลขละ 20):
 *     สูตรนี้ (น้ำหนักตายตัว)  ★ 44% · 2 ตัว 66% · เจาะ 56% · กำไรรวม +26,640
 *     ฝึกใหม่เอง 1,000 งวด     ★ 38% · 2 ตัว 59% · เจาะ 56% · กำไรรวม +6,640  (6 งวดที่ใช้จริง 11–13 ต.ค.: 2 ตัว 2/6 · −4,880)
 *   ทดสอบย้อนหลังยาว ๆ สองแบบต่างกันแค่ 1–3 จุด (อยู่ในช่วงแกว่ง) → ยึดผลจริงหลังฝึก · ตัวฝึกใหม่เก็บไว้ที่ scratchpad (hk.ts.retrain-version) ถ้าจะทดสอบอีก
 *   ⚠ งวดน้อย (32) — ทบทวนอีกครั้งตอนรีวิวรายเดือน (พ.ย. 69) และควรฝึกโมเดลนี้ใหม่เมื่อเริ่มอ่อน
 *
 * วิธีคิด: โมเดลเรียนรู้ (logistic regression) จากประวัติ 2,708 งวด (25 พ.ย. 2565 → 18 ก.ย. 2569) ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปร:
 *   เลขนี้ออกใน 1–6 งวดก่อนไหม · อยู่ตำแหน่งไหนของ 2 งวดก่อน (หลักร้อย/สิบ/หน่วย บน-ล่าง) · ออกกี่ครั้งใน 30/100 งวด · หายมากี่งวด
 *   ตัวเลขนั้นเอง (เครื่องออก 9 น้อย 2/4 มาก) · รอบเช้า/บ่าย · วันในสัปดาห์ · ความสัมพันธ์เลขคณิตกับงวดก่อน (ผลรวมหลัก ผลต่าง ±1)
 * **ฝึกใหม่ 27 ก.ย. 69 ด้วยประวัติ 2,725 งวด (ถึง 27 ก.ย.)** — เดิมฝึกถึง 23 ก.ย. และไฟล์ประวัติแนบมาหยุดที่ 18 ก.ย.
 *   วัดผลแบบฝึกโมเดลใหม่ทุก fold (expanding window 6 ช่วง × 250 = 1,500 งวดที่โมเดลไม่เคยเห็นเลย ไม่ใช่ in-sample):
 *     ทุกงวด        ★ 36.7% · 2 ตัว 64.7%   (เส้นสุ่มของชุดเดียวกัน ★ 33.2% · สุ่มคู่ 57.6%) → เหนือสุ่ม +3.5 / +7.1 จุด
 *     ความมั่นใจของโมเดลเรียงตรงแล้ว (เดิมไม่เรียง): ≥40.8% → ★ 37.1% · ≥42.0% → 38.8% · ≥43.0% → 39.0% · ≥43.6% → 41.1%
 *     → ขยับเกณฑ์ "งวดแข็ง" 40.8% → **43.6%** (ติด 9.7% ของงวด n=146 ★ 41.1% CI 33.4–49.2 · 2 ตัว 69.2%) งวดที่เหลือ ★ 36.3% · 2 ตัว 64.2%
 *        เกณฑ์เดิม 40.8% ติดถึง 40% ของงวดแต่ได้ ★ แค่ 37.1% เทียบกับงวดที่เหลือ 36.5% = แทบไม่ต่าง จึงใช้เป็นสัญญาณลงหนักไม่ได้
 *     แยกตาม fold ที่เกณฑ์ 43.6%: ★ 40.4 / 40.0 / 46.2 / 62.5 / 45.5 / 25.0% — 5 ใน 6 ช่วงเกิน 40% (ช่วงท้าย n=24 ต่ำ ต้องดูต่อ)
 *   ⚠ 500 งวดล่าสุดทั้งโมเดลยังอ่อน: ★ 34.4% · 2 ตัว 61.4% (สุ่ม 33.2 / 57.6) — แต่เฉพาะงวดแข็งในช่วงนั้นได้ ★ 38.2% ยังพอมีขอบ
 *   ตัวเลขเก่าบนการ์ด (★ 35.6% / งวดแข็ง 40.6% / "1 ใน 4") มาจากโมเดลรุ่นก่อนและสูงเกินจริง — แทนที่ด้วยตัวเลขข้างบนทั้งหมดแล้ว
 *   ขั้นตอนฝึกตรวจแล้วตรงกับ ml3.py เดิม: ฝึกด้วยข้อมูลถึง 23 ก.ย. เท่ากัน ได้เวกเตอร์น้ำหนัก cosine 0.988 กับโมเดลเก่า
 * สิ่งที่โมเดลพบว่าสำคัญสุด: ตัวเลขเอง (9 ต่ำ, 2 กับ 4 สูง), เลขที่เป็นหลักหน่วยของล่างใน 1–2 งวดก่อนจะออกน้อยลง (เครื่องเลี่ยงซ้ำ)
 * เลข 2 ตัว: เครื่องเลี่ยงเบิ้ล (140 vs 271), ล่างหยิบหลักจากบน (438/420 vs 271), ไม่ซ้ำเลขงวดก่อน, การกระจายเอียงถาวร chi² 186 → เจาะจากอันดับความเอียง
 * น้ำหนักโมเดลอยู่ใน src/data/vip-history/hk-model.json (ฝึกใหม่ด้วยสคริปต์ ml3.py เมื่อประวัติเพิ่ม)
 *
 * สิ่งที่ทดสอบแล้ว "ไม่เอา" (27 ก.ย. 69) — อย่าเสียเวลาทำซ้ำ:
 *   1. กฎของจีน "รอบบ่ายตัดเลขที่ออกรอบเช้า" ใช้กับฮั่งเส็งไม่ได้ · ฮั่งเส็งเลี่ยงซ้ำ *ข้ามวัน* มากกว่าในวันเดียวกัน:
 *      เลขบ่ายวันก่อน → เช้าวันถัดไป 30.9% (เลขที่ไม่ออก 33.9%) แต่ เช้า → บ่าย 32.3% (เลขที่ไม่ออก 33.5%) — จีนคือ 31.0% vs 34.1%
 *      เติมกฎตัดเลขงวดก่อนทับโมเดล 1,254 งวด/รอบ: เช้า ★ 38.0→38.4% / 2 ตัว 62.6→63.5% · บ่าย ★ 38.3→38.9% / 2 ตัว 66.7→65.6%
 *      McNemar p = 0.19–0.57 ทุกช่อง = ไม่มีนัยสำคัญ (ตัวเลขดิบสูงเพราะ in-sample) → โมเดลดูดนิสัยนี้ไปแล้วผ่านตัวแปร "ออกใน 1–6 งวดก่อน"
 *   2. ใช้ราคาปิด/diff ที่เก็บได้มาคำนวณ "ล่าง" ล่วงหน้าไม่ได้ · ล่าง = ทศนิยมของ (ปิด − ฐาน) และฐานคือราคาเปิดที่เว็บไม่ประกาศ
 *      ฐานของรอบเช้ากับบ่ายต่างกัน 0.07–1.22 จุด (7 วันที่มีราคาครบ) → ทศนิยมฐานเดาไม่ได้ · ทดสอบตรง ๆ 1,353 วัน: ล่างผูกกับบน 1.5–1.9% = เส้นสุ่ม
 */
import model from "@/data/vip-history/hk-model.json";
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const HK_MIN_HISTORY = 100;
export const HK_DRILL_PER_DIGIT = 6;
/** เกณฑ์ "งวดแข็ง" จากการทดสอบนอกตัวอย่าง */
export const HK_STRONG = 0.436;
/** ทุกตัวเลขมาจากการทดสอบนอกตัวอย่าง 1,500 งวด (ฝึกใหม่ทุก fold) — ดูหัวไฟล์ */
export const HK_BASE = { star: 0.367, any: 0.647, strongStar: 0.411, strongAny: 0.692, weakStar: 0.363, weakAny: 0.642, randomStar: 0.332, randomAny: 0.576, recentStar: 0.344, recentAny: 0.614, recentStrongStar: 0.382 } as const;

type Draw = { top: string; bottom: string; round?: number; weekday?: number; date?: Date | string };
const W = model.coef as number[];
const B = model.intercept as number;

/** ฟีเจอร์ 45 ตัวของเลข d ณ งวดถัดไป — ต้องเรียงเหมือน ml.py เป๊ะ */
function features(history: VipDraw[], d: string, round: number, weekday: number): number[] {
  const n = history.length;
  const at = (j: number) => history[n - j]; // j = 1 คือ งวดก่อนหน้า
  const has = (h: VipDraw, x: string) => resultDigits(h.top, h.bottom).includes(x);
  const f: number[] = [];
  for (let j = 1; j <= 6; j++) f.push(has(at(j), d) ? 1 : 0);
  for (let j = 1; j <= 2; j++) { const h = at(j); const t = h.top.slice(-2), b = h.bottom; f.push(h.top[0] === d ? 1 : 0, t[0] === d ? 1 : 0, t[1] === d ? 1 : 0, b[0] === d ? 1 : 0, b[1] === d ? 1 : 0); }
  let c30 = 0, c100 = 0;
  for (let j = 1; j <= 100 && j <= n; j++) { if (has(at(j), d)) { c100++; if (j <= 30) c30++; } }
  f.push(c30, c100);
  let gap = 0;
  for (let j = 1; j < 200; j++) { if (j > n || has(at(j), d)) break; gap++; }
  f.push(Math.min(gap, 50));
  for (const x of DIGITS10) f.push(x === d ? 1 : 0);
  f.push(round);
  for (let w = 0; w < 7; w++) f.push(weekday === w ? 1 : 0);
  const p = at(1); const pt = p.top.slice(-2), pb = p.bottom; const di = Number(d);
  const n0 = (x: number) => ((x % 10) + 10) % 10;
  f.push(di === n0(Number(pt[0]) + Number(pt[1])) ? 1 : 0, di === n0(Number(pb[0]) + Number(pb[1])) ? 1 : 0, di === Math.abs(Number(pt[0]) - Number(pt[1])) ? 1 : 0, di === Math.abs(Number(pb[0]) - Number(pb[1])) ? 1 : 0,
    di === n0(Number(pt[1]) + 1) ? 1 : 0, di === n0(Number(pt[1]) - 1) ? 1 : 0, di === n0(Number(pb[1]) + 1) ? 1 : 0, di === n0(Number(pb[1]) - 1) ? 1 : 0);
  return f;
}

/** ค่าพยากรณ์ 0–1 ของเลข 0–9 สำหรับงวดถัดไป (เรียงมาก→น้อย) */
export function hkScores(history: VipDraw[], round = 2, weekday = 1): { digit: string; p: number }[] {
  return DIGITS10.map((d) => { const x = features(history, d, round, weekday); const z = x.reduce((s, v, i) => s + v * W[i], B); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; }).sort((a, b) => b.p - a.p || b.digit.localeCompare(a.digit));
}

/** วันในสัปดาห์แบบ python (จันทร์ = 0) จากแถวประวัติ */
const weekdayOf = (d: Draw) => d.weekday ?? (d.date ? (new Date(d.date).getUTCDay() + 6) % 7 : 1);

/** งวดถัดไป: ถ้างวดสุดท้ายเป็นรอบเช้า → รอบบ่าย วันเดียวกัน; ถ้ารอบบ่าย → รอบเช้า วันถัดไป */
function nextRoundInfo(history: (VipDraw & Draw)[]): { round: number; weekday: number } {
  const last = history[history.length - 1] as Draw;
  const round = last.round === 1 ? 2 : 1;
  const wd = weekdayOf(last);
  return { round, weekday: last.round === 1 ? wd : (wd + 1) % 7 };
}

function pickHk(history: VipDraw[], _open?: number | null, forRound?: number): VipPick | null {
  if (history.length < HK_MIN_HISTORY) return null;
  // รอบที่หน้าจอถามมาสำคัญกว่าการเดาจากประวัติ: ตอนผลรอบเช้ายังไม่ออก ประวัติจะชี้ว่า "งวดถัดไป = เช้า" ทั้งสองแผง
  // ทำให้ตัวแปร "รอบ" กับ "วันในสัปดาห์" ของรอบบ่ายเพี้ยนเป็นของเช้าวันถัดไป (จีน/นิเคอิรับ forRound อยู่แล้ว ฮั่งเส็งตกไป)
  const guess = nextRoundInfo(history as (VipDraw & Draw)[]);
  const round = forRound ?? guess.round;
  const weekday = forRound && forRound !== guess.round ? weekdayOf(history[history.length - 1] as Draw) : guess.weekday;
  const s = hkScores(history, round, weekday);
  const strong = s[0].p >= HK_STRONG;
  return { order: s.map((x) => x.digit), formula: "hk-model", label: "สูตรฮั่งเส็ง VIP", digits: [s[0].digit, s[1].digit],
    note: `${strong ? "งวดแข็ง" : "งวดปกติ"} · โมเดลให้ ${s[0].digit}: ${(100 * s[0].p).toFixed(1)}% · ${s[1].digit}: ${(100 * s[1].p).toFixed(1)}% (สุ่ม ${(100 * HK_BASE.randomStar).toFixed(1)}%)`
      + ` · งวดแบบนี้ทดสอบนอกตัวอย่าง 1,500 งวดได้ ★ ${(100 * (strong ? HK_BASE.strongStar : HK_BASE.weakStar)).toFixed(1)}% · 2 ตัว ${(100 * (strong ? HK_BASE.strongAny : HK_BASE.weakAny)).toFixed(1)}%`
      + (strong ? ` — งวดแข็งมีแค่ 1 ใน 10 งวด ช่วงนี้ยังได้เปรียบ (500 งวดล่าสุด ★ ${(100 * HK_BASE.recentStrongStar).toFixed(1)}%)`
                : ` — เหนือสุ่มแค่ ${(100 * (HK_BASE.weakStar - HK_BASE.randomStar)).toFixed(1)} จุด ลงเบา รองวดแข็ง (ค่าพยากรณ์ ≥ ${(100 * HK_STRONG).toFixed(1)}%)`) };
}

/** เลข 2 ตัวเรียงตามที่เครื่องออกบ่อยสุด — ตัดเบิ้ล, ตัดเลขของงวดก่อน */
function biasRanking(history: VipDraw[]): string[] {
  const count: Record<string, number> = {};
  for (const h of history) { const t = canon2(h.top.slice(-2)), b = canon2(h.bottom); count[t] = (count[t] ?? 0) + 1; count[b] = (count[b] ?? 0) + 1; }
  const prev = history[history.length - 1];
  const excl = new Set(prev ? [canon2(prev.top.slice(-2)), canon2(prev.bottom)] : []);
  const cands: string[] = [];
  for (let i = 0; i < 100; i++) { const m = String(i).padStart(2, "0"); if (m === canon2(m) && m[0] !== m[1] && !excl.has(m)) cands.push(m); }
  return cands.sort((a, b) => (count[b] ?? 0) - (count[a] ?? 0) || a.localeCompare(b));
}

function drillHk(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const ranking = biasRanking(history);
  const [a, b] = pick.digits;
  const rowA = ranking.filter((m) => m.includes(a)).slice(0, HK_DRILL_PER_DIGIT);
  const rowB = ranking.filter((m) => m.includes(b) && !rowA.includes(m)).slice(0, HK_DRILL_PER_DIGIT);
  const front = (d: string) => (m: string) => (m[0] === d ? m : m[1] + m[0]);
  return [{ digit: a, numbers: rowA.map(front(a)) }, { digit: b, numbers: rowB.map(front(b)) }];
}

export const hkFormula: MarketFormula = {
  name: "สูตรฮั่งเส็ง VIP — โมเดลเรียนรู้จาก 2,725 งวด (45 ตัวแปร) ฝึกใหม่ 27 ก.ย. 69",
  evidence: "โมเดล logistic ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปร (ออกใน 1–6 งวดก่อน, ตำแหน่งใน 2 งวดก่อน, ความถี่ 30/100 งวด, หายกี่งวด, ตัวเลขเอง, รอบ, วัน, เลขคณิตกับงวดก่อน) · **ฝึกใหม่ 27 ก.ย. 69 ด้วย 2,725 งวด (เดิมหยุดที่ 23 ก.ย. ประวัติแนบมาหยุด 18 ก.ย.)** · วัดแบบฝึกโมเดลใหม่ทุก fold 1,500 งวดที่ไม่เคยเห็น: ★ 36.7% / 2 ตัว 64.7% (สุ่ม 33.2 / 57.6) · **ขยับเกณฑ์งวดแข็ง 40.8% → 43.6%** เพราะเกณฑ์เดิมติดถึง 40% ของงวดแต่ได้ ★ 37.1% เทียบกับงวดที่เหลือ 36.5% แทบไม่ต่าง — เกณฑ์ใหม่ติด 1 ใน 10 งวด ★ 41.1% / 2 ตัว 69.2% (5 ใน 6 ช่วงทดสอบเกิน 40%) · ⚠ 500 งวดล่าสุดทั้งโมเดลยังอ่อน ★ 34.4% แต่เฉพาะงวดแข็งได้ ★ 38.2% · โมเดลชี้ว่า 9 ออกน้อยสุด (น้ำหนัก −0.33) 4 กับ 2 ออกมาก (+0.22 / +0.20) และเลขที่เป็นหลักหน่วยของล่างงวดก่อนจะออกน้อยลง (−0.20) · ทดสอบแล้วไม่ช่วย: กฎ 'รอบบ่ายตัดเลขรอบเช้า' ของจีน (p 0.19–0.57) และ widestPair ของจีน/นิเคอิ (p 0.20–0.80 รอบบ่ายแย่ลง) · ล่าง 2 ตัวคำนวณจากราคาไม่ได้ (ทดสอบ 1,353 วัน เท่าสุ่ม)",
  pick: pickHk,
  drill: drillHk,
  minHistory: HK_MIN_HISTORY,
  since: "2026-09-27", // วันที่สูตรปัจจุบันเริ่มใช้ (โมเดลฝึกถึง 27 ก.ย. 69 · คืนมาใช้ 13 ต.ค. 69) — ไว้บอกในหมายเหตุของงวดที่ไม่มีเลขล็อก
};
