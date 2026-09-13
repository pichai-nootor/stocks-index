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
