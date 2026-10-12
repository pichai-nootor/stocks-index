/**
 * สูตรของ "หุ้นนิเคอิ VIP" (เช้า 09:05 / บ่าย 13:25 ไทย) — ไฟล์นี้ใช้เฉพาะตลาดนี้ ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม ≈ 33% ต่อเลข, 2 ตัว ≥1 ≈ 57%
 *
 * **ปรับใหม่ 11 ต.ค. 69** — สูตรเดิม (โมเดล logistic น้ำหนักตายตัว ฝึกถึง 27 ก.ย.) หลังใช้จริง 26 งวด (28 ก.ย.–10 ต.ค.) ได้ ★ 34.6% · 2 ตัว 42.3% (สุ่ม 33 / 57)
 *   ตรวจย้อนหลังแบบฝึกใหม่ทุกช่วง (ประวัติ 2,754 งวด ถึง 10 ต.ค. 69) พบว่าไม่ใช่แค่ดวงตก — โมเดลเดิมหมดแรงตั้งแต่ต้นปี 2569:
 *     ปี 67–68 ★ 38.0% / 2 ตัว 65.5%  แต่  ปี 69 (500 งวด) ★ 33.4% / 2 ตัว 56.0% = เท่าสุ่ม (รอบเช้าแย่สุด 30.4 / 52.0)
 *   เหตุ: โมเดลฝึกจากทั้งประวัติ ให้น้ำหนักนิสัยเก่า (ตัวเลขเอง/วัน/เลขคณิต) ที่เครื่องเลิกทำแล้ว
 *   นิสัยที่ยังอยู่จริงในปี 69: เลขที่เพิ่งออกงวดก่อนกลับมาน้อย — รอบบ่าย 28.8% vs 35.3% (ชัด) · รอบเช้า 32.1% vs 33.8% (แทบไม่มี)
 *
 * วิธีใหม่ = รวมอันดับ 2 ตัว (บวกอันดับกัน):
 *   1) โมเดล logistic ตัวเดิม 45 ตัวแปร แต่ **ฝึกใหม่เองจาก 1,000 งวดล่าสุด** (ราว 16 เดือน) ทุก 100 งวด — ตามนิสัยเครื่องที่เปลี่ยน
 *   2) กฎง่าย: ตัดเลขที่ออกงวดก่อน แล้วเรียงเลขที่ออกน้อยสุดใน 100 งวด (ถ่วงดุล)
 *   เลือกจาก 8 แบบด้วยการทดสอบแบบฝึกใหม่ทุก fold (ไม่เห็นอนาคต) — ตัวนี้นิ่งที่สุดทุกช่วง
 *     (โมเดลเดิม ปี 69: 33.4 / 56.0 · กฎง่ายอย่างเดียว 35.4 / 59.0 · โมเดล 1,000 งวดอย่างเดียว 34.2 / 61.2)
 *   วัดผ่านท่อสูตรจริงนี้ (jpFormula.pick ทีละงวด, ใช้แค่งวดก่อนหน้า):
 *     ปี 66 ★ 39.5 / 2 ตัว 63.3 · ปี 67 40.0 / 64.9 · ปี 68 34.5 / 59.5 · **ปี 69 (566 งวด) ★ 37.5 / 2 ตัว 63.3** (เช้า 36.0 / 60.8 · บ่าย 38.9 / 65.7)
 *     28 ก.ย.–10 ต.ค. (26 งวดเดียวกับที่สูตรเดิมพลาด): ★ 42.3 / 2 ตัว 73.1 — ตัวอย่างเล็ก อย่ายึด
 *   ⚠ ความได้เปรียบมีแค่ +4–6 จุดจากสุ่ม และรอบเช้าอ่อนกว่ารอบบ่าย — มีบางปี (68) ที่อ่อนลงเหลือ +1.5 / +2 จุด
 *   ถอดกฎรอบเช้า (widestPair) / รอบบ่าย (ตัดล่างเช้า) ออก — วัดแล้วไม่ช่วย (ดูประวัติไฟล์ 27 ก.ย.)
 * เลข 2 ตัว (เจาะ): จับคู่เลขที่ฟันกับเลขอื่นตามอันดับของสูตร ตัดเบิ้ล (ดู partnerRow)
 */
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const JP_MIN_HISTORY = 200;
/** ผู้ใช้แทงเลขเจาะ 2 ชุด ชุดละ 6 ตัว (รวม 12) */
export const JP_DRILL_PER_DIGIT = 6;
/** ฝึกจากกี่งวดล่าสุด · ฝึกใหม่ทุกกี่งวด · กฎถ่วงดุลนับย้อนกี่งวด */
const JP_TRAIN_WINDOW = 1000, JP_RETRAIN_EVERY = 100, JP_FREQ_WINDOW = 100;
/** ตัวเลขจากการทดสอบนอกตัวอย่าง (ฝึกใหม่ทุก fold, ประวัติถึง 10 ต.ค. 69) — ดูหัวไฟล์ */
export const JP_BASE = { star: 0.375, any: 0.633, amStar: 0.360, amAny: 0.608, pmStar: 0.389, pmAny: 0.657, randomStar: 0.330, randomAny: 0.573 } as const;

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

/**
 * ฝึก logistic จาก JP_TRAIN_WINDOW งวดก่อนงวดที่ cutoff (gradient descent, L2 เล็กน้อย)
 * แคชตามงวดตัดจริง — หน้า /vip เรียกสูตรทุกงวดย้อนหลัง จึงฝึกแค่ครั้งละ JP_RETRAIN_EVERY งวด
 */
const modelCache = new Map<string, { w: Float64Array; b: number }>();
function trainedModel(history: VipDraw[], sets: Set<string>[], cutoff: number) {
  const lastRow = history[cutoff - 1];
  const key = `${cutoff}|${(lastRow as Draw).date ? new Date((lastRow as Draw).date!).toISOString().slice(0, 10) : ""}|${lastRow.top}${lastRow.bottom}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const lo = Math.max(110, cutoff - JP_TRAIN_WINDOW);
  // เก็บแบบ sparse (ตัวแปรส่วนใหญ่เป็น 0) — ฝึกเร็วขึ้นหลายเท่า หน้า /vip โหลดครั้งแรกไม่ค้าง
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
  const lr = 0.5, l2 = 1e-3;
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
export function jpScores(history: VipDraw[], round = 2, weekday = 1): { digit: string; p: number }[] {
  const n = history.length;
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const cutoff = n - (n % JP_RETRAIN_EVERY);
  const { w, b } = trainedModel(history, sets, cutoff);
  return DIGITS10.map((d) => { const x = features(history, sets, n, d, round, weekday); const z = x.reduce((s, v, i) => s + v * w[i], b); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; })
    .sort((a, c) => c.p - a.p || a.digit.localeCompare(c.digit));
}

/** กฎถ่วงดุล: ตัดเลขที่ออกงวดก่อน แล้วเรียงเลขที่ออกน้อยสุดใน JP_FREQ_WINDOW งวด */
function balanceRanking(history: VipDraw[]): { digit: string; inPrev: boolean; count: number }[] {
  const prev = new Set(resultDigits(history[history.length - 1].top, history[history.length - 1].bottom));
  const recent = history.slice(-JP_FREQ_WINDOW).map((h) => new Set(resultDigits(h.top, h.bottom)));
  return DIGITS10.map((d) => ({ digit: d, inPrev: prev.has(d), count: recent.filter((s) => s.has(d)).length }))
    .sort((a, c) => (+a.inPrev - +c.inPrev) || a.count - c.count || a.digit.localeCompare(c.digit));
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


/**
 * (11 ต.ค. 69) ถอด "D สด" ออกทั้งหมด — เดิมใช้ D = ทศนิยม(ราคา − diff) เลือกเลขเจาะบนการ์ดสด
 *   ตรวจฟีด 11 ต.ค.: D คงที่ทุกนาที (48) ยกเว้นสองแถวที่เป็นผล (51, 60) — เว็บขยับ diff ของแถวผล 0–77 สตางค์ (43 งวดในฐานข้อมูล)
 *   และต่อให้ไม่ขยับ: 2 ตัวบนสุ่มเท่ากัน 00–99 → ล่างก็สุ่มเท่ากัน ราคาเปิดไม่ทำให้เลขโดด/คู่ไหนมีโอกาสมากขึ้น (ได้เปรียบสูงสุด +0.3 จุด)
 *   การ์ดสดจึงใช้เลขเจาะวิธีเดียวกับที่ทดสอบแล้ว (partnerRow)
 */

function pickJp(history: VipDraw[], _open?: number | null, forRound?: number): VipPick | null {
  if (history.length < JP_MIN_HISTORY) return null;
  const guess = nextRoundInfo(history as (VipDraw & Draw)[]);
  // รอบที่หน้าจอถามมาสำคัญกว่าการเดา: ตอนผลเช้ายังไม่ออก ประวัติจะชี้ว่า "งวดถัดไป = เช้า" ทั้งสองแผง
  const round = forRound ?? guess.round;
  const weekday = forRound && forRound !== guess.round ? weekdayOf(history[history.length - 1] as Draw) : guess.weekday;
  const model = jpScores(history, round, weekday);
  const rule = balanceRanking(history);
  // รวมอันดับ: อันดับในโมเดล + อันดับในกฎถ่วงดุล (น้อย = ดี) · เสมอกันเอาเลขน้อยก่อน
  const rank: Record<string, number> = {};
  model.forEach((x, k) => (rank[x.digit] = k));
  rule.forEach((x, k) => (rank[x.digit] += k));
  const s = [...DIGITS10].sort((a, c) => rank[a] - rank[c] || a.localeCompare(c));
  const pOf = (d: string) => model.find((x) => x.digit === d)!.p;
  const ruleOf = (d: string) => rule.find((x) => x.digit === d)!;
  const why = (d: string) => `${d} (โมเดล ${(100 * pOf(d)).toFixed(0)}% · ออก ${ruleOf(d).count}/${JP_FREQ_WINDOW} งวด${ruleOf(d).inPrev ? " · เพิ่งออกงวดก่อน" : ""})`;
  const am = round === 1;
  const expected = ` · รอบ${am ? "เช้า" : "บ่าย"}ทดสอบนอกตัวอย่างปี 69 ได้ ★ ${(100 * (am ? JP_BASE.amStar : JP_BASE.pmStar)).toFixed(1)}% · 2 ตัว ${(100 * (am ? JP_BASE.amAny : JP_BASE.pmAny)).toFixed(1)}% (สุ่ม ${(100 * JP_BASE.randomStar).toFixed(1)} / ${(100 * JP_BASE.randomAny).toFixed(1)}%)${am ? " — รอบเช้าอ่อนกว่ารอบบ่าย" : ""}`;
  return { order: s, formula: "jp-ens", label: "สูตรนิเคอิ VIP", digits: [s[0], s[1]], note: `รวมอันดับโมเดล (ฝึกใหม่ ${JP_TRAIN_WINDOW} งวดล่าสุด) + กฎถ่วงดุล: ${why(s[0])}, ${why(s[1])} · อันดับถัดไป ${s.slice(2, 5).join(", ")}${expected}` };
}

/**
 * เลขเจาะ (ไม่มี D สด): จับคู่เลขที่ฟันกับเลขตัวอื่นตามอันดับของสูตรเอง (ดี→แย่) ตัวละ JP_DRILL_PER_DIGIT ตัว ตัดเบิ้ล
 *   ทดสอบย้อนหลัง 2,000+ งวด (มิ.ย. 66–10 ต.ค. 69) ด้วยเลขฟันของสูตรปัจจุบัน — เจาะมา (12 ตัว ตรง 2 ตัวบนหรือล่าง กลับได้):
 *     วิธีเดิม (คู่ที่ออกบ่อยสุดตลอดกาล) 46.5% · ปี 69 46.1%  =  สุ่มคู่ 46.7% · ปี 69 46.9% → เดิมเป็น noise ล้วน
 *     **คู่ตามอันดับสูตร 47.3% · ปี 69 49.3%** — ดีกว่าเล็กน้อย (ยังอยู่ในช่วงแกว่ง ±2 จุด)
 *     ที่ลองแล้วไม่ดีกว่า: คู่ที่ออกน้อย/บ่อยใน 300 งวด, แบ่ง 7/5 · 8/4 · 9/3, คู่ภายใน 6 อันดับแรก · ใส่เลขเบิ้ลแย่ลงชัด (43.4%)
 *   วิเคราะห์รอบ 2 (11 ต.ค. 69) ระดับคู่เลข: โมเดล logistic รายคู่ 11 ตัวแปร (อันดับเลข, คู่งวดก่อน, ความถี่ 100/300, หายกี่งวด) ฝึกใหม่ทุก 100 งวด
 *     ได้ 46.4% แพ้คู่ตามอันดับ (47.0%) · คู่ที่หายนานสุด 45.9% · ระยะห่างของเลขในคู่ไม่มีรูปแบบ → การเลือกคู่ชนเพดานแล้ว
 *     เพิ่มแค่ "ไม่เจาะคู่ของงวดก่อน" (ข้อเท็จจริงจากข้อมูล ผลทดสอบเท่าเดิมเพราะคู่พวกนี้มักอันดับต่ำอยู่แล้ว)
 *   ⚠ เลขเจาะจะมาหรือไม่ขึ้นกับ "เลขฟันมาไหม" เป็นหลัก (ถ้าเลขฟันมา เจาะมา ~75%) ไม่ได้ขึ้นกับวิธีเลือกคู่
 */
function partnerRow(d: string, order: string[], taken: string[]): string[] {
  return order.filter((x) => x !== d && !taken.includes(canon2(d + x))).slice(0, JP_DRILL_PER_DIGIT).map((x) => d + x);
}
/** คู่ของงวดก่อน (2 ตัวบน, ล่าง) — เครื่องแทบไม่ออกซ้ำ: บนซ้ำ ~1% · ล่างซ้ำล่าง 0.2–0.8% (สุ่ม 2%) จึงไม่เจาะคู่เหล่านี้ */
const prevPairs = (history: VipDraw[]) => { const p = history[history.length - 1]; return p ? [canon2(p.top.slice(-2)), canon2(p.bottom)] : []; };

function drillJp(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const order = pick.order ?? balanceRanking(history).map((x) => x.digit);
  const [a, b] = pick.digits;
  const skip = prevPairs(history);
  const rowA = partnerRow(a, order, skip);
  const rowB = partnerRow(b, order, [...skip, ...rowA.map(canon2)]);
  return [{ digit: a, numbers: rowA }, { digit: b, numbers: rowB }];
}

export const jpFormula: MarketFormula = {
  name: "สูตรนิเคอิ VIP — โมเดลฝึกใหม่ 1,000 งวดล่าสุด + กฎถ่วงดุล (ปรับ 11 ต.ค. 69)",
  evidence: "**ปรับใหม่ 11 ต.ค. 69** เพราะสูตรเดิม (โมเดลน้ำหนักตายตัว) ใช้จริง 26 งวดหลัง 27 ก.ย. ได้แค่ ★ 34.6% / 2 ตัว 42.3% และตรวจย้อนหลังพบว่าหมดแรงตั้งแต่ต้นปี 69 (ปี 69 ★ 33.4% / 2 ตัว 56.0% = เท่าสุ่ม ทั้งที่ปี 67–68 ได้ 38.0 / 65.5) — นิสัยเครื่องเปลี่ยน · วิธีใหม่รวมอันดับ 2 ตัว: (1) โมเดล logistic 45 ตัวแปร ฝึกใหม่เองจาก 1,000 งวดล่าสุดทุก 100 งวด (2) กฎถ่วงดุล ตัดเลขที่ออกงวดก่อน แล้วเลือกเลขที่ออกน้อยสุดใน 100 งวด · เลือกจาก 8 แบบด้วยการทดสอบแบบฝึกใหม่ทุก fold · วัดผ่านท่อสูตรจริงทีละงวด: ปี 66 ★ 39.5 / 63.3 · ปี 67 40.0 / 64.9 · ปี 68 34.5 / 59.5 · **ปี 69 ★ 37.5 / 2 ตัว 63.3 (สุ่ม 33 / 57)** · แยกรอบปี 69: เช้า 36.0 / 60.8 · บ่าย 38.9 / 65.7 · 26 งวดที่สูตรเดิมพลาด (28 ก.ย.–10 ต.ค.): ★ 42.3 / 73.1 · ⚠ ได้เปรียบแค่ +4–6 จุดจากสุ่ม รอบเช้าอ่อนกว่าบ่าย — นิสัยที่ยังเหลือจริงคือ 'เลขที่เพิ่งออกงวดก่อนกลับมาน้อย' ซึ่งชัดเฉพาะรอบบ่าย (ปี 69: 28.8% vs 35.3%) · ล่างไม่เคยซ้ำล่างงวดก่อน · 26 งวดเป็นตัวอย่างเล็ก ผลระยะสั้นแกว่งได้ ±18 จุด",
  pick: pickJp,
  drill: drillJp,
  noManualOpen: true, // ถอดสูตรทดลอง B (จากทศนิยมราคาเปิด) 13 ต.ค. 69 — แพ้สูตรหลัก และผล VIP ไม่ผูกกับราคาเปิด · ระบบยังเก็บราคาเปิดเองจากฟีด
  minHistory: JP_MIN_HISTORY,
  lockedFrom: "2026-10-12", // เลขที่ล็อกก่อน 12 ต.ค. 69 มาจากสูตรเดิม (รวมงวด 11 ต.ค. ที่ล็อกไปก่อนแก้สูตร)
  drillRandom: 0.467, // เจาะ 12 ตัว (6/6) แบบสุ่มคู่ ตัดเบิ้ล จากเลขฟันชุดเดียวกัน 2,456 งวด — ป้ายเดิม ~42% ต่ำไป ทำให้เลขเจาะดูดีเกินจริง
};
