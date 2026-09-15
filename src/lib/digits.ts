/**
 * วิเคราะห์ "เลข" จากผลเปิด/ปิดของดัชนี (แบบ SENSEX) — ไม่สนใจหลักร้อย
 *   2 ตัวบน  = หลักหน่วย + ทศนิยมตำแหน่งแรก ของค่าดัชนี  เช่น 74,781.76 → "76"   (176 ตัดหลักร้อย)
 *   2 ตัวล่าง = ทศนิยม 2 ตำแหน่ง ของค่าเปลี่ยนแปลง        เช่น −120.83  → "83"
 * "เลขปิด" ของวัน = เลขโดดทั้งหมดใน บน+ล่าง (สูงสุด 4 ตัว)
 *
 * โมเดล: ใส่เลขเปิดวันนี้ → ให้ความน่าจะเป็นที่เลข 0–9 แต่ละตัวจะปรากฏตอนปิด โดยดูจากประวัติว่า
 *   1. เลขที่อยู่ในเลขเปิด → ไปโผล่ตอนปิดบ่อยแค่ไหน
 *   2. เลขที่อยู่ในเลขปิดเมื่อวาน → เด้งซ้ำบ่อยแค่ไหน
 *   3. เลขที่เด้งติดกัน ≥2 วัน → ยังเด้งต่อบ่อยแค่ไหน
 *   4. ความถี่พื้นฐานช่วงหลัง
 * แล้วทดสอบย้อนหลัง (walk-forward) ว่าถ้าใช้วิธีนี้ทุกวันที่ผ่านมา จะทายถูกกี่ %
 */

export type DigitSource = {
  date: Date;
  openValue: number;
  openChange: number;
  closeValue: number;
  closeChange: number;
};

import { forecastDirection, type RecordLike } from "./stats";

export const DIGITS = "0123456789".split("");

/** "76" จาก 74781.76 (หลักหน่วย + ทศนิยม 2 ตำแหน่ง แล้วตัดหลักร้อย) */
export function top2(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  return String(cents % 100).padStart(2, "0");
}

/** "83" จาก −120.83 */
export function bottom2(change: number): string {
  const cents = Math.round(Math.abs(change) * 100);
  return String(cents % 100).padStart(2, "0");
}

export const uniqueDigits = (s: string) => [...new Set(s.split(""))];

/** ตำแหน่งของเลขเปิด 4 ตำแหน่ง ที่อาจถูก "เอามาปิด" */
export const POSITIONS = ["topTens", "topUnits", "botTens", "botUnits"] as const;
export type Position = (typeof POSITIONS)[number];
export const positionLabel: Record<Position, string> = {
  topTens: "บน หลักสิบ",
  topUnits: "บน หลักหน่วย",
  botTens: "ล่าง หลักสิบ",
  botUnits: "ล่าง หลักหน่วย",
};
export const positionDigits = (top: string, bot: string): Record<Position, string> => ({
  topTens: top[0], topUnits: top[1], botTens: bot[0], botUnits: bot[1],
});

export type DayDigits = {
  date: Date;
  openTop2: string;
  openBottom2: string;
  closeTop2: string;
  closeBottom2: string;
  openDigits: string[];
  closeDigits: string[];
  /** เลขปิดวันนี้ที่ซ้ำกับปิดเมื่อวาน (= "เด้ง") */
  bouncedFromPrev: string[];
  /** เลขปิดวันนี้ที่ซ้ำกับเลขเปิดวันนี้ */
  fromOpen: string[];
  /** ตำแหน่งของเลขเปิดที่ถูกเอามาปิด */
  carriedPositions: Position[];
};

export function toDayDigits(records: DigitSource[]): DayDigits[] {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const out: DayDigits[] = [];
  for (const r of sorted) {
    const openTop2 = top2(r.openValue);
    const openBottom2 = bottom2(r.openChange);
    const closeTop2 = top2(r.closeValue);
    const closeBottom2 = bottom2(r.closeChange);
    const openDigits = uniqueDigits(openTop2 + openBottom2);
    const closeDigits = uniqueDigits(closeTop2 + closeBottom2);
    const prev = out[out.length - 1];
    const pos = positionDigits(openTop2, openBottom2);
    out.push({
      date: r.date, openTop2, openBottom2, closeTop2, closeBottom2, openDigits, closeDigits,
      bouncedFromPrev: prev ? closeDigits.filter((d) => prev.closeDigits.includes(d)) : [],
      fromOpen: closeDigits.filter((d) => openDigits.includes(d)),
      carriedPositions: POSITIONS.filter((k) => closeDigits.includes(pos[k])),
    });
  }
  return out;
}

/** นับ (hit, n) ของเงื่อนไข: ในวันที่ cond(day, digit) เป็นจริง เลขนั้นโผล่ตอนปิดกี่ครั้ง */
type Rate = { hit: number; n: number };
const rate = (hit: number, n: number, prior: number, k = 3) => (hit + k * prior) / (n + k);

function streakBefore(days: DayDigits[], upTo: number, digit: string) {
  let s = 0;
  for (let i = upTo - 1; i >= 0 && days[i].closeDigits.includes(digit); i--) s++;
  return s;
}

export type Evidence = { kind: "open" | "prev" | "streak" | "base"; label: string; p: number; n: number };

export type DigitScore = {
  digit: string;
  p: number; // ความน่าจะเป็นที่จะโผล่ตอนปิด
  evidence: Evidence[];
  inOpen: boolean;
  inPrevClose: boolean;
  streak: number;
  recentDays: number; // โผล่กี่วันในช่วง window
};

export type Model = {
  /** เงื่อนไขแบบรวมทุกเลข (pooled) ใช้เป็น prior เมื่อข้อมูลรายเลขน้อย */
  pooled: { open: Rate; prev: Rate; streak2: Rate; base: Rate };
  perDigit: Record<string, { open: Rate; prev: Rate; streak2: Rate; base: Rate }>;
  /** เลขในตำแหน่งนี้ของเลขเปิด ถูกเอามาปิดกี่ครั้ง (ไม่แยกเลข) */
  position: Record<Position, Rate>;
  /** วันที่มีอย่างน้อย 1 ตำแหน่งถูกเอามาปิด */
  anyPosition: Rate;
};

/** สร้างโมเดลจากประวัติ days[0..end) */
export function fitModel(days: DayDigits[], end = days.length, window = 20): Model {
  const empty = (): Rate => ({ hit: 0, n: 0 });
  const pooled = { open: empty(), prev: empty(), streak2: empty(), base: empty() };
  const perDigit: Model["perDigit"] = {};
  for (const d of DIGITS) perDigit[d] = { open: empty(), prev: empty(), streak2: empty(), base: empty() };

  const position = { topTens: empty(), topUnits: empty(), botTens: empty(), botUnits: empty() };
  const anyPosition = empty();

  const start = Math.max(0, end - window);
  for (let i = 0; i < end; i++) {
    const day = days[i];
    const prev = i > 0 ? days[i - 1] : null;
    for (const k of POSITIONS) { position[k].n++; if (day.carriedPositions.includes(k)) position[k].hit++; }
    anyPosition.n++; if (day.carriedPositions.length) anyPosition.hit++;
    for (const d of DIGITS) {
      const hit = day.closeDigits.includes(d) ? 1 : 0;
      const pd = perDigit[d];
      if (i >= start) { pd.base.n++; pd.base.hit += hit; pooled.base.n++; pooled.base.hit += hit; }
      if (day.openDigits.includes(d)) { pd.open.n++; pd.open.hit += hit; pooled.open.n++; pooled.open.hit += hit; }
      if (prev?.closeDigits.includes(d)) { pd.prev.n++; pd.prev.hit += hit; pooled.prev.n++; pooled.prev.hit += hit; }
      if (streakBefore(days, i, d) >= 2) { pd.streak2.n++; pd.streak2.hit += hit; pooled.streak2.n++; pooled.streak2.hit += hit; }
    }
  }
  return { pooled, perDigit, position, anyPosition };
}

/**
 * ให้คะแนนเลข 0–9 สำหรับวันนี้
 * @param history วันก่อนหน้าทั้งหมด (เรียงเก่า→ใหม่)
 * @param openTop2/openBottom2 เลขเปิดวันนี้
 */
export function scoreDigits(history: DayDigits[], openTop2: string, openBottom2: string, model = fitModel(history)): DigitScore[] {
  const openDigits = uniqueDigits(openTop2 + openBottom2);
  const openPos = positionDigits(openTop2, openBottom2);
  const prev = history[history.length - 1] ?? null;
  // prior ระดับบนสุด: ปิดมี ~4 เลขจาก 10 → ~0.4
  const basePrior = rate(model.pooled.base.hit, model.pooled.base.n, 0.4, 5);
  const pooledOpen = rate(model.pooled.open.hit, model.pooled.open.n, basePrior, 5);
  const pooledPrev = rate(model.pooled.prev.hit, model.pooled.prev.n, basePrior, 5);
  const pooledStreak = rate(model.pooled.streak2.hit, model.pooled.streak2.n, pooledPrev, 5);

  return DIGITS.map((digit) => {
    const pd = model.perDigit[digit];
    const inOpen = openDigits.includes(digit);
    const inPrevClose = prev?.closeDigits.includes(digit) ?? false;
    const streak = streakBefore(history, history.length, digit);

    const base = rate(pd.base.hit, pd.base.n, basePrior);
    const evidence: Evidence[] = [{ kind: "base", label: `ความถี่ช่วงหลัง ${pd.base.hit}/${pd.base.n} วัน`, p: base, n: pd.base.n }];
    if (inOpen) {
      // ตำแหน่งที่เลขนี้อยู่ในเลขเปิด → ใช้อัตราของตำแหน่งที่ "มาปิด" บ่อยสุดเป็น prior
      const positions = POSITIONS.filter((k) => openPos[k] === digit);
      const best = positions
        .map((k) => ({ k, p: rate(model.position[k].hit, model.position[k].n, pooledOpen, 3) }))
        .sort((a, b) => b.p - a.p)[0];
      evidence.push({
        kind: "open",
        label: `อยู่ในเลขเปิดวันนี้: ${positions.map((k) => positionLabel[k]).join(", ")} (ตำแหน่งนี้มาปิด ${Math.round(best.p * 100)}%)`,
        p: rate(pd.open.hit, pd.open.n, best.p),
        n: pd.open.n,
      });
    }
    if (inPrevClose) evidence.push({ kind: "prev", label: `อยู่ในเลขปิดเมื่อวาน (${prev!.closeTop2}/${prev!.closeBottom2})`, p: rate(pd.prev.hit, pd.prev.n, pooledPrev), n: pd.prev.n });
    if (streak >= 2) evidence.push({ kind: "streak", label: `เด้งติดกัน ${streak} วัน`, p: rate(pd.streak2.hit, pd.streak2.n, pooledStreak), n: pd.streak2.n });

    // ถ่วงน้ำหนัก: หลักฐานเฉพาะเจาะจงหนักกว่าความถี่พื้นฐาน
    const weight: Record<Evidence["kind"], number> = { base: 1, open: 2, prev: 2, streak: 1.5 };
    const wsum = evidence.reduce((s, e) => s + weight[e.kind], 0);
    const p = evidence.reduce((s, e) => s + weight[e.kind] * e.p, 0) / wsum;

    return { digit, p, evidence, inOpen, inPrevClose, streak, recentDays: pd.base.hit };
  }).sort((a, b) => b.p - a.p);
}

/**
 * โหมด "ดูจากเปิดอย่างเดียว": ผู้สมัครคือเลขในเลขเปิด 4 ตำแหน่ง
 * คะแนน = โอกาสที่อย่างน้อย 1 ตำแหน่งที่เลขนั้นอยู่ จะถูก "เอามาปิด"
 * (อัตราต่อตำแหน่งเรียนรู้จากประวัติ; ไม่มีประวัติ → เริ่มที่ 50% ทุกตำแหน่ง)
 */
export function scoreFromOpen(history: DayDigits[], openTop2: string, openBottom2: string, model = fitModel(history)): DigitScore[] {
  const openPos = positionDigits(openTop2, openBottom2);
  const posRate = (k: Position) => rate(model.position[k].hit, model.position[k].n, 0.5, 2);

  return uniqueDigits(openTop2 + openBottom2).map((digit) => {
    const positions = POSITIONS.filter((k) => openPos[k] === digit);
    const evidence: Evidence[] = positions.map((k) => ({
      kind: "open" as const,
      label: `${positionLabel[k]} (ตำแหน่งนี้มาปิด ${model.position[k].hit}/${model.position[k].n} วัน)`,
      p: posRate(k),
      n: model.position[k].n,
    }));
    // noisy-OR: โผล่ถ้าตำแหน่งใดตำแหน่งหนึ่งมาปิด
    const byPosition = 1 - evidence.reduce((acc, e) => acc * (1 - e.p), 1);
    // ตัวตัดสินเมื่อเสมอกัน: เลขนี้เองเวลาอยู่ในเลขเปิด เคยมาปิดบ่อยแค่ไหน
    const pd = model.perDigit[digit].open;
    const p = 0.85 * byPosition + 0.15 * rate(pd.hit, pd.n, byPosition, 2);
    return { digit, p, evidence, inOpen: true, inPrevClose: false, streak: 0, recentDays: pd.hit };
  }).sort((a, b) => b.p - a.p);
}

export type Backtest = {
  days: number; // จำนวนวันที่ทดสอบ
  /** สำหรับ k = 1,2,3: ทายเลข top-k แล้วโผล่อย่างน้อย 1 ตัว / โผล่ครบทุกตัว */
  topK: { k: number; atLeastOne: number; all: number; randomAtLeastOne: number }[];
  /** ฟัน 2 ตัวจากเลขเดี่ยว (pickTwo): มาทั้งคู่ / อย่างน้อย 1 ตัว */
  pair?: { both: number; any: number };
  /** คู่ผูก (pickPair เลือกจากโอกาสมาทั้งคู่): มาทั้งคู่ / อย่างน้อย 1 ตัว */
  tied?: { both: number; any: number };
  /** ตัวหลักแบบยุติธรรม: วันที่เสมอกันนับสัดส่วนของกลุ่มที่โผล่ (ไม่ขึ้นกับว่าเลือกตัวไหนในกลุ่ม) */
  fairTop1?: number;
  tieDays?: number;
  avgCloseSize: number; // ปิดมีเลขเฉลี่ยกี่ตัว
  perDay: { date: Date; predicted: string[]; actual: string[]; hits: string[] }[];
};

/** ทดสอบย้อนหลังแบบ walk-forward: วันที่ i ใช้แค่ข้อมูลก่อนหน้า */
export function backtest(days: DayDigits[], minHistory = 0): Backtest {
  const perDay: Backtest["perDay"] = [];
  for (let i = minHistory; i < days.length; i++) {
    const history = days.slice(0, i);
    const ranked = scoreFromOpen(history, days[i].openTop2, days[i].openBottom2);
    const predicted = ranked.slice(0, 3).map((s) => s.digit);
    perDay.push({ date: days[i].date, predicted, actual: days[i].closeDigits, hits: predicted.filter((d) => days[i].closeDigits.includes(d)) });
  }
  const n = perDay.length;
  const avgCloseSize = days.length ? days.reduce((s, d) => s + d.closeDigits.length, 0) / days.length : 0;
  const choose = (a: number, b: number) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return r; };
  const topK = [1, 2, 3].map((k) => {
    const atLeastOne = n ? perDay.filter((d) => d.predicted.slice(0, k).some((x) => d.actual.includes(x))).length / n : 0;
    const all = n ? perDay.filter((d) => d.predicted.slice(0, k).every((x) => d.actual.includes(x))).length / n : 0;
    const m = Math.round(avgCloseSize);
    const randomAtLeastOne = 10 - m >= k ? 1 - choose(10 - m, k) / choose(10, k) : 1;
    return { k, atLeastOne, all, randomAtLeastOne };
  });
  return { days: n, topK, avgCloseSize, perDay };
}

/* ---------- โครงสร้าง: ล่าง คำนวณได้จาก บน + ทศนิยมของปิดวันก่อน ---------- */

const cents = (x: number) => Math.round(Math.abs(x) * 100) % 100;

/** ทศนิยม 2 หลักของ "ปิดวันก่อน" (= ค่าเปิด − เปลี่ยนแปลงตอนเปิด) รู้ได้ตั้งแต่เช้า */
export const prevCloseCents = (openValue: number, openChange: number) => cents(openValue - openChange);

/**
 * ถ้า 2 ตัวบน = top และปิดวันก่อนมีทศนิยม D
 *   ปิดสูงกว่าเมื่อวาน → ล่าง = (top − D) mod 100
 *   ปิดต่ำกว่าเมื่อวาน → ล่าง = (D − top) mod 100
 */
export function bottomFromTop(top: number, D: number, up: boolean): string {
  const v = up ? top - D : D - top;
  return String(((v % 100) + 100) % 100).padStart(2, "0");
}

/**
 * ความน่าจะเป็นที่เลข 0–9 จะปรากฏตอนปิด (บน ∪ ล่าง) โดยไล่ทุกกรณี บน = 00..99
 * ถ่วงด้วยโอกาสปิดขึ้น pUp — นี่คือค่าที่ "คณิตศาสตร์ล้วน" ให้ได้ เมื่อ บน สุ่ม
 */
export type Outcome = { top: string; bottom: string; up: boolean; set: Set<string>; w: number };

/** ทุกกรณีที่เป็นไปได้ของวันนี้: บน 00–99 × ทิศทาง (200 กรณี) พร้อมน้ำหนัก — บนสุ่ม, ทิศทางตาม pUp */
export function enumerateOutcomes(D: number, pUp = 0.5): Outcome[] {
  const out: Outcome[] = [];
  for (let t = 0; t < 100; t++) {
    const top = String(t).padStart(2, "0");
    for (const [up, w] of [[true, pUp], [false, 1 - pUp]] as const) {
      const bottom = bottomFromTop(t, D, up);
      out.push({ top, bottom, up, set: new Set((top + bottom).split("")), w: w / 100 });
    }
  }
  return out;
}

export function exactDigitProbs(D: number, pUp = 0.5): { digit: string; p: number }[] {
  return digitPositionProbs(D, pUp).map(({ digit, p }) => ({ digit, p }));
}

/** เรียงมาก→น้อย; เสมอกัน (ต่างกันแค่ floating point) → เลขมากก่อน เพื่อให้ทุกหน้าฟันเลขเดียวกัน (กฎตัดสินเสมอทุกแบบได้ ~36% เท่ากันบน 10 ปี) */
const byProb = <T extends { p: number; digit: string }>(a: T, b: T) => Math.round(b.p * 1e9) - Math.round(a.p * 1e9) || b.digit.localeCompare(a.digit);

/* ---------- ฟันคู่: เลือก 2 ตัวที่ "มาทั้งคู่" บ่อยสุด ---------- */

/**
 * เลขคู่ไม่เป็นอิสระต่อกัน: ล่าง = บน ∓ D ทำให้บางคู่มาด้วยกันเสมอ (เช่น D=76 ปิดขึ้น: บน 76 → ล่าง 00)
 * เลือกคู่จากการไล่ 200 กรณีตรง ๆ จึงได้ "มาทั้งคู่" ≈ 18% (10 ปี) เทียบกับ 11% ถ้าเอา 2 อันดับแรกของเลขเดี่ยวมาจับคู่ และ 10% ถ้าสุ่ม
 * แลกกับ "อย่างน้อย 1 ตัว" ที่ลดจาก 61% เหลือ ~50%
 */
export type PairPick = { pair: [string, string]; pBoth: number; pAny: number };
/** ค่าอ้างอิง 10 ปี (SENSEX 2,461 วัน) สำหรับเทียบบนหน้าจอ */
export const PAIR_BASE = { both10y: 0.179, bothRandom: 0.098, bothMarginal: 0.111 } as const;

export function pairProbs(D: number, pUp = 0.5): PairPick[] {
  const O = enumerateOutcomes(D, pUp);
  const out: PairPick[] = [];
  for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
    const A = String(a), B = String(b);
    let both = 0, any = 0;
    for (const o of O) { const ha = o.set.has(A), hb = o.set.has(B); if (ha && hb) both += o.w; if (ha || hb) any += o.w; }
    out.push({ pair: [A, B], pBoth: both, pAny: any });
  }
  return out.sort((x, y) => y.pBoth - x.pBoth || y.pAny - x.pAny);
}

export function pickPair(openValue: number, openChange: number, priceHistory: RecordLike[] = []): PairPick {
  const D = prevCloseCents(openValue, openChange);
  const { pUp } = forecastDirection(openValue, openChange, priceHistory);
  return pairProbs(D, pUp)[0];
}

/* ---------- ฟัน 2 ตัวจากเลขเดี่ยว + ตำแหน่งที่จะมา (หลักสิบ/หลักหน่วย ของบน/ล่าง) ---------- */

export type DigitDetail = {
  digit: string;
  p: number;                         // โอกาสโผล่ที่ตำแหน่งใดก็ได้
  pos: Record<Position, number>;     // โอกาสอยู่ในแต่ละตำแหน่ง
  tens: number;                      // อยู่หลักสิบ (บนหรือล่าง)
  units: number;                     // อยู่หลักหน่วย (บนหรือล่าง)
  top: number;                       // อยู่ในบน
  bottom: number;                    // อยู่ในล่าง
  /** ถ้ามา → อยู่หลักสิบ / หลักหน่วย กี่ % (ซ้อนกันได้ถ้ามาทั้งสองหลัก) */
  givenTens: number;
  givenUnits: number;
};

/** โอกาสของเลข 0–9 แยกตามตำแหน่ง จากการไล่ 200 กรณี (บนสุ่ม → แต่ละตำแหน่ง ≈10% ต่างกันได้เฉพาะเมื่อ D ทำให้ตำแหน่งซ้ำกัน) */
export function digitPositionProbs(D: number, pUp = 0.5): DigitDetail[] {
  const O = enumerateOutcomes(D, pUp);
  return DIGITS.map((digit) => {
    const pos = { topTens: 0, topUnits: 0, botTens: 0, botUnits: 0 };
    let any = 0, tens = 0, units = 0, top = 0, bottom = 0;
    for (const o of O) {
      const at = positionDigits(o.top, o.bottom);
      const hit = POSITIONS.filter((k) => at[k] === digit);
      for (const k of hit) pos[k] += o.w;
      if (hit.length) any += o.w;
      if (at.topTens === digit || at.botTens === digit) tens += o.w;
      if (at.topUnits === digit || at.botUnits === digit) units += o.w;
      if (at.topTens === digit || at.topUnits === digit) top += o.w;
      if (at.botTens === digit || at.botUnits === digit) bottom += o.w;
    }
    return { digit, p: any, pos, tens, units, top, bottom, givenTens: any ? tens / any : 0, givenUnits: any ? units / any : 0 };
  }).sort(byProb);
}

export type TwoPick = {
  digits: [DigitDetail, DigitDetail];
  pAny: number;
  pBoth: number;
  /** เลขที่เสมอกับตัวหลัก (โอกาสเท่ากันเป๊ะ) — วันส่วนใหญ่เสมอกัน 6–8 ตัว ตัวหลักจึงเป็นแค่ตัวแทนของกลุ่มนี้ */
  tiedWithMain: string[];
};
export const tiedGroup = <T extends { p: number; digit: string }>(sorted: T[]) =>
  sorted.filter((d) => Math.round(d.p * 1e6) === Math.round(sorted[0].p * 1e6)).map((d) => d.digit);

/**
 * ฟัน 2 ตัวจากเลขเดี่ยว
 *   ตัวหลัก = เลขที่โอกาสโผล่สูงสุด (เสมอกัน → เลขมากก่อน; วันส่วนใหญ่เสมอกัน 6–8 ตัว ทุกกฎตัดสินเสมอได้ ~36% เท่ากันบน 10 ปี)
 *   ตัวรอง = คู่ของตัวหลักที่ทำให้ "อย่างน้อย 1 ใน 2 โผล่" สูงสุด (10 ปี 63.5% เทียบสุ่ม 59%)
 */
export function pickTwo(openValue: number, openChange: number, priceHistory: RecordLike[] = []): TwoPick {
  const D = prevCloseCents(openValue, openChange);
  const { pUp } = forecastDirection(openValue, openChange, priceHistory);
  const details = digitPositionProbs(D, pUp);
  const first = details[0];
  const O = enumerateOutcomes(D, pUp);
  let best: { d: DigitDetail; any: number; both: number } | null = null;
  for (const d of details.slice(1)) {
    let any = 0, both = 0;
    for (const o of O) { const a = o.set.has(first.digit), b = o.set.has(d.digit); if (a || b) any += o.w; if (a && b) both += o.w; }
    if (!best || Math.round(any * 1e9) > Math.round(best.any * 1e9)) best = { d, any, both };
  }
  return { digits: [first, best!.d], pAny: best!.any, pBoth: best!.both, tiedWithMain: tiedGroup(details) };
}

/** ระดับความแข็งของคู่วันนี้ เทียบการกระจาย 10 ปี (ส่วนใหญ่ 14–20%) */
export const pairLevel = (pBoth: number) => (pBoth >= 0.22 ? "คู่แข็ง" : pBoth < 0.14 ? "คู่อ่อน" : "ปกติ");

/* ---------- ฟันเลขแบบ "คณิตศาสตร์": D + ทิศทาง (ดีสุดเท่าที่ข้อมูลรองรับ ≈ 36–37%) ---------- */

export type DigitPick = { digit: string; p: number };

/**
 * จัดอันดับเลข 0–9 สำหรับวันนี้จากตัวเปิด:
 *   D = ทศนิยมปิดวันก่อน (จากค่าเปิด − เปลี่ยนแปลง), ทิศทาง = ตามขนาดที่เปิดห่าง (สถิติ 10 ปี + ของผู้ใช้)
 *   แล้วไล่ทุกกรณี บน 00–99 → เลขไหนโผล่ใน บน∪ล่าง บ่อยสุด
 */
export function pickDigits(openValue: number, openChange: number, priceHistory: RecordLike[] = []): DigitPick[] {
  const D = prevCloseCents(openValue, openChange);
  const { pUp } = forecastDirection(openValue, openChange, priceHistory);
  return exactDigitProbs(D, pUp);
}

/** ทดสอบย้อนหลังของ pickDigits (ทิศทางใช้เฉพาะข้อมูลก่อนหน้าวันนั้น) */
export function backtestPicks(records: RecordLike[], minHistory = 0): Backtest {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const days = toDayDigits(sorted);
  const perDay: Backtest["perDay"] = [];
  let pairBoth = 0, pairAny = 0, tiedBoth = 0, tiedAny = 0, fair = 0, tieDays = 0;
  for (let i = minHistory; i < sorted.length; i++) {
    const hist = sorted.slice(0, i);
    const two = pickTwo(sorted[i].openValue, sorted[i].openChange, hist);
    fair += two.tiedWithMain.filter((d) => days[i].closeDigits.includes(d)).length / two.tiedWithMain.length;
    if (two.tiedWithMain.length > 1) tieDays++;
    const third = pickDigits(sorted[i].openValue, sorted[i].openChange, hist).map((x) => x.digit).find((d) => !two.digits.some((t) => t.digit === d))!;
    const predicted = [two.digits[0].digit, two.digits[1].digit, third];
    const hits = predicted.filter((d) => days[i].closeDigits.includes(d));
    perDay.push({ date: days[i].date, predicted, actual: days[i].closeDigits, hits });
    const two2 = hits.filter((d) => d !== third).length;
    if (two2 === 2) pairBoth++; if (two2 >= 1) pairAny++;
    const { pair } = pickPair(sorted[i].openValue, sorted[i].openChange, hist);
    const hit = pair.filter((d) => days[i].closeDigits.includes(d)).length;
    if (hit === 2) tiedBoth++; if (hit >= 1) tiedAny++;
  }
  const n = perDay.length;
  const avgCloseSize = days.length ? days.reduce((s, d) => s + d.closeDigits.length, 0) / days.length : 0;
  const choose = (a: number, b: number) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return r; };
  const topK = [1, 2, 3].map((k) => {
    const atLeastOne = n ? perDay.filter((d) => d.predicted.slice(0, k).some((x) => d.actual.includes(x))).length / n : 0;
    const all = n ? perDay.filter((d) => d.predicted.slice(0, k).every((x) => d.actual.includes(x))).length / n : 0;
    const m = Math.round(avgCloseSize);
    const randomAtLeastOne = 10 - m >= k ? 1 - choose(10 - m, k) / choose(10, k) : 1;
    return { k, atLeastOne, all, randomAtLeastOne };
  });
  return {
    days: n, topK, avgCloseSize, perDay,
    pair: n ? { both: pairBoth / n, any: pairAny / n } : undefined,
    tied: n ? { both: tiedBoth / n, any: tiedAny / n } : undefined,
    fairTop1: n ? fair / n : undefined,
    tieDays,
  };
}
