/**
 * หุ้นจีน (ปกติ) — ดัชนี SZSE Component (เซินเจิ้น, Yahoo: 399001.SZ) · ไฟล์ของจีนเท่านั้น ไม่แตะหุ้นตัวอื่น
 *   รอบเช้า "CHINA เช้า" = ปิดภาคเช้า 11:30 จีน (10:30 ไทย) ประกาศผล ~10:35 ไทย
 *   รอบบ่าย "CHINA บ่าย" = ปิดวัน 15:00 จีน (14:00 ไทย) ประกาศผล ~14:05 ไทย
 *   ทั้งสองรอบ "ล่าง" เทียบกับปิดวันก่อน (ปิดบ่ายของวันก่อน) เหมือนนิเคอิ → ใช้เครื่องไล่กรณีจาก D ได้ตรง ๆ
 *
 * ตรวจกับผลหวยจริง (raakaadee) 18–21 ส.ค. 69:
 *   บ่าย: ปิดวัน 14,622.50 −81.77 → 250/77 ✓ · 13,890.15 −732.35 → 015/35 ✓ · 13,972.78 → 278/63 ✓ · 14,094.17 → 417/39 ✓
 *   เช้า: แท่ง 1 ชั่วโมงเวลา 11:30 ของ Yahoo (ปิดภาคเช้า) → 345/82 ✓ · 176/74 ✓ · 441/26 ✓ · 145/67 ✓ (แท่ง 10:30 ไม่ตรง)
 *   ราคาปิดรายวันของ Yahoo ตรงกับไฟล์ investing.com ของผู้ใช้ 175/175 วัน
 */
import type { Quote } from "@/lib/yahoo";

const SYMBOL = "399001.SZ";
const CN = 8 * 3600 * 1000; // เวลาจีน = UTC+8 (ไทย +1)
const cnDate = (t: number) => new Date(t * 1000 + CN).toISOString().slice(0, 10);
const cnHHMM = (t: number) => new Date(t * 1000 + CN).toISOString().slice(11, 16);
const AM_BAR = "11:30"; // แท่ง 1 ชม. ที่ปิดตรงกับปิดภาคเช้า
const r2 = (x: number) => Math.round(x * 100) / 100;

export type ChinaSession = "am" | "pm";
export const CHINA_SYMBOLS: Record<string, ChinaSession> = { "CHINA เช้า": "am", "CHINA-AM": "am", "CHINA บ่าย": "pm", "CHINA-PM": "pm", SZSE: "pm" };
export const chinaSession = (symbol: string): ChinaSession | null => CHINA_SYMBOLS[symbol.trim()] ?? CHINA_SYMBOLS[symbol.trim().toUpperCase()] ?? null;
export const CHINA_STOCKS = [
  { symbol: "CHINA เช้า", name: "SZSE Component จีน ปิดภาคเช้า 11:30 จีน (10:30 ไทย) — Yahoo" },
  { symbol: "CHINA บ่าย", name: "SZSE Component จีน ปิดวัน 15:00 จีน (14:00 ไทย) — Yahoo" },
] as const;
export const CHINA_CLOSE_THAI = { am: "10:30", pm: "14:00" } as const;

type Bar = { t: number; open: number; close: number };
/** openOnly = เก็บแท่งที่ยังไม่มีราคาปิดด้วย (close = NaN) — แท่งวันนี้ระหว่างตลาดเปิด Yahoo ส่ง close เป็น null */
async function chart(params: string, openOnly = false): Promise<{ bars: Bar[]; meta: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const r = (await res.json())?.chart?.result?.[0];
    if (!r?.timestamp) return null;
    const q = r.indicators.quote[0];
    const bars: Bar[] = [];
    for (let i = 0; i < r.timestamp.length; i++) if (q.open?.[i] != null && (q.close?.[i] != null || openOnly)) bars.push({ t: r.timestamp[i], open: q.open[i], close: q.close?.[i] ?? NaN });
    return { bars, meta: r.meta ?? {} };
  } catch {
    return null;
  }
}

/**
 * ปิดรายวัน (รอบบ่าย) ย้อนหลัง
 * Yahoo ออกแท่งรายวันช้ากว่าแท่งรายชั่วโมง (วันล่าสุดมักยังไม่มี) → เติมวันที่ขาดจากแท่ง 1 ชม. ของวันนั้น
 * (เปิด = แท่งแรกของวัน, ปิด = แท่งสุดท้าย 15:00 จีน) ตรวจ 22 ก.ย. 69: ได้ 13,723.74 ตรงกับไฟล์ investing
 */
export async function chinaDaily(range = "2y"): Promise<{ date: string; open: number; close: number }[]> {
  const c = await chart(`range=${range}&interval=1d`);
  const out = c ? c.bars.map((b) => ({ date: cnDate(b.t), open: r2(b.open), close: r2(b.close) })) : [];
  const have = new Set(out.map((d) => d.date));
  const hourly = await chart("range=5d&interval=1h");
  if (hourly) {
    const byDay = new Map<string, Bar[]>();
    for (const b of hourly.bars) { const d = cnDate(b.t); if (!have.has(d)) byDay.set(d, [...(byDay.get(d) ?? []), b]); }
    const latestDay = hourly.bars.length ? cnDate(hourly.bars[hourly.bars.length - 1].t) : "";
    for (const [date, bars] of byDay) {
      const last = bars[bars.length - 1];
      // ต้องเป็นวันที่จบแล้วจริง ๆ: มีแท่ง 15:00 หรือมีวันซื้อขายใหม่เกิดขึ้นแล้ว (Yahoo ตัดแท่ง 15:00 ทิ้งหลังผ่านไปวันหนึ่ง)
      if (cnHHMM(last.t) < "15:00" && date >= latestDay) continue;
      out.push({ date, open: r2(bars[0].open), close: r2(last.close) });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

/**
 * ปิดภาคเช้าย้อนหลัง (แท่ง 1 ชม. เวลา 11:30 จีน = ปิดภาคเช้าพอดี)
 * Yahoo ให้แท่ง 1 ชม. ย้อนหลังถึง ~730 วัน (ตรวจ 23 ก.ย. 69: ได้ตั้งแต่ 19 ก.ย. 2023)
 * เว็บตลาดหุ้นไม่มีใครเก็บ "ปิดเช้า/เปิดบ่าย" เป็นช่องแยก — ต้องสร้างจากแท่งระหว่างวันแบบนี้เท่านั้น
 */
export async function chinaMorningCloses(range = "730d"): Promise<Record<string, number>> {
  const c = await chart(`range=${range}&interval=1h`);
  const out: Record<string, number> = {};
  if (c) for (const b of c.bars) if (cnHHMM(b.t) === AM_BAR) out[cnDate(b.t)] = r2(b.close);
  return out;
}

/** ราคาสำหรับปุ่มบันทึกเปิด/เติมปิดของแต่ละรอบ */
export async function fetchChinaQuote(session: ChinaSession): Promise<Quote | null> {
  // แท่งวันนี้ระหว่างตลาดเปิดไม่มีราคาปิด — เดิมถูกตัดทิ้ง ทำให้ได้ปิดของสองวันก่อน (14 ต.ค. 69 รอบเช้า: 12,384.87 แทน 12,353.70)
  const daily = await chart("range=10d&interval=1d", true);
  if (!daily || daily.bars.length < 2) return null;
  const today = daily.bars[daily.bars.length - 1], prev = daily.bars.slice(0, -1).findLast((b) => Number.isFinite(b.close));
  if (!prev) return null;
  const tradingDate = cnDate(today.t);
  const meta = daily.meta as { regularMarketPrice?: number; regularMarketTime?: number; currentTradingPeriod?: { regular?: { end?: number } } };
  const base = { symbol: SYMBOL, source: "yahoo" as const, tradingDate, prevClose: r2(prev.close), open: r2(today.open), lastAt: new Date((meta.regularMarketTime ?? today.t) * 1000) };
  if (session === "pm") {
    // Yahoo ไม่รวมราคาประมูลปิด 15:00 จีน — ตรวจ 24 ก.ย. 69: Yahoo ให้ 13,332.48 แต่ราคาปิดทางการคือ 13,316.97
    //   ถ้าเวลาข้อมูลล่าสุดยังไม่ถึง 15:00 ถือว่ายังไม่ปิด (กันไม่ให้บันทึกราคาที่ยังไม่ใช่ราคาทางการ)
    const lastCn = cnHHMM(Math.floor(base.lastAt.getTime() / 1000));
    const end = meta.currentTradingPeriod?.regular?.end;
    const closed = lastCn >= "15:00" && (end ? Date.now() / 1000 > end + 60 || cnDate(end) !== tradingDate : true);
    return { ...base, last: r2(meta.regularMarketPrice ?? (Number.isFinite(today.close) ? today.close : today.open)), closed };
  }
  const intra = await chart("range=5d&interval=1h");
  const amBar = intra?.bars.filter((b) => cnDate(b.t) === tradingDate).find((b) => cnHHMM(b.t) === AM_BAR) ?? null;
  if (amBar) return { ...base, last: r2(amBar.close), lastAt: new Date(amBar.t * 1000), closed: true };
  const todays = intra?.bars.filter((b) => cnDate(b.t) === tradingDate) ?? [];
  const latest = todays[todays.length - 1];
  return { ...base, last: r2(latest ? latest.close : today.open), lastAt: latest ? new Date(latest.t * 1000) : base.lastAt, closed: false };
}
