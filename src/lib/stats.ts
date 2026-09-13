/**
 * สถิติและการคาดการณ์ราคาปิด จากข้อมูล "เปิด/ปิด" ที่มีเครื่องหมาย +/-
 *
 * แนวคิดหลัก: แยกวิเคราะห์ตามเครื่องหมายตอนเปิด
 *   เปิด + → ปิด + / ปิด −
 *   เปิด − → ปิด + / ปิด −
 * เมื่อรู้ว่าวันนี้เปิด +/- เท่าไร จะดูจากประวัติที่ "เปิดแบบเดียวกัน" ว่ามักจะปิดอย่างไร
 */

export type RecordLike = {
  date: Date;
  openValue: number;
  openChange: number;
  closeValue: number;
  closeChange: number;
};

export type Sign = "up" | "down" | "flat";

export const sign = (x: number): Sign => (x > 0 ? "up" : x < 0 ? "down" : "flat");
export const signLabel: Record<Sign, string> = { up: "+", down: "−", flat: "0" };

/** ปิดวันก่อน = ค่าเปิด − เปลี่ยนแปลงตอนเปิด */
export const prevClose = (r: Pick<RecordLike, "openValue" | "openChange">) =>
  r.openValue - r.openChange;

export const openPct = (r: RecordLike) => (prevClose(r) ? r.openChange / prevClose(r) : 0);
export const closePct = (r: RecordLike) => (prevClose(r) ? r.closeChange / prevClose(r) : 0);

/** รูปแบบ 4 แบบ: "up-up" | "up-down" | "down-up" | "down-down" (flat ไม่นับในตาราง) */
export type Pattern = `${Sign}-${Sign}`;
export const pattern = (r: RecordLike): Pattern => `${sign(r.openChange)}-${sign(r.closeChange)}`;

export type PatternCounts = {
  upUp: number;
  upDown: number;
  downUp: number;
  downDown: number;
  flat: number; // เปิดหรือปิดเป็น 0
};

/** สถิติกลุ่มย่อย (เช่น เฉพาะวันที่เปิด −) */
export type Group = {
  count: number;
  closeUp: number;
  closeDown: number;
  closeFlat: number;
  closeUpRate: number; // โอกาสปิดบวก
  avgCloseChange: number;
  medianCloseChange: number;
  stdCloseChange: number;
  avgClosePct: number;
  /** ค่าเฉลี่ยของ (ปิด − เปิด) = ระหว่างวันวิ่งไปทางไหน */
  avgIntraday: number;
};

export type Summary = {
  count: number;
  patterns: PatternCounts;
  all: Group;
  whenOpenUp: Group;
  whenOpenDown: Group;
  /** อัตราที่ปิดกลับทิศจากเปิด (เปิด+ปิด− หรือ เปิด−ปิด+) */
  reversalRate: number;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function std(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function group(records: RecordLike[]): Group {
  const closes = records.map((r) => r.closeChange);
  const closeUp = records.filter((r) => r.closeChange > 0).length;
  const closeDown = records.filter((r) => r.closeChange < 0).length;
  return {
    count: records.length,
    closeUp,
    closeDown,
    closeFlat: records.length - closeUp - closeDown,
    closeUpRate: records.length ? closeUp / records.length : 0,
    avgCloseChange: mean(closes),
    medianCloseChange: median(closes),
    stdCloseChange: std(closes),
    avgClosePct: mean(records.map(closePct)),
    avgIntraday: mean(records.map((r) => r.closeValue - r.openValue)),
  };
}

export function summarize(records: RecordLike[]): Summary {
  const patterns: PatternCounts = { upUp: 0, upDown: 0, downUp: 0, downDown: 0, flat: 0 };
  for (const r of records) {
    switch (pattern(r)) {
      case "up-up": patterns.upUp++; break;
      case "up-down": patterns.upDown++; break;
      case "down-up": patterns.downUp++; break;
      case "down-down": patterns.downDown++; break;
      default: patterns.flat++;
    }
  }
  const nonFlat = records.length - patterns.flat;
  return {
    count: records.length,
    patterns,
    all: group(records),
    whenOpenUp: group(records.filter((r) => r.openChange > 0)),
    whenOpenDown: group(records.filter((r) => r.openChange < 0)),
    reversalRate: nonFlat ? (patterns.upDown + patterns.downUp) / nonFlat : 0,
  };
}

export type Prediction = {
  openChange: number;
  openValue: number | null;
  prevClose: number | null;
  openSign: Sign;
  /** ประวัติทั้งหมดที่เปิดเครื่องหมายเดียวกัน */
  sameSign: Group;
  /** เฉพาะที่เปิดเครื่องหมายเดียวกัน และขนาดใกล้เคียง */
  similar: Group;
  similarTolerance: number;
  /** N ครั้งล่าสุดที่เปิดเครื่องหมายเดียวกัน */
  recent: Group;
  recentN: number;
  /** ค่าปิดคาดการณ์ (ต้องมี openValue) */
  predictedClose: { byAvg: number; byMedian: number; bySimilar: number | null; byRecent: number; low: number; high: number } | null;
  summary: Summary;
};

/**
 * คาดการณ์จากค่าเปิดวันนี้
 * @param openChange  เปลี่ยนแปลงตอนเปิด (มีเครื่องหมาย)
 * @param openValue   ค่าดัชนีตอนเปิด (ถ้ามี จะคำนวณค่าปิดคาดการณ์ให้)
 * @param similarTolerance ขนาดของ openChange ที่ถือว่าใกล้เคียง (สัดส่วน, ค่าเริ่มต้น ±50%)
 */
export function predictClose(
  records: RecordLike[],
  openChange: number,
  openValue: number | null = null,
  { similarTolerance = 0.5, recentN = 10 } = {},
): Prediction {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const s = sign(openChange);
  const same = sorted.filter((r) => sign(r.openChange) === s);
  const mag = Math.abs(openChange);
  const similarRecs = same.filter((r) => Math.abs(Math.abs(r.openChange) - mag) <= mag * similarTolerance);
  const sameSign = group(same);
  const similar = group(similarRecs);
  const recent = group(same.slice(-recentN));

  const pc = openValue === null ? null : openValue - openChange;
  const predictedClose =
    pc === null
      ? null
      : {
          byAvg: pc + sameSign.avgCloseChange,
          byMedian: pc + sameSign.medianCloseChange,
          bySimilar: similar.count ? pc + similar.avgCloseChange : null,
          byRecent: pc + recent.avgCloseChange,
          low: pc + sameSign.avgCloseChange - sameSign.stdCloseChange,
          high: pc + sameSign.avgCloseChange + sameSign.stdCloseChange,
        };

  return {
    openChange,
    openValue,
    prevClose: pc,
    openSign: s,
    sameSign,
    similar,
    similarTolerance,
    recent,
    recentN: recent.count,
    predictedClose,
    summary: summarize(sorted),
  };
}

export const fmtPct = (x: number, digits = 2) =>
  `${x > 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;

export const fmtNum = (x: number, digits = 2) =>
  x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** แสดงค่าเปลี่ยนแปลงพร้อมเครื่องหมาย เช่น +120.83 / −120.83 */
export const fmtChange = (x: number, digits = 2) =>
  x > 0 ? `+${fmtNum(x, digits)}` : x < 0 ? `−${fmtNum(-x, digits)}` : fmtNum(0, digits);

/** รายการที่มีค่าปิดครบแล้ว (ใช้กรองก่อนส่งเข้า summarize / predictClose / digits) */
export type MaybeClosed = { closeValue: number | null; closeChange: number | null };
export function hasClose<T extends MaybeClosed>(r: T): r is T & { closeValue: number; closeChange: number } {
  return r.closeValue !== null && r.closeChange !== null;
}

/* ---------- ทิศทางปิด (เทียบปิดวันก่อน) ตามขนาดที่เปิดห่างจากปิดวันก่อน ---------- */

/**
 * อัตราที่ "ปิดไปทางเดียวกับที่เปิด" แยกตามขนาดช่องว่างตอนเปิด (|เปิด − ปิดวันก่อน| เป็น %)
 * ค่าฐานจาก BSE SENSEX รายวัน 10 ปี (2016-09 → 2026-09, 2,463 วัน)
 */
export const DIRECTION_TIERS = [
  { minPct: 2.0,  sameRate: 0.935, label: "สูงมาก", n: 46 },
  { minPct: 1.0,  sameRate: 0.841, label: "สูง",     n: 107 },
  { minPct: 0.5,  sameRate: 0.798, label: "สูง",     n: 420 },
  { minPct: 0.25, sameRate: 0.673, label: "ปานกลาง", n: 681 },
  { minPct: 0.1,  sameRate: 0.592, label: "ต่ำ",     n: 693 },
  { minPct: 0,    sameRate: 0.537, label: "เท่าโยนเหรียญ", n: 516 },
] as const;

export type DirectionForecast = {
  openPct: number;            // % ที่เปิดห่างจากปิดวันก่อน (มีเครื่องหมาย)
  direction: "up" | "down" | "flat";
  pSame: number;              // โอกาสปิดทางเดียวกับเปิด
  pUp: number;                // โอกาสปิดสูงกว่าปิดวันก่อน
  tier: (typeof DIRECTION_TIERS)[number];
  /** สถิติของผู้ใช้เองในช่วงเดียวกัน (ถ้ามี) */
  own: { same: number; n: number } | null;
};

export function forecastDirection(openValue: number, openChange: number, history: RecordLike[] = []): DirectionForecast {
  const prev = openValue - openChange;
  const openPct = prev ? (openChange / prev) * 100 : 0;
  const abs = Math.abs(openPct);
  const tier = DIRECTION_TIERS.find((t) => abs >= t.minPct) ?? DIRECTION_TIERS[DIRECTION_TIERS.length - 1];
  const direction = openChange > 0 ? "up" : openChange < 0 ? "down" : "flat";

  const upper = DIRECTION_TIERS[DIRECTION_TIERS.indexOf(tier) - 1]?.minPct ?? Infinity;
  const inTier = history.filter((r) => {
    const p = prevClose(r);
    const a = p ? Math.abs((r.openChange / p) * 100) : 0;
    return a >= tier.minPct && a < upper && r.openChange !== 0;
  });
  const own = inTier.length
    ? { same: inTier.filter((r) => Math.sign(r.openChange) === Math.sign(r.closeChange)).length, n: inTier.length }
    : null;

  // ผสมค่าฐาน 10 ปี กับข้อมูลผู้ใช้ (ถ่วงตามจำนวน; ฐานนับเป็น 30 วัน)
  const pSame = own ? (tier.sameRate * 30 + own.same) / (30 + own.n) : tier.sameRate;
  const pUp = direction === "up" ? pSame : direction === "down" ? 1 - pSame : 0.5;
  return { openPct, direction, pSame, pUp, tier, own };
}

/* ---------- จุดปิดเทียบกับเปิด (ระหว่างวัน) ตามขนาด/ทิศที่เปิด — ฐาน 10 ปี ---------- */

/** เปอร์เซ็นต์ (ปิด − เปิด)/เปิด: มัธยฐาน, ช่วง 50% (q25–q75), ช่วง 80% (q10–q90), โอกาสปิด>เปิด */
export const INTRADAY_TIERS = [
  { label: "ลง >1%",        min: -Infinity, max: -1,    med: 0.02,  q25: -0.69, q75: 0.86, q10: -2.30, q90: 1.64, pUp: 0.51, n: 68 },
  { label: "ลง 0.5–1%",     min: -1,        max: -0.5,  med: 0.09,  q25: -0.39, q75: 0.60, q10: -1.07, q90: 1.17, pUp: 0.54, n: 126 },
  { label: "ลง 0.25–0.5%",  min: -0.5,      max: -0.25, med: 0.08,  q25: -0.42, q75: 0.47, q10: -0.89, q90: 0.89, pUp: 0.53, n: 150 },
  { label: "ลง 0–0.25%",    min: -0.25,     max: 0,     med: -0.11, q25: -0.53, q75: 0.32, q10: -1.02, q90: 0.62, pUp: 0.44, n: 400 },
  { label: "ขึ้น 0–0.25%",  min: 0,         max: 0.25,  med: -0.09, q25: -0.45, q75: 0.33, q10: -0.90, q90: 0.70, pUp: 0.43, n: 809 },
  { label: "ขึ้น 0.25–0.5%",min: 0.25,      max: 0.5,   med: -0.08, q25: -0.50, q75: 0.32, q10: -0.88, q90: 0.60, pUp: 0.46, n: 531 },
  { label: "ขึ้น 0.5–1%",   min: 0.5,       max: 1,     med: 0.05,  q25: -0.53, q75: 0.49, q10: -1.02, q90: 0.89, pUp: 0.53, n: 294 },
  { label: "ขึ้น >1%",      min: 1,         max: Infinity, med: -0.16, q25: -1.27, q75: 0.43, q10: -2.15, q90: 1.21, pUp: 0.45, n: 85 },
] as const;

export type CloseForecast = {
  openPct: number;
  tier: (typeof INTRADAY_TIERS)[number];
  median: number;            // จุดปิดคาดการณ์
  p50: [number, number];     // ช่วง 50%
  p80: [number, number];     // ช่วง 80%
  pAboveOpen: number;
  own: { n: number; med: number; pAboveOpen: number } | null; // จากข้อมูลผู้ใช้ในช่วงเดียวกัน
};

/** คาดการณ์จุดปิดจากค่าเปิด: เปิด × (1 + มัธยฐาน%) พร้อมช่วง — ผสมข้อมูลผู้ใช้เมื่อมีมากพอ */
export function forecastClose(openValue: number, openChange: number, history: RecordLike[] = []): CloseForecast {
  const prev = openValue - openChange;
  const openPct = prev ? (openChange / prev) * 100 : 0;
  const tier = INTRADAY_TIERS.find((t) => openPct >= t.min && openPct < t.max) ?? INTRADAY_TIERS[4];

  const same = history.filter((r) => {
    const p = prevClose(r), g = p ? (r.openChange / p) * 100 : 0;
    return g >= tier.min && g < tier.max;
  });
  const ownIntra = same.map((r) => ((r.closeValue - r.openValue) / r.openValue) * 100);
  const own = same.length ? { n: same.length, med: median(ownIntra), pAboveOpen: ownIntra.filter((x) => x > 0).length / same.length } : null;

  // ถ่วงน้ำหนัก: ฐาน 10 ปี นับเป็น 30 วัน
  const w = own ? own.n / (own.n + 30) : 0;
  const med = tier.med * (1 - w) + (own?.med ?? 0) * w;
  const pAboveOpen = tier.pUp * (1 - w) + (own?.pAboveOpen ?? 0) * w;
  const at = (pct: number) => openValue * (1 + pct / 100);
  return {
    openPct, tier, median: at(med),
    p50: [at(tier.q25 + (med - tier.med)), at(tier.q75 + (med - tier.med))],
    p80: [at(tier.q10 + (med - tier.med)), at(tier.q90 + (med - tier.med))],
    pAboveOpen, own,
  };
}
