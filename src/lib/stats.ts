/**
 * สถิติและการคาดการณ์ราคาปิด จากข้อมูลเปิด/ปิดที่บันทึกไว้
 * แนวคิด: ดูว่าปกติ "ปิด" ต่างจาก "เปิด" กี่ % แล้วนำมาคูณกับค่าเปิดที่ต้องการทำนาย
 */

export type RecordLike = { date: Date; open: number; close: number };

export type Summary = {
  count: number;
  up: number;
  down: number;
  flat: number;
  upRate: number; // สัดส่วนครั้งที่ปิดสูงกว่าเปิด
  avgPct: number; // ค่าเฉลี่ย (close-open)/open
  medianPct: number;
  stdPct: number;
  avgDiff: number; // ค่าเฉลี่ย close-open
  maxPct: number;
  minPct: number;
  recentAvgPct: number; // เฉลี่ย N ครั้งล่าสุด
  recentN: number;
};

export type Prediction = {
  open: number;
  count: number;
  byAvg: number;
  byMedian: number;
  byRecent: number;
  bySimilar: number | null; // อิงเฉพาะครั้งที่ราคาเปิดใกล้เคียง
  similarCount: number;
  low: number; // byAvg - 1 std
  high: number; // byAvg + 1 std
  upRate: number;
  summary: Summary;
};

const pct = (r: RecordLike) => (r.open === 0 ? 0 : (r.close - r.open) / r.open);

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

export function summarize(records: RecordLike[], recentN = 10): Summary {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const pcts = sorted.map(pct);
  const diffs = sorted.map((r) => r.close - r.open);
  const up = sorted.filter((r) => r.close > r.open).length;
  const down = sorted.filter((r) => r.close < r.open).length;
  const flat = sorted.length - up - down;
  const recent = pcts.slice(-recentN);

  return {
    count: sorted.length,
    up,
    down,
    flat,
    upRate: sorted.length ? up / sorted.length : 0,
    avgPct: mean(pcts),
    medianPct: median(pcts),
    stdPct: std(pcts),
    avgDiff: mean(diffs),
    maxPct: pcts.length ? Math.max(...pcts) : 0,
    minPct: pcts.length ? Math.min(...pcts) : 0,
    recentAvgPct: mean(recent),
    recentN: recent.length,
  };
}

/**
 * คาดการณ์ราคาปิดจากค่าเปิดที่ระบุ
 * @param similarTolerance ช่วง % ที่ถือว่า "ราคาเปิดใกล้เคียง" (ค่าเริ่มต้น ±3%)
 */
export function predictClose(
  records: RecordLike[],
  open: number,
  similarTolerance = 0.03,
): Prediction {
  const summary = summarize(records);
  const similar = records.filter(
    (r) => Math.abs(r.open - open) / (open || 1) <= similarTolerance,
  );
  const similarPct = similar.length ? mean(similar.map(pct)) : null;

  return {
    open,
    count: summary.count,
    byAvg: open * (1 + summary.avgPct),
    byMedian: open * (1 + summary.medianPct),
    byRecent: open * (1 + summary.recentAvgPct),
    bySimilar: similarPct === null ? null : open * (1 + similarPct),
    similarCount: similar.length,
    low: open * (1 + summary.avgPct - summary.stdPct),
    high: open * (1 + summary.avgPct + summary.stdPct),
    upRate: summary.upRate,
    summary,
  };
}

export const fmtPct = (x: number, digits = 2) =>
  `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;

export const fmtNum = (x: number, digits = 2) =>
  x.toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
