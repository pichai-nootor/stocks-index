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

const choose = (a: number, b: number) => { let r = 1; for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i; return r; };
/** สุ่มเลือก k เลขไม่ซ้ำ แล้วโผล่อย่างน้อย 1 — เฉลี่ยตามจำนวนเลขปิดจริงของแต่ละวัน (m_i) แทนการปัด m เป็นจำนวนเต็ม */
export function randomAtLeastOne(closeSizes: number[], k: number) {
  if (!closeSizes.length) return 0;
  return closeSizes.reduce((s, m) => s + (10 - m >= k ? 1 - choose(10 - m, k) / choose(10, k) : 1), 0) / closeSizes.length;
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
  /** เลขเจาะ (กลับได้): ต่อชุด / ทั้งวัน (2 ชุด) มาอย่างน้อย 1 */
  drill?: { set: number; any: number };
  avgCloseSize: number; // ปิดมีเลขเฉลี่ยกี่ตัว
  perDay: { date: Date; predicted: string[]; actual: string[]; hits: string[]; drill?: { numbers: string[]; hits: string[] } }[];
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
  const topK = [1, 2, 3].map((k) => {
    const atLeastOne = n ? perDay.filter((d) => d.predicted.slice(0, k).some((x) => d.actual.includes(x))).length / n : 0;
    const all = n ? perDay.filter((d) => d.predicted.slice(0, k).every((x) => d.actual.includes(x))).length / n : 0;
    return { k, atLeastOne, all, randomAtLeastOne: randomAtLeastOne(perDay.map((d) => d.actual.length), k) };
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

/* แคชผลที่ขึ้นกับ (D, pUp) เท่านั้น — ผลลัพธ์เหมือนเดิมทุกตัว แค่ไม่คำนวณซ้ำ (หน้าหุ้น 2,000+ วัน มี D ไม่เกิน 100 แบบ) */
const outcomeCache = new Map<string, Outcome[]>();
const probsCache = new Map<string, DigitDetail[]>();
const drillCache = new Map<string, Drill>();
const cacheKey = (D: number, pUp: number) => `${D}|${Math.round(pUp * 1e6)}`;

/** ทุกกรณีที่เป็นไปได้ของวันนี้: บน 00–99 × ทิศทาง (200 กรณี) พร้อมน้ำหนัก — บนสุ่ม, ทิศทางตาม pUp (อย่าแก้ค่าใน array ที่คืนมา: ใช้ร่วมกัน) */
export function enumerateOutcomes(D: number, pUp = 0.5): Outcome[] {
  const key = cacheKey(D, pUp);
  const hit = outcomeCache.get(key);
  if (hit) return hit;
  const out: Outcome[] = [];
  for (let t = 0; t < 100; t++) {
    const top = String(t).padStart(2, "0");
    for (const [up, w] of [[true, pUp], [false, 1 - pUp]] as const) {
      const bottom = bottomFromTop(t, D, up);
      out.push({ top, bottom, up, set: new Set((top + bottom).split("")), w: w / 100 });
    }
  }
  outcomeCache.set(key, out);
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

const pairCache = new Map<string, PairPick[]>();
export function pairProbs(D: number, pUp = 0.5): PairPick[] {
  const ck = cacheKey(D, pUp);
  const cached = pairCache.get(ck);
  if (cached) return cached;
  const O = enumerateOutcomes(D, pUp);
  const out: PairPick[] = [];
  for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
    const A = String(a), B = String(b);
    let both = 0, any = 0;
    for (const o of O) { const ha = o.set.has(A), hb = o.set.has(B); if (ha && hb) both += o.w; if (ha || hb) any += o.w; }
    out.push({ pair: [A, B], pBoth: both, pAny: any });
  }
  const sorted = out.sort((x, y) => y.pBoth - x.pBoth || y.pAny - x.pAny);
  pairCache.set(ck, sorted);
  return sorted;
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
  const key = cacheKey(D, pUp);
  const hit = probsCache.get(key);
  if (hit) return hit;
  const O = enumerateOutcomes(D, pUp);
  const res = DIGITS.map((digit) => {
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
  probsCache.set(key, res);
  return res;
}

/** อัตราที่เลข 0–9 โผล่ในเลขปิด (บน∪ล่าง) ของ SENSEX 10 ปี 2,462 วัน — ใช้เป็นฐานเลือก "ตัวเด่น" ระหว่าง 2 ตัวที่ฟัน */
export const DIGIT_BASE_RATE: Record<string, number> = { "0": 0.342, "1": 0.377, "2": 0.329, "3": 0.341, "4": 0.355, "5": 0.318, "6": 0.350, "7": 0.349, "8": 0.341, "9": 0.344 };
const DIGIT_BASE_N = 300; // น้ำหนักของฐาน (นับเป็นวัน) — ข้อมูลของหุ้นเองค่อย ๆ ทับเมื่อมีมากขึ้น

/** อัตราโผล่ของเลข ผสมฐาน 10 ปีกับประวัติของหุ้นตัวนี้ */
export function digitRate(digit: string, history: RecordLike[]) {
  let hit = 0;
  for (const r of history) if (uniqueDigits(top2(r.closeValue) + bottom2(r.closeChange)).includes(digit)) hit++;
  return (DIGIT_BASE_RATE[digit] * DIGIT_BASE_N + hit) / (DIGIT_BASE_N + history.length);
}

export type TwoPick = {
  digits: [DigitDetail, DigitDetail];
  /** ตัวเด่น: 1 ใน 2 ตัวที่ฟัน — โอกาสวันนี้สูงกว่า, เสมอกัน → เลขที่โผล่บ่อยกว่าในประวัติ (ฐาน 10 ปี + ของหุ้นนี้) */
  standout: DigitDetail;
  standoutRate: number;
  pAny: number;
  pBoth: number;
  /** ตัวสำรอง (ตัวที่ 3): เลขที่ทำให้ "อย่างน้อย 1 ใน 3 โผล่" สูงสุดเมื่อรวมกับ 2 ตัวแรก */
  third: DigitDetail;
  pAny3: number;
  /** ตัวสำรองที่ 2 (ตัวที่ 4): ทำให้ "อย่างน้อย 1 ใน 4 โผล่" สูงสุด */
  fourth: DigitDetail;
  pAny4: number;
  /** ชุดวิน 5 ตัว (บน หรือ ล่าง อยู่ครบในชุด) */
  win: { digits: string[]; pWin: number; pBoth: number };
  /** เลขที่เสมอกับตัวหลัก (โอกาสเท่ากันเป๊ะ) — วันส่วนใหญ่เสมอกัน 6–8 ตัว ตัวหลักจึงเป็นแค่ตัวแทนของกลุ่มนี้ */
  tiedWithMain: string[];
  /** เลขเจาะ: เลข 2 ตัวที่มีเลขที่ฟันอยู่ด้วย ชุดละ DRILL_PER_DIGIT ตัว (กลับได้) */
  drill: Drill;
  /**
   * โอกาสที่ปิดจะมี "เลขเบิ้ล" (บน หรือ ล่าง) — จากโครงสร้างล้วน ๆ: บนเบิ้ล 10% เสมอ, ล่างเบิ้ล 10% เสมอ
   * ซ้อนกันได้เฉพาะเมื่อ D เป็นเบิ้ล (บนเบิ้ล → ล่างเบิ้ลด้วย) → วัน D เบิ้ล ≈ 10%, วันอื่น ≈ 20% (10 ปี: 12.1% / 19.8%)
   * ไม่มีทางรู้ว่าเลขไหนจะเบิ้ล และไม่มีลักษณะเลขเปิดใดทำให้เบิ้ลบ่อยขึ้น (ตรวจ 120 เงื่อนไข) — บอกได้แค่ "วันนี้ต่ำหรือปกติ"
   */
  pDouble: number;
};

/* ---------- เลขเจาะ: จากเลขเดี่ยวที่ฟัน → เลข 2 ตัว ไม่กี่ตัวต่อเลข ---------- */

/**
 * จำนวนเลขเจาะต่อเลขที่ฟัน — ทุกเลข 2 ตัวมีโอกาส ~4% เท่ากัน จึงเป็นเส้นตรง: 10 ปี 3 ตัว 12.6% · 4 ตัว 16.5% · 5 ตัว 20.7% · 6 ตัว 23.9% ต่อชุด
 * (ต่อเลขที่แทง ~4.1% ทุกขนาด ไม่มีจุดที่คุ้มกว่ากัน) — ผู้ใช้เลือก 6 (12 เลขต่อวัน) เพื่อโอกาสมาบ่อยสุด
 */
export const DRILL_PER_DIGIT = 6;
export type DrillNumber = { number: string; p: number };
export type DrillSet = { digit: string; numbers: DrillNumber[]; pAny: number };
export type Drill = { sets: [DrillSet, DrillSet]; pAny: number };
/** ค่าอ้างอิง 10 ปี (SENSEX, กลับได้, 6 ตัวต่อชุด): ต่อชุด / อย่างน้อย 1 ใน 12 ตัวของทั้งวัน — ใกล้เพดาน 48% (4% ต่อเลขเมื่อ บน สุ่ม); ที่ได้เหนือสุ่มมาจากการเลี่ยงเลขที่มาในกรณีเดียวกัน */
export const DRILL_BASE = { set10y: 0.242, setRandom: 0.226, day10y: 0.475, dayRandom: 0.401 } as const;

/** เลข 2 ตัว m "มา" ถ้าเท่ากับ บน หรือ ล่าง ตรง ๆ หรือกลับหลัง (โต๊ด) */
const drillHit = (o: Outcome, m: string) => { const r = m[1] + m[0]; return o.top === m || o.top === r || o.bottom === m || o.bottom === r; };
const drillAny = (O: Outcome[], nums: string[]) => O.reduce((s, o) => s + (nums.some((m) => drillHit(o, m)) ? o.w : 0), 0);

/**
 * เจาะเลขจากตัวที่ฟัน: ไล่ 200 กรณีว่าเลข 2 ตัว dX (หรือ Xd) จะเป็น บน หรือ ล่าง กี่ %
 * เมื่อ บน สุ่ม ทุกเลข 2 ตัวมีโอกาสเท่ากัน 1% ต่อตำแหน่ง → กลับได้ ≈ 4% ต่อเลข — สิ่งเดียวที่เลือกได้คือ "อย่าให้เลขในชุดทับกัน":
 * บางคู่มาในกรณีเดียวกันเสมอ (เช่น D ทำให้ ล่าง = บน กลับหลัง) เลือกทั้งคู่ก็เท่ากับเลือกตัวเดียว
 * จึงเลือกทีละตัว (greedy) ให้ "อย่างน้อย 1 ใน 12 ตัวมา" ของทั้งชุดสูงสุด ชุดละ DRILL_PER_DIGIT ตัวเท่ากัน — ลำดับในชุด = ลำดับที่ถูกเลือก (ตัวแรกมีค่าสุด)
 * เสมอกัน → เลขคู่ที่ฟันอีกตัวก่อน แล้วเลขน้อยก่อน · dX กับ Xd คือเลขเดียวกันเมื่อกลับได้ จึงไม่ซ้ำข้ามชุด
 * 10 ปี (2,362 วัน): ทั้งวัน 12 ตัวมาอย่างน้อย 1 = 47.5% (เลือกแยกชุดไม่ดูการทับ 45.5%, สุ่ม 40%, เพดาน 12×4% = 48%) · ต่อชุด 24.2%
 * ลองกฎเลือกคู่ 12 แบบ (เลขร้อน/เลขเย็น 30–200 วัน, เลขเปิด, ปิดเมื่อวาน, D, โอกาสเลขเดี่ยว, คงที่) ได้เท่ากันหมด = noise; เลข 2 ตัวใน 10 ปีกระจายสม่ำเสมอ (บ่อยสุด 1.36% น้อยสุด 0.61% เทียบสุ่ม 1.00%)
 * ถ้าไม่บังคับให้มีเลขที่ฟัน (เลือก 12 ตัวจาก 100 ตามการทับอย่างเดียว) ได้ 48.4% แต่ไม่ใช่ "เจาะ" แล้ว
 */
/**
 * ชุด "วิน" k ตัว — เลือกให้โอกาสที่ **บน หรือ ล่าง อยู่ครบในชุด** สูงสุด (ไล่ทีละตัวแบบ greedy)
 *   วินบนอย่างเดียวไม่มีแต้มต่อ (บนสุ่มล้วน — SENSEX 10 ปี: ชุด 5 ตัว 23.9% เท่าสุ่ม 24.7%)
 *   แต่วิน "บน+ล่าง" ใช้ความผูกพันผ่าน D ได้: ชุด 5 ตัว 49.2% (สุ่ม 45.8%) · ชุด 6 ตัว 65.6% (สุ่ม 60.2%)
 *   ซื้อ k² เลขต่อชุด (6 ตัว = 36 เลข) — ใช้กับหุ้นปกติทุกตัวเพราะเป็นคณิตศาสตร์ของ D ล้วน
 *   ผู้ใช้เลือกชุด 6 ตัว (25 ก.ย. 69): 3 ตัวบน 22.6% (ซื้อ 216 เลข) · 2 ตัว บน/ล่าง 65.6% (ซื้อ 36 เลข)
 */
export function winSet(O: Outcome[], k = 6): { digits: string[]; pWin: number; pBoth: number } {
  // เลือกชุดที่ทำให้ "ทั้งบนและล่างอยู่ในชุดพร้อมกัน" บ่อยที่สุด (ผู้ใช้เลือกแบบนี้ 25 ก.ย. 69)
  //   เทียบกับแบบเดิมที่เลือกให้ "อย่างใดอย่างหนึ่ง": เข้าทั้งคู่ 6.5% → 22.4% (SENSEX 10 ปี)
  //   หมายเหตุผลตอบแทน: ทั้งสองแบบคืนต่ำกว่าทุน (0.89–0.93 ต่อบาท ที่อัตราจ่าย 90) — ดูบันทึกในไฟล์สูตรของหุ้น
  const both = (set: Set<string>) => O.reduce((s, o) => s + (([...o.top].every((c) => set.has(c)) && [...o.bottom].every((c) => set.has(c))) ? o.w : 0), 0);
  const any = (set: Set<string>) => O.reduce((s, o) => s + (([...o.top].every((c) => set.has(c)) || [...o.bottom].every((c) => set.has(c))) ? o.w : 0), 0);
  let best: { digits: string[]; p: number } | null = null;
  const pick = (start: number, chosen: string[]) => {
    if (chosen.length === k) { const p = both(new Set(chosen)); if (!best || p > best.p) best = { digits: [...chosen], p }; return; }
    for (let i = start; i < DIGITS.length; i++) pick(i + 1, [...chosen, DIGITS[i]]);
  };
  pick(0, []);
  const S = new Set(best!.digits);
  return { digits: best!.digits, pWin: any(S), pBoth: both(S) };
}

export function drillNumbers(O: Outcome[], digits: [string, string]): Drill {
  const [a, b] = digits;
  const key = `${O[0].bottom}|${O[1].bottom}|${Math.round(O[0].w * 1e9)}|${a}${b}`; // O ขึ้นกับ (D, pUp) เท่านั้น
  const hit = drillCache.get(key);
  if (hit) return hit;
  const canon = (m: string) => (m[0] <= m[1] ? m : m[1] + m[0]);
  const cands = [
    ...DIGITS.filter((x) => x !== a).map((x) => a + x),
    ...DIGITS.filter((x) => x !== b && x !== a).map((x) => b + x),
  ];
  const chosen: string[] = [];
  const count = (d: string) => chosen.filter((m) => m[0] === d).length;
  while (chosen.length < 2 * DRILL_PER_DIGIT) {
    let best: { m: string; p: number; own: number } | null = null;
    for (const m of cands) {
      if (count(m[0]) >= DRILL_PER_DIGIT || chosen.some((c) => canon(c) === canon(m))) continue;
      const p = drillAny(O, [...chosen, m]);
      const own = drillAny(O, [m]);
      const other = m[0] === a ? b : a;
      const better = !best || Math.round(p * 1e9) > Math.round(best.p * 1e9)
        || (Math.round(p * 1e9) === Math.round(best.p * 1e9) && (Math.round(own * 1e9) > Math.round(best.own * 1e9)
          || (Math.round(own * 1e9) === Math.round(best.own * 1e9) && ((m[1] === other && best.m[1] !== other) || (m[1] === other) === (best.m[1] === other) && m < best.m))));
      if (better) best = { m, p, own };
    }
    if (!best) break;
    chosen.push(best.m);
  }
  const set = (d: string): DrillSet => {
    const numbers = chosen.filter((m) => m[0] === d).map((m) => ({ number: m, p: drillAny(O, [m]) }));
    return { digit: d, numbers, pAny: drillAny(O, numbers.map((n) => n.number)) };
  };
  const out: Drill = { sets: [set(a), set(b)], pAny: drillAny(O, chosen) };
  drillCache.set(key, out);
  return out;
}

export const tiedGroup = <T extends { p: number; digit: string }>(sorted: T[]) =>
  sorted.filter((d) => Math.round(d.p * 1e6) === Math.round(sorted[0].p * 1e6)).map((d) => d.digit);

/**
 * ฟัน 2 ตัวจากเลขเดี่ยว
 *   ตัวหลัก = เลขที่โอกาสโผล่สูงสุด (เสมอกัน → เลขมากก่อน; วันส่วนใหญ่เสมอกัน 6–8 ตัว ทุกกฎตัดสินเสมอได้ ~36% เท่ากันบน 10 ปี)
 *   ตัวรอง = คู่ของตัวหลักที่ทำให้ "อย่างน้อย 1 ใน 2 โผล่" สูงสุด (10 ปี 63.5% เทียบสุ่ม 59%)
 *   ตัวสำรอง = ตัวที่ 3 ที่ทำให้ "อย่างน้อย 1 ใน 3 โผล่" สูงสุด
 */
/**
 * เครื่องคิดกลาง (คณิตศาสตร์ล้วน: ไล่ 200 กรณีจาก D) — ห้ามแก้ไฟล์นี้เพื่อหุ้นตัวใดตัวหนึ่ง
 *   กฎเฉพาะหุ้น (เช่นตัดเลขเสมอ) อยู่ในไฟล์ของหุ้นนั้นที่ formulas/stocks/<หุ้น>.ts แล้วส่งเข้ามาทาง tieKey
 * tieKey: คะแนนตัดเสมอจากข้อมูลจริงของหุ้นนั้น (มาก = มาก่อน) ใช้ทั้งตัวหลักและตัวรอง · เท่ากันอีก/ไม่ส่ง → เลขมากก่อน
 */
export function pickTwo(openValue: number, openChange: number, priceHistory: RecordLike[] = [], tieKey?: (digit: string) => number): TwoPick {
  const D = prevCloseCents(openValue, openChange);
  const { pUp } = forecastDirection(openValue, openChange, priceHistory);
  const details = digitPositionProbs(D, pUp);
  const tied = tiedGroup(details);
  const chosen = tieKey ? tied.reduce((b, d) => (tieKey(d) > tieKey(b) ? d : b)) : null; // tied เรียงตามลำดับเดิม (เลขมากก่อน)
  const first = (chosen && details.find((d) => d.digit === chosen)) || details[0];
  const O = enumerateOutcomes(D, pUp);
  let best: { d: DigitDetail; any: number; both: number } | null = null;
  for (const d of details) {
    if (d.digit === first.digit) continue;
    let any = 0, both = 0;
    for (const o of O) { const a = o.set.has(first.digit), b = o.set.has(d.digit); if (a || b) any += o.w; if (a && b) both += o.w; }
    const cmp = best ? Math.round(any * 1e9) - Math.round(best.any * 1e9) : 1;
    if (cmp > 0 || (cmp === 0 && tieKey && tieKey(d.digit) > tieKey(best!.d.digit))) best = { d, any, both };
  }
  const second = best!.d;
  // เพิ่มทีละตัว (greedy): เลือกตัวที่ทำให้ "อย่างน้อย 1 ตัวโผล่" ของทั้งชุดสูงสุด
  const extend = (chosen: string[]) => {
    let pick: { d: DigitDetail; any: number } | null = null;
    for (const d of details) {
      if (chosen.includes(d.digit)) continue;
      let any = 0;
      for (const o of O) if (chosen.some((c) => o.set.has(c)) || o.set.has(d.digit)) any += o.w;
      if (!pick || Math.round(any * 1e9) > Math.round(pick.any * 1e9)) pick = { d, any };
    }
    return pick!;
  };
  const third = extend([first.digit, second.digit]);
  const fourth = extend([first.digit, second.digit, third.d.digit]);
  const rate = (d: DigitDetail) => digitRate(d.digit, priceHistory);
  const standout = Math.round(first.p * 1e6) !== Math.round(second.p * 1e6) ? first : rate(second) > rate(first) ? second : first;
  const drill = drillNumbers(O, [first.digit, second.digit]);
  const pDouble = O.reduce((s, o) => s + (o.top[0] === o.top[1] || o.bottom[0] === o.bottom[1] ? o.w : 0), 0);
  return { digits: [first, second], standout, standoutRate: rate(standout), pAny: best!.any, pBoth: best!.both, third: third.d, pAny3: third.any, fourth: fourth.d, pAny4: fourth.any, tiedWithMain: tiedGroup(details), drill, pDouble, win: winSet(O, 6) };
}

/**
 * ความแข็งของวัน สำหรับคนแทงเลขเดี่ยว: ดูจากโอกาสของเลขเด่นวันนั้น (ขึ้นกับ D ล้วน ๆ)
 *   10 ปี: วันที่เลขเด่น ≥36% (52% ของวัน) ถูกจริง 38.5% · 34–36% ถูก 34.9% · <34% (17% ของวัน, D มี 0 เช่น 00 50 90 20) ถูกแค่ 29.5%
 *   → ข้ามวันอ่อน ทำให้อัตราถูกในวันที่แทงขยับจาก 36% เป็น ~38%
 */
export type DayStrength = { level: "แข็ง" | "ปกติ" | "อ่อน"; p: number; hint: string };
export function dayStrength(topP: number): DayStrength {
  if (topP >= 0.36) return { level: "แข็ง", p: topP, hint: "วันแบบนี้ 10 ปีถูก 38.5% — แทงได้" };
  if (topP >= 0.34) return { level: "ปกติ", p: topP, hint: "วันแบบนี้ 10 ปีถูก 35% — เท่าค่าเฉลี่ย" };
  return { level: "อ่อน", p: topP, hint: "วันแบบนี้ 10 ปีถูกแค่ 29.5% (D มีเลข 0 ทำให้เลขปิดซ้ำกันเอง) — ไม่แนะนำแทงเลขเดี่ยว" };
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

/**
 * ทดสอบย้อนหลังของการฟัน (ใช้เฉพาะข้อมูลก่อนหน้าวันนั้น)
 *   pick: สูตรของหุ้นตัวนั้น (pickTwoFor) — ไม่ส่ง = เครื่องกลาง · หน้าจอต้องส่งเสมอ ไม่งั้นผลย้อนหลังจะไม่ตรงกับเลขที่ฟันจริง
 */
export function backtestPicks(records: RecordLike[], minHistory = 0, pick: (openValue: number, openChange: number, history: RecordLike[], date: Date) => TwoPick = (o, c, h) => pickTwo(o, c, h)): Backtest {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const days = toDayDigits(sorted);
  const perDay: Backtest["perDay"] = [];
  let pairBoth = 0, pairAny = 0, tiedBoth = 0, tiedAny = 0, fair = 0, tieDays = 0, drillSet = 0, drillDay = 0;
  for (let i = minHistory; i < sorted.length; i++) {
    const hist = sorted.slice(0, i);
    const two = pick(sorted[i].openValue, sorted[i].openChange, hist, sorted[i].date);
    const closeNums = [days[i].closeTop2, days[i].closeBottom2];
    const drillNums = two.drill.sets.flatMap((s) => s.numbers.map((n) => n.number));
    const drillHits = drillNums.filter((m) => closeNums.includes(m) || closeNums.includes(m[1] + m[0]));
    for (const s of two.drill.sets) if (s.numbers.some((n) => drillHits.includes(n.number))) drillSet++;
    if (drillHits.length) drillDay++;
    fair += two.tiedWithMain.filter((d) => days[i].closeDigits.includes(d)).length / two.tiedWithMain.length;
    if (two.tiedWithMain.length > 1) tieDays++;
    const third = two.third.digit;
    const predicted = [two.digits[0].digit, two.digits[1].digit, third];
    const hits = predicted.filter((d) => days[i].closeDigits.includes(d));
    perDay.push({ date: days[i].date, predicted, actual: days[i].closeDigits, hits, drill: { numbers: drillNums, hits: drillHits } });
    const two2 = hits.filter((d) => d !== third).length;
    if (two2 === 2) pairBoth++; if (two2 >= 1) pairAny++;
    const { pair } = pickPair(sorted[i].openValue, sorted[i].openChange, hist);
    const hit = pair.filter((d) => days[i].closeDigits.includes(d)).length;
    if (hit === 2) tiedBoth++; if (hit >= 1) tiedAny++;
  }
  const n = perDay.length;
  const avgCloseSize = days.length ? days.reduce((s, d) => s + d.closeDigits.length, 0) / days.length : 0;
  const topK = [1, 2, 3].map((k) => {
    const atLeastOne = n ? perDay.filter((d) => d.predicted.slice(0, k).some((x) => d.actual.includes(x))).length / n : 0;
    const all = n ? perDay.filter((d) => d.predicted.slice(0, k).every((x) => d.actual.includes(x))).length / n : 0;
    return { k, atLeastOne, all, randomAtLeastOne: randomAtLeastOne(perDay.map((d) => d.actual.length), k) };
  });
  return {
    days: n, topK, avgCloseSize, perDay,
    pair: n ? { both: pairBoth / n, any: pairAny / n } : undefined,
    tied: n ? { both: tiedBoth / n, any: tiedAny / n } : undefined,
    fairTop1: n ? fair / n : undefined,
    tieDays,
    drill: n ? { set: drillSet / (2 * n), any: drillDay / n } : undefined,
  };
}
