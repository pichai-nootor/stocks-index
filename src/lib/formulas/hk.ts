/**
 * สูตรของ "หุ้นฮั่งเส็ง VIP" (เช้า 10:35 / บ่าย 15:25 ไทย) — ไฟล์นี้ใช้เฉพาะตลาดนี้ ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม = 34.4% ต่อเลข, 2 ตัว ≥1 = 59%
 *
 * **ปรับ 11 ต.ค. 69: ให้โมเดลฝึกใหม่เองจาก 1,000 งวดล่าสุดทุก 100 งวด** (เดิมน้ำหนักตายตัวใน hk-model.json ฝึกถึง 27 ก.ย.)
 *   เหตุผล: กันสูตรเสื่อมเมื่อนิสัยเครื่องเปลี่ยน — ตอนปรับ สูตรเดิมยังดีอยู่ (ล็อกจริง 36 งวด ★ 41.7% · 2 ตัว 61.1% · 28 งวดหลังฝึก ★ 39.3% · 2 ตัว 64.3%)
 *   ทดสอบ walk-forward กับประวัติฮั่งเส็งเอง 2,754 งวด (★ / 2 ตัว): ปี 67–68 ฝึกทั้งประวัติ 36.7 / 62.7 vs 1,000 งวดล่าสุด 36.6 / 62.4
 *     ปี 69 (500 งวด): ฝึกใหม่ทุก 250 งวด — ทั้งประวัติ 35.4 / 59.2 vs 1,000 งวดล่าสุด 37.6 / 61.8 · ทุก 100 งวด — 34.6 / 58.2 vs 35.4 / 61.0
 *     → 1,000 งวดล่าสุดไม่แพ้ในทุกการวัด แต่ต่างกันแค่ 1–3 จุด (อยู่ในช่วงแกว่ง) ประโยชน์หลักคือตามนิสัยเครื่องทัน
 *   วัดผ่านท่อสูตรจริงนี้ (2,000 งวดล่าสุด): ★ 36.4% · 2 ตัว 61.2% · ปี 69 ★ 34.7% · 2 ตัว 59.7% · 28 งวดหลัง 27 ก.ย. ★ 42.9% · 2 ตัว 64.3% (สูตรเดิม 39.3 / 64.3)
 *   ⚠ ปี 69 ฮั่งเส็งอ่อนลงทุกแบบที่ลอง (★ ~35% · 2 ตัว ~60%) — เหนือสุ่มแค่ 1–2 จุด
 *   เลิกใช้เกณฑ์ "งวดแข็ง 43.6%" เพราะปรับเทียบกับความน่าจะเป็นของโมเดลเดิม ใช้กับโมเดลที่ฝึกใหม่ไม่ได้
 *   ข้อความด้านล่างคือประวัติการวิเคราะห์ของโมเดลรุ่นก่อน (ยังใช้อ้างอิงเรื่องนิสัยเครื่องได้)
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
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const HK_MIN_HISTORY = 200;
export const HK_DRILL_PER_DIGIT = 6;
/** ฝึกจากกี่งวดล่าสุด · ฝึกใหม่ทุกกี่งวด */
const HK_TRAIN_WINDOW = 1000, HK_RETRAIN_EVERY = 100;
/** ตัวเลขจากการทดสอบ walk-forward (ฝึกใหม่ทุก fold) ประวัติถึง 11 ต.ค. 69 — ดูหัวไฟล์ */
export const HK_BASE = { star: 0.364, any: 0.612, star2026: 0.347, any2026: 0.597, randomStar: 0.332, randomAny: 0.576 } as const;

type Draw = { top: string; bottom: string; round?: number; weekday?: number; date?: Date | string };
const NF = 45;

/** ฟีเจอร์ 45 ตัวของเลข d ณ งวดที่ i (ใช้เฉพาะ history[0..i−1]) — round/weekday คือของงวดที่ i */
function features(history: VipDraw[], sets: Set<string>[], i: number, d: string, round: number, weekday: number): number[] {
  const at = (j: number) => history[i - j]; // j = 1 คือ งวดก่อนหน้า
  const has = (j: number) => sets[i - j].has(d);
  const f: number[] = [];
  for (let j = 1; j <= 6; j++) f.push(has(j) ? 1 : 0);
  for (let j = 1; j <= 2; j++) { const h = at(j); const t = h.top.slice(-2), b = h.bottom; f.push(h.top[0] === d ? 1 : 0, t[0] === d ? 1 : 0, t[1] === d ? 1 : 0, b[0] === d ? 1 : 0, b[1] === d ? 1 : 0); }
  let c30 = 0, c100 = 0;
  for (let j = 1; j <= 100 && j <= i; j++) { if (has(j)) { c100++; if (j <= 30) c30++; } }
  f.push(c30 / 10, c100 / 30);
  let gap = 0;
  for (let j = 1; j < 200; j++) { if (j > i || has(j)) break; gap++; }
  f.push(Math.min(gap, 50) / 10);
  for (const x of DIGITS10) f.push(x === d ? 1 : 0);
  f.push(round - 1);
  for (let w = 0; w < 7; w++) f.push(weekday === w ? 1 : 0);
  const p = at(1); const pt = p.top.slice(-2), pb = p.bottom; const di = Number(d);
  const n0 = (x: number) => ((x % 10) + 10) % 10;
  f.push(di === n0(Number(pt[0]) + Number(pt[1])) ? 1 : 0, di === n0(Number(pb[0]) + Number(pb[1])) ? 1 : 0, di === Math.abs(Number(pt[0]) - Number(pt[1])) ? 1 : 0, di === Math.abs(Number(pb[0]) - Number(pb[1])) ? 1 : 0,
    di === n0(Number(pt[1]) + 1) ? 1 : 0, di === n0(Number(pt[1]) - 1) ? 1 : 0, di === n0(Number(pb[1]) + 1) ? 1 : 0, di === n0(Number(pb[1]) - 1) ? 1 : 0);
  return f;
}

/** วันในสัปดาห์แบบ python (จันทร์ = 0) จากแถวประวัติ */
const weekdayOf = (d: Draw) => d.weekday ?? (d.date ? (new Date(d.date).getUTCDay() + 6) % 7 : 1);

/**
 * ฝึก logistic จาก HK_TRAIN_WINDOW งวดล่าสุดของฮั่งเส็งก่อนงวดที่ cutoff (gradient descent, L2 เล็กน้อย)
 * แคชตามงวดตัด — หน้า /vip เรียกสูตรทุกงวดย้อนหลัง จึงฝึกแค่ครั้งละ HK_RETRAIN_EVERY งวด
 */
const modelCache = new Map<string, { w: Float64Array; b: number }>();
function trainedModel(history: VipDraw[], sets: Set<string>[], cutoff: number) {
  const lastRow = history[cutoff - 1] as Draw;
  const key = `${cutoff}|${lastRow.date ? new Date(lastRow.date).toISOString().slice(0, 10) : ""}|${lastRow.round ?? ""}|${lastRow.top}${lastRow.bottom}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const lo = Math.max(110, cutoff - HK_TRAIN_WINDOW);
  const idx: number[] = [], val: number[] = [], start: number[] = [0], Y: number[] = [];
  for (let i = lo; i < cutoff; i++) {
    const h = history[i] as Draw;
    const round = h.round ?? 2, wd = weekdayOf(h);
    for (const d of DIGITS10) {
      features(history, sets, i, d, round, wd).forEach((v, j) => { if (v !== 0) { idx.push(j); val.push(v); } });
      start.push(idx.length); Y.push(sets[i].has(d) ? 1 : 0);
    }
  }
  const rows = Y.length;
  const w = new Float64Array(NF), g = new Float64Array(NF); let b = 0;
  for (let it = 0; it < 300; it++) {
    g.fill(0); let gb = 0;
    for (let k = 0; k < rows; k++) {
      let z = b;
      for (let q = start[k]; q < start[k + 1]; q++) z += w[idx[q]] * val[q];
      const e = 1 / (1 + Math.exp(-z)) - Y[k];
      gb += e;
      for (let q = start[k]; q < start[k + 1]; q++) g[idx[q]] += e * val[q];
    }
    for (let j = 0; j < NF; j++) w[j] -= 0.5 * (g[j] / rows + 1e-3 * w[j]);
    b -= 0.5 * gb / rows;
  }
  const m = { w, b };
  if (modelCache.size > 200) modelCache.clear();
  modelCache.set(key, m);
  return m;
}

/** ค่าพยากรณ์ 0–1 ของเลข 0–9 สำหรับงวดถัดไปจากโมเดลที่ฝึกใหม่ (เรียงมาก→น้อย) */
export function hkScores(history: VipDraw[], round = 2, weekday = 1): { digit: string; p: number }[] {
  const n = history.length;
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const { w, b } = trainedModel(history, sets, n - (n % HK_RETRAIN_EVERY));
  return DIGITS10.map((d) => { const z = features(history, sets, n, d, round, weekday).reduce((s, v, j) => s + v * w[j], b); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; })
    .sort((a, c) => c.p - a.p || a.digit.localeCompare(c.digit));
}

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
  const guess = nextRoundInfo(history as (VipDraw & Draw)[]);
  const round = forRound ?? guess.round;
  const weekday = forRound && forRound !== guess.round ? weekdayOf(history[history.length - 1] as Draw) : guess.weekday;
  const s = hkScores(history, round, weekday);
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  return { formula: "hk-model", label: "สูตรฮั่งเส็ง VIP", digits: [s[0].digit, s[1].digit],
    note: `โมเดลฝึกใหม่จาก ${HK_TRAIN_WINDOW} งวดล่าสุดของฮั่งเส็งให้ ${s[0].digit}: ${pct(s[0].p)} · ${s[1].digit}: ${pct(s[1].p)} · อันดับถัดไป ${s.slice(2, 5).map((x) => `${x.digit} ${(100 * x.p).toFixed(0)}%`).join(", ")}`
      + ` · ทดสอบ walk-forward ★ ${pct(HK_BASE.star)} · 2 ตัว ${pct(HK_BASE.any)} · ปี 69 ★ ${pct(HK_BASE.star2026)} · 2 ตัว ${pct(HK_BASE.any2026)} (สุ่ม ${pct(HK_BASE.randomStar)} / ${pct(HK_BASE.randomAny)})` };
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
  name: "สูตรฮั่งเส็ง VIP — โมเดล 45 ตัวแปร ฝึกใหม่เองจาก 1,000 งวดล่าสุด (ปรับ 11 ต.ค. 69)",
  evidence: "**ปรับ 11 ต.ค. 69: โมเดลฝึกใหม่เองจาก 1,000 งวดล่าสุดของฮั่งเส็งทุก 100 งวด** (เดิมน้ำหนักตายตัวฝึกถึง 27 ก.ย. — ตอนปรับยังดีอยู่: ล็อกจริง 36 งวด ★ 41.7% · 2 ตัว 61.1%) · วัดผ่านสูตรจริง 2,000 งวด ★ 36.4% · 2 ตัว 61.2% · ปี 69 ★ 34.7% · 2 ตัว 59.7% (ไม่แพ้การฝึกจากทั้งประวัติ แต่ต่างแค่ 1–3 จุด) · ⚠ ปี 69 ฮั่งเส็งอ่อนลงทุกแบบที่ลอง · ประโยชน์หลักคือกันสูตรเสื่อมเมื่อนิสัยเครื่องเปลี่ยน · เลิกใช้เกณฑ์งวดแข็ง (ปรับเทียบกับโมเดลเดิม) · ประวัติรุ่นก่อน: โมเดล logistic ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปร (ออกใน 1–6 งวดก่อน, ตำแหน่งใน 2 งวดก่อน, ความถี่ 30/100 งวด, หายกี่งวด, ตัวเลขเอง, รอบ, วัน, เลขคณิตกับงวดก่อน) · **ฝึกใหม่ 27 ก.ย. 69 ด้วย 2,725 งวด (เดิมหยุดที่ 23 ก.ย. ประวัติแนบมาหยุด 18 ก.ย.)** · วัดแบบฝึกโมเดลใหม่ทุก fold 1,500 งวดที่ไม่เคยเห็น: ★ 36.7% / 2 ตัว 64.7% (สุ่ม 33.2 / 57.6) · **ขยับเกณฑ์งวดแข็ง 40.8% → 43.6%** เพราะเกณฑ์เดิมติดถึง 40% ของงวดแต่ได้ ★ 37.1% เทียบกับงวดที่เหลือ 36.5% แทบไม่ต่าง — เกณฑ์ใหม่ติด 1 ใน 10 งวด ★ 41.1% / 2 ตัว 69.2% (5 ใน 6 ช่วงทดสอบเกิน 40%) · ⚠ 500 งวดล่าสุดทั้งโมเดลยังอ่อน ★ 34.4% แต่เฉพาะงวดแข็งได้ ★ 38.2% · โมเดลชี้ว่า 9 ออกน้อยสุด (น้ำหนัก −0.33) 4 กับ 2 ออกมาก (+0.22 / +0.20) และเลขที่เป็นหลักหน่วยของล่างงวดก่อนจะออกน้อยลง (−0.20) · ทดสอบแล้วไม่ช่วย: กฎ 'รอบบ่ายตัดเลขรอบเช้า' ของจีน (p 0.19–0.57) และ widestPair ของจีน/นิเคอิ (p 0.20–0.80 รอบบ่ายแย่ลง) · ล่าง 2 ตัวคำนวณจากราคาไม่ได้ (ทดสอบ 1,353 วัน เท่าสุ่ม)",
  pick: pickHk,
  drill: drillHk,
  minHistory: HK_MIN_HISTORY,
};
