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
