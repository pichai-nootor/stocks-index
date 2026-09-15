/**
 * ฟันทิศทางปิด "สด" จากราคาระหว่างวัน: ยิ่งสาย + ยิ่งห่างจากปิดวันก่อน ยิ่งแม่น
 * อัตราจาก BSE SENSEX รายชั่วโมง 2 ปี (2023-10 → 2026-09, 718 วัน)
 * แต่ละจุดเวลา = เวลาที่อ่านราคา (IST; ไทย = +1:30) แยกตามระยะห่าง |ราคา − ปิดวันก่อน| เป็น %
 */
export const LIVE_CHECKPOINTS = [
  { istMin: 615, ist: "10:15", thai: "11:45", tiers: [{ minPct: 1, rate: 0.97, n: 58 }, { minPct: 0.5, rate: 0.93, n: 167 }, { minPct: 0.25, rate: 0.79, n: 203 }, { minPct: 0.1, rate: 0.67, n: 163 }, { minPct: 0, rate: 0.53, n: 126 }] },
  { istMin: 675, ist: "11:15", thai: "12:45", tiers: [{ minPct: 1, rate: 0.97, n: 67 }, { minPct: 0.5, rate: 0.94, n: 208 }, { minPct: 0.25, rate: 0.83, n: 201 }, { minPct: 0.1, rate: 0.68, n: 128 }, { minPct: 0, rate: 0.54, n: 113 }] },
  { istMin: 735, ist: "12:15", thai: "13:45", tiers: [{ minPct: 1, rate: 0.97, n: 79 }, { minPct: 0.5, rate: 0.96, n: 195 }, { minPct: 0.25, rate: 0.89, n: 212 }, { minPct: 0.1, rate: 0.75, n: 120 }, { minPct: 0, rate: 0.60, n: 111 }] },
  { istMin: 795, ist: "13:15", thai: "14:45", tiers: [{ minPct: 1, rate: 0.99, n: 90 }, { minPct: 0.5, rate: 0.98, n: 200 }, { minPct: 0.25, rate: 0.91, n: 201 }, { minPct: 0.1, rate: 0.73, n: 124 }, { minPct: 0, rate: 0.54, n: 102 }] },
  { istMin: 855, ist: "14:15", thai: "15:45", tiers: [{ minPct: 1, rate: 1.00, n: 108 }, { minPct: 0.5, rate: 0.98, n: 205 }, { minPct: 0.25, rate: 0.97, n: 179 }, { minPct: 0.1, rate: 0.79, n: 128 }, { minPct: 0, rate: 0.55, n: 97 }] },
  { istMin: 915, ist: "15:15", thai: "16:45", tiers: [{ minPct: 1, rate: 1.00, n: 124 }, { minPct: 0.5, rate: 1.00, n: 207 }, { minPct: 0.25, rate: 1.00, n: 166 }, { minPct: 0.1, rate: 0.98, n: 124 }, { minPct: 0, rate: 0.84, n: 97 }] },
] as const;

/** ฟันสดเมื่อโอกาสถูก ≥ เกณฑ์นี้ */
export const LIVE_CALL_MIN = 0.85;
export const MARKET_OPEN_IST = 555;  // 09:15
export const MARKET_CLOSE_IST = 930; // 15:30

/** นาทีตั้งแต่เที่ยงคืนตามเวลาอินเดีย (UTC+5:30) */
export const istMinutes = (d: Date) => ((d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440);
/** "HH:MM" เวลาไทย (UTC+7) — คำนวณเองเพื่อให้ server กับ browser ได้ข้อความเดียวกัน (Intl ต่างเครื่องต่างผล → hydration mismatch) */
export const fmtThaiTime = (d: Date) => { const m = (d.getUTCHours() * 60 + d.getUTCMinutes() + 420) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
/** วันที่ตามเวลาไทย YYYY-MM-DD */
export const todayThai = (d = new Date()) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export type LiveForecast = {
  price: number;
  at: Date;
  pct: number;                                   // ห่างจากปิดวันก่อน (%)
  direction: "up" | "down" | "flat";
  pSame: number;                                 // โอกาสปิดทางเดียวกับที่อยู่ตอนนี้
  checkpoint: (typeof LIVE_CHECKPOINTS)[number] | null; // null = ยังไม่ถึงจุดเวลาแรก (ใช้ค่าเปิดแทน)
  tier: (typeof LIVE_CHECKPOINTS)[number]["tiers"][number] | null;
  call: "up" | "down" | null;
  reason: string;
};

/**
 * ประเมินจากราคา ณ เวลาที่อ่าน: ใช้จุดเวลาล่าสุดที่ผ่านมาแล้ว (อนุรักษ์นิยม — ราคาที่อ่านหลังจุดเวลาย่อมแม่นไม่น้อยกว่า)
 */
export function liveDirection(prevClose: number, price: number, at: Date): LiveForecast {
  const pct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const abs = Math.abs(pct);
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const m = istMinutes(at);
  const checkpoint = [...LIVE_CHECKPOINTS].reverse().find((c) => m >= c.istMin) ?? null;
  const tier = checkpoint ? checkpoint.tiers.find((t) => abs >= t.minPct) ?? null : null;
  const pSame = tier ? tier.rate : 0.5;
  if (!checkpoint || !tier) {
    return { price, at, pct, direction, pSame, checkpoint, tier, call: null, reason: `ยังไม่ถึง ${LIVE_CHECKPOINTS[0].thai} น. ไทย — ใช้ค่าเปิดไปก่อน` };
  }
  const base = `${checkpoint.thai} น. ไทย ห่าง ${pct > 0 ? "+" : ""}${pct.toFixed(2)}% → ปิดทางเดียวกัน ${Math.round(pSame * 100)}% (${tier.n} วัน)`;
  if (direction === "flat" || pSame < LIVE_CALL_MIN) {
    const next = LIVE_CHECKPOINTS.find((c) => c.istMin > m);
    return { price, at, pct, direction, pSame, checkpoint, tier, call: null, reason: `${base} — ยังไม่ถึง ${Math.round(LIVE_CALL_MIN * 100)}%${next ? ` ลองเช็กอีกที ${next.thai} น.` : ""}` };
  }
  return { price, at, pct, direction, pSame, checkpoint, tier, call: direction, reason: base };
}

export type LiveCallRecord = { date: Date; call: "up" | "down" | null; pSame: number; at: Date; actual: "up" | "down" | "flat" | null; hit: boolean | null };

/** ประเมินผลฟันสดย้อนหลัง (เฉพาะวันที่บันทึกค่าระหว่างวันไว้) */
export function evaluateLiveCalls(records: { date: Date; openValue: number; openChange: number; closeChange: number | null; liveValue: number | null; liveAt: Date | null }[]) {
  const perDay: LiveCallRecord[] = [];
  for (const r of records) {
    if (r.liveValue == null || r.liveAt == null) continue;
    const f = liveDirection(r.openValue - r.openChange, r.liveValue, r.liveAt);
    const actual = r.closeChange === null ? null : r.closeChange > 0 ? "up" : r.closeChange < 0 ? "down" : "flat";
    perDay.push({ date: r.date, call: f.call, pSame: f.pSame, at: r.liveAt, actual, hit: f.call && actual ? f.call === actual : null });
  }
  return {
    perDay,
    called: perDay.filter((d) => d.call && d.actual).length,
    hits: perDay.filter((d) => d.hit).length,
    skipped: perDay.filter((d) => !d.call).length,
  };
}
