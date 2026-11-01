/**
 * สูตรของ "หุ้นเกาหลี VIP" (ออกผล 12:35 ไทย รอบเดียว) — ไฟล์นี้ใช้เฉพาะตลาดนี้ ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม = 34.4% ต่อเลข, 2 ตัว ≥1 = 59%
 *
 * หลักฐานจากประวัติ 1,356 งวด (25 พ.ย. 2565 → 19 ก.ย. 2569, raakaadee.com ตรงกับ API ของเว็บ) ออกทุกวัน:
 *   ▸ ฟีดเกาหลีไม่มีราคาเปิด (มีแค่ราคาปิด+diff ในช่อง results) และผล VIP ทุกตลาดที่ตรวจไม่ผูกกับราคาเปิด → ไม่ใช้ตัวเปิด
 *   ▸ นิสัยเครื่องเหมือนตลาดอื่น: บนเบิ้ล 93 ครั้ง (สุ่ม 136) · ล่างหยิบหลักจากบน 202/240 (สุ่ม 136) · ไม่ซ้ำงวดก่อน (1/3 vs 14)
 *     เลขร้อน 30 งวดออกซ้ำแค่ 28.5% (แย่กว่าสุ่มมาก) — เครื่องถ่วงดุลแรง
 *   ▸ ต่างจากจีน/ฮั่งเส็ง: ไม่มีเลขที่ออกน้อย/มากถาวรชัดเจน (0 = 31%, 5/8 = 35%, สลับกันระหว่างครึ่ง) และเลข 2 ตัวไม่เอียง (chi² 59 ≈ สุ่ม 54)
 *     → เกาหลีเดาจาก "ตัวเลข" ไม่ได้ ต้องเดาจาก "พฤติกรรม" อย่างเดียว
 * วิธีคิดเดิม (23 ก.ย.–1 พ.ย. 69): โมเดล logistic 45 ตัวแปร น้ำหนักตายตัว ฝึกครั้งเดียวจากประวัติถึง 23 ก.ย. (kr-model.json)
 * **ปรับ 1 พ.ย. 69 (ทบทวนสิ้นเดือน ผู้ใช้อนุมัติ)** — ตัวแปร 45 ตัวเดิม แต่ **ฝึกใหม่เองจาก 1,000 งวดล่าสุดทุก 100 งวด** (ไม่เห็นอนาคต)
 *   เหตุ: คะแนนย้อนหลังของโมเดลตายตัว (60.5 / 64.2) วัดกับงวดที่มันเคยเห็น จึงสูงเกินจริง — นิเคอิเคยเจอโมเดลตายตัวหมดแรงในปี 69
 *   ทดสอบ walk-forward 999 งวด (ก.พ. 67–พ.ย. 69, 2 ตัว): ครึ่งแรก 59.9 · ครึ่งหลัง 61.2 · ปี 69 62.0 (สุ่ม 56.8 / 57.1 / 56.8)
 *     หลัง 23 ก.ย. (39 งวดที่โมเดลเดิมไม่เคยเห็น): ใหม่ ★ 33.3 / 2 ตัว 61.5 vs เดิม 30.8 / 56.4 (สุ่ม 55.6) — ตัวอย่างเล็ก
 *     ที่ลองแล้วไม่ดีกว่า: ฝึกสะสมทั้งหมด 59.9 / 60.6 · 500 งวด 58.5 / 60.8 · เลขที่ออกน้อย 20–100 งวด / รวม 30–60 / กันหายนาน / ตัดเลขงวดก่อน (ไม่นิ่งระหว่างสองครึ่ง)
 *   เลขที่ล็อกไว้ก่อนเปลี่ยนสูตรยังใช้ตัดสินตามเดิม (ไม่ตั้ง lockedFrom — รายงานตุลาคมไม่เปลี่ยน)
 * เลข 2 ตัว: เจาะจากเลขที่ฟัน เรียงตามความถี่ ตัดเบิ้ล ตัดเลขงวดก่อน (ความเอียงของเกาหลีอ่อน จึงเป็นแค่ "ไม่แย่กว่าสุ่ม")
 */
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const KR_MIN_HISTORY = 400;
export const KR_DRILL_PER_DIGIT = 6;
/** ฝึกจากกี่งวดล่าสุด · ฝึกใหม่ทุกกี่งวด · งวดแรกที่ใช้ฝึก */
const KR_TRAIN_WINDOW = 1000, KR_RETRAIN_EVERY = 100, KR_TRAIN_START = 100;
/** ตัวเลขจากการทดสอบ walk-forward 1 พ.ย. 69 — ดูหัวไฟล์ */
export const KR_BASE = { anyA: 0.599, anyB: 0.612, any2026: 0.62, randomAny: 0.57 } as const;

type Draw = { top: string; bottom: string; round?: number; weekday?: number; date?: Date | string };
const NF = 45;

/** ฟีเจอร์ 45 ตัวของเลข d ณ งวดที่ i (ใช้เฉพาะ history[0..i−1]) — ชุดเดียวกับโมเดลเดิม (ความถี่/ระยะหายย่อสเกลเพื่อฝึก) */
function features(history: VipDraw[], sets: Set<string>[], i: number, d: string, round: number, weekday: number): number[] {
  const at = (j: number) => history[i - j]; // j = 1 คือ งวดก่อนหน้า
  const has = (j: number) => sets[i - j].has(d);
  const f: number[] = [];
  for (let j = 1; j <= 6; j++) f.push(has(j) ? 1 : 0);
  for (let j = 1; j <= 2; j++) { const h = at(j); const t = h.top.slice(-2), b = h.bottom; f.push(h.top[0] === d ? 1 : 0, t[0] === d ? 1 : 0, t[1] === d ? 1 : 0, b[0] === d ? 1 : 0, b[1] === d ? 1 : 0); }
  let c30 = 0, c100 = 0;
  for (let j = 1; j <= 100 && j <= i; j++) { if (has(j)) { c100++; if (j <= 30) c30++; } }
  f.push(c30 / 10, c100 / 33);
  let gap = 0;
  for (let j = 1; j < 200; j++) { if (j > i || has(j)) break; gap++; }
  f.push(Math.min(gap, 50) / 10);
  for (const x of DIGITS10) f.push(x === d ? 1 : 0);
  f.push(round);
  for (let w = 0; w < 7; w++) f.push(weekday === w ? 1 : 0);
  const p = at(1); const pt = p.top.slice(-2), pb = p.bottom; const di = Number(d);
  const n0 = (x: number) => ((x % 10) + 10) % 10;
  f.push(di === n0(Number(pt[0]) + Number(pt[1])) ? 1 : 0, di === n0(Number(pb[0]) + Number(pb[1])) ? 1 : 0, di === Math.abs(Number(pt[0]) - Number(pt[1])) ? 1 : 0, di === Math.abs(Number(pb[0]) - Number(pb[1])) ? 1 : 0,
    di === n0(Number(pt[1]) + 1) ? 1 : 0, di === n0(Number(pt[1]) - 1) ? 1 : 0, di === n0(Number(pb[1]) + 1) ? 1 : 0, di === n0(Number(pb[1]) - 1) ? 1 : 0);
  return f;
}

/** วันในสัปดาห์แบบ python (จันทร์ = 0) จากแถวประวัติ */
const weekdayOf = (d: Draw) => d.weekday ?? (d.date ? (new Date(d.date).getUTCDay() + 6) % 7 : 1);
/** เกาหลีออกวันละรอบ — ค่ารอบในตัวแปรคงที่ (เท่ากับตอนทดสอบ) */
const KR_ROUND = 1;

/**
 * ฝึก logistic จาก KR_TRAIN_WINDOW งวดก่อนงวดที่ cutoff (gradient descent, L2 0.01)
 * แคชตามงวดตัด — หน้า /vip เรียกสูตรทุกงวดย้อนหลัง จึงฝึกแค่ครั้งละ KR_RETRAIN_EVERY งวด · เก็บแบบ sparse ให้ฝึกเร็ว
 */
const modelCache = new Map<string, { w: Float64Array; b: number }>();
function trainedModel(history: VipDraw[], sets: Set<string>[], cutoff: number) {
  const lastRow = history[cutoff - 1];
  const key = `${cutoff}|${(lastRow as Draw).date ? new Date((lastRow as Draw).date!).toISOString().slice(0, 10) : ""}|${lastRow.top}${lastRow.bottom}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const lo = Math.max(KR_TRAIN_START, cutoff - KR_TRAIN_WINDOW);
  const idx: number[] = [], val: number[] = [], start: number[] = [0], Y: number[] = [];
  for (let i = lo; i < cutoff; i++) {
    const wd = weekdayOf(history[i] as Draw);
    for (const d of DIGITS10) {
      features(history, sets, i, d, KR_ROUND, wd).forEach((v, j) => { if (v !== 0) { idx.push(j); val.push(v); } });
      start.push(idx.length); Y.push(sets[i].has(d) ? 1 : 0);
    }
  }
  const rows = Y.length;
  const w = new Float64Array(NF), g = new Float64Array(NF); let b = 0;
  const lr = 0.5, l2 = 0.01;
  for (let it = 0; it < 300; it++) {
    g.fill(0); let gb = 0;
    for (let k = 0; k < rows; k++) {
      let z = b;
      for (let q = start[k]; q < start[k + 1]; q++) z += w[idx[q]] * val[q];
      const e = 1 / (1 + Math.exp(-z)) - Y[k];
      gb += e;
      for (let q = start[k]; q < start[k + 1]; q++) g[idx[q]] += e * val[q];
    }
    for (let j = 0; j < NF; j++) w[j] -= lr * (g[j] / rows + l2 * w[j]);
    b -= lr * gb / rows;
  }
  const m = { w, b };
  if (modelCache.size > 200) modelCache.clear();
  modelCache.set(key, m);
  return m;
}

/** ค่าพยากรณ์ 0–1 ของเลข 0–9 สำหรับงวดถัดไปจากโมเดลที่ฝึกใหม่ (เรียงมาก→น้อย) */
export function krScores(history: VipDraw[], weekday: number): { digit: string; p: number }[] {
  const n = history.length;
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const { w, b } = trainedModel(history, sets, n - (n % KR_RETRAIN_EVERY));
  return DIGITS10.map((d) => { const x = features(history, sets, n, d, KR_ROUND, weekday); const z = x.reduce((s, v, i) => s + v * w[i], b); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; })
    .sort((a, c) => c.p - a.p || a.digit.localeCompare(c.digit));
}

function pickKr(history: VipDraw[]): VipPick | null {
  if (history.length < KR_MIN_HISTORY) return null;
  const weekday = (weekdayOf(history[history.length - 1] as Draw) + 1) % 7; // วันละงวด → งวดถัดไป = พรุ่งนี้
  const s = krScores(history, weekday);
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  return { order: s.map((x) => x.digit), formula: "kr-retrain", label: "สูตรเกาหลี VIP", digits: [s[0].digit, s[1].digit], note: `โมเดล (ฝึกใหม่ ${KR_TRAIN_WINDOW} งวดล่าสุด) ให้ ${s[0].digit}: ${pct(s[0].p)} · ${s[1].digit}: ${pct(s[1].p)} · อันดับถัดไป ${s.slice(2, 5).map((x) => `${x.digit} ${(100 * x.p).toFixed(0)}%`).join(", ")} · ทดสอบ 2 ตัว ครึ่งแรก ${pct(KR_BASE.anyA)} · ครึ่งหลัง ${pct(KR_BASE.anyB)} (สุ่ม ${pct(KR_BASE.randomAny)})` };
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

function drillKr(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const ranking = biasRanking(history);
  const [a, b] = pick.digits;
  const rowA = ranking.filter((m) => m.includes(a)).slice(0, KR_DRILL_PER_DIGIT);
  const rowB = ranking.filter((m) => m.includes(b) && !rowA.includes(m)).slice(0, KR_DRILL_PER_DIGIT);
  const front = (d: string) => (m: string) => (m[0] === d ? m : m[1] + m[0]);
  return [{ digit: a, numbers: rowA.map(front(a)) }, { digit: b, numbers: rowB.map(front(b)) }];
}

export const krFormula: MarketFormula = {
  name: "สูตรเกาหลี VIP — โมเดล 45 ตัวแปร ฝึกใหม่ 1,000 งวดล่าสุดทุก 100 งวด (ปรับ 1 พ.ย. 69)",
  evidence: "โมเดล logistic ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปรพฤติกรรม (ออกใน 1–6 งวดก่อน, ตำแหน่งใน 2 งวดก่อน, ความถี่ 30/100 งวด, หายกี่งวด, ตัวเลขเอง, วัน, เลขคณิตกับงวดก่อน) · **ปรับ 1 พ.ย. 69**: ฝึกใหม่เองจาก 1,000 งวดล่าสุดทุก 100 งวด แทนน้ำหนักตายตัว (ฝึกครั้งเดียวถึง 23 ก.ย. ซึ่งคะแนนย้อนหลังวัดกับงวดที่เคยเห็น จึงสูงเกินจริง) · ทดสอบ walk-forward 999 งวด 2 ตัว: ครึ่งแรก 59.9% · ครึ่งหลัง 61.2% · ปี 69 62.0% (สุ่ม ~57%) · หลัง 23 ก.ย. 39 งวด: ใหม่ 61.5% vs เดิม 56.4% (ตัวอย่างเล็ก) · เกาหลีไม่มีเลขที่ออกมาก/น้อยถาวร สูตรเลขเย็นไม่นิ่งระหว่างสองครึ่ง · ได้เปรียบสุ่มราว 3–4 จุด ผลรายเดือนยังแกว่ง · เลขที่ล็อกไว้ก่อน 1 พ.ย. ยังตัดสินตามเดิม",
  pick: pickKr,
  drill: drillKr,
  minHistory: KR_MIN_HISTORY,
  since: "2026-11-01", // วันที่สูตรปัจจุบันเริ่มใช้ (ฝึกใหม่ทุก 100 งวด 1 พ.ย. 69) — ไว้บอกในหมายเหตุของงวดที่ไม่มีเลขล็อก
};
