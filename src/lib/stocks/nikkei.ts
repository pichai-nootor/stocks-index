/**
 * หุ้นนิเคอิ (ปกติ) — แหล่งข้อมูล: ราคาจริง Nikkei 225 จาก Yahoo Finance (^N225) ตามที่ผู้ใช้เลือก
 *   รอบเช้า  "NIKKEI เช้า" = ปิดภาคเช้า 11:30 JST (09:30 ไทย) — แท่ง 5 นาทีเวลา 11:30 ของ Yahoo (ตรวจ 21 ส.ค. 69: 66,008.45 → 845/34 ตรงกับผลหวย)
 *   รอบบ่าย  "NIKKEI บ่าย" = ปิดวัน 15:30 JST (13:30 ไทย) — ราคาปิดรายวันของ Yahoo (ตรวจ 19–21 ส.ค. 69 ตรงกับผลหวยทั้ง 3 วัน)
 *   ทั้งสองรอบ "เปลี่ยนแปลง" เทียบกับปิดวันก่อน (ปิดบ่ายของวันก่อน) เหมือน SENSEX → ใช้โมเดลไล่กรณีจาก D ได้ตรง ๆ
 * หมายเหตุ: เว็บหวยบางเว็บ (raakaadee) ใช้ค่าดัชนีที่ต่างจาก Yahoo ในบางวัน (ก.ย. 69) — ระบบนี้ยึด Yahoo ตามที่ผู้ใช้กำหนด
 * ไฟล์นี้เป็นของนิเคอิเท่านั้น: ไม่แตะ SENSEX (digits.ts / stats.ts / yahoo.ts นอกจากบรรทัดส่งต่อสัญลักษณ์)
 */
import type { Quote } from "@/lib/yahoo";

export type NikkeiSession = "am" | "pm";
export const NIKKEI_SYMBOLS: Record<string, NikkeiSession> = { "NIKKEI เช้า": "am", "NIKKEI-AM": "am", "NIKKEI บ่าย": "pm", "NIKKEI-PM": "pm", NIKKEI: "pm", N225: "pm" };
export const nikkeiSession = (symbol: string): NikkeiSession | null => NIKKEI_SYMBOLS[symbol.trim()] ?? NIKKEI_SYMBOLS[symbol.trim().toUpperCase()] ?? null;
export const NIKKEI_STOCKS = [
  { symbol: "NIKKEI เช้า", name: "Nikkei 225 ปิดภาคเช้า 11:30 JST (09:30 ไทย) — Yahoo" },
  { symbol: "NIKKEI บ่าย", name: "Nikkei 225 ปิดวัน 15:30 JST (13:30 ไทย) — Yahoo" },
] as const;

const r2 = (x: number) => Math.round(x * 100) / 100;
const JST = 9 * 3600 * 1000;
const jstDate = (t: number) => new Date(t * 1000 + JST).toISOString().slice(0, 10);
const jstHHMM = (t: number) => new Date(t * 1000 + JST).toISOString().slice(11, 16);
const AM_CLOSE = "11:30";

type Bar = { t: number; open: number; close: number };
/** openOnly = เก็บแท่งที่ยังไม่มีราคาปิดด้วย (close = NaN) — แท่งวันนี้ระหว่างตลาดเปิด Yahoo ส่ง close เป็น null */
async function chart(params: string, openOnly = false): Promise<{ bars: Bar[]; meta: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
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

/** แท่งรายวัน (ปิดบ่าย) ย้อนหลัง */
export async function nikkeiDaily(range = "10y"): Promise<{ date: string; open: number; close: number }[]> {
  const c = await chart(`range=${range}&interval=1d`);
  return c ? c.bars.map((b) => ({ date: jstDate(b.t), open: r2(b.open), close: r2(b.close) })) : [];
}

/**
 * ปิดภาคเช้าย้อนหลัง (คีย์ = วันที่ JST)
 *   แท่ง 5 นาที 11:30 JST — แม่นที่สุด แต่ Yahoo ให้ย้อนหลังแค่ ~60 วัน
 *   แท่ง 1 ชั่วโมงเวลา 11:00 — ปิดที่ 11:30 พอดี (ตลาดพักเที่ยง) ย้อนหลังได้ ~730 วัน
 *   ตรวจ 23 ก.ย. 69: แท่ง 11:00 ตรงกับแท่ง 11:30 ทั้ง 60/60 วันที่ทับกัน → ใช้เติมวันเก่าได้
 */
export async function nikkeiMorningCloses(range = "60d"): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const hourly = await chart("range=730d&interval=1h");
  if (hourly) for (const b of hourly.bars) if (jstHHMM(b.t) === "11:00") out[jstDate(b.t)] = r2(b.close);
  const c = await chart(`range=${range}&interval=5m`);
  if (c) for (const b of c.bars) if (jstHHMM(b.t) === AM_CLOSE) out[jstDate(b.t)] = r2(b.close); // วันใหม่ทับด้วยค่าที่แม่นกว่า
  return out;
}

/**
 * ราคาเปิดภาคบ่ายของนิเคอิ (แท่ง 12:30 JST = 10:30 ไทย) — Yahoo ให้แท่ง 5 นาทีย้อนหลัง ~60 วัน
 * เว็บเก็บแต่ "ราคาเปิดของวัน" (9:00) ซึ่งเป็นของรอบเช้า รอบบ่ายจึงต้องดึงแท่งนี้เอง
 */
export async function nikkeiAfternoonOpen(date: string): Promise<number | null> {
  const c = await chart("range=5d&interval=5m");
  const bar = c?.bars.find((b) => jstDate(b.t) === date && jstHHMM(b.t) === "12:30");
  return bar ? r2(bar.open) : null;
}

/** ราคาสำหรับหน้าแรก/ปุ่ม Yahoo — รอบเช้า: ปิดแล้วเมื่อถึง 11:30 JST และ last = แท่ง 11:30; รอบบ่าย: ตามปิดวัน */
export async function fetchNikkeiQuote(session: NikkeiSession): Promise<Quote | null> {
  // แท่งวันนี้ระหว่างตลาดเปิดไม่มีราคาปิด — เดิมถูกตัดทิ้ง ทำให้ได้ปิดของสองวันก่อน (14 ต.ค. 69 รอบเช้า: 69,030.92 แทน 67,777.52)
  const daily = await chart("range=10d&interval=1d", true);
  if (!daily || daily.bars.length < 2) return null;
  const today = daily.bars[daily.bars.length - 1], prev = daily.bars.slice(0, -1).findLast((b) => Number.isFinite(b.close));
  if (!prev) return null;
  const tradingDate = jstDate(today.t);
  const meta = daily.meta as { regularMarketPrice?: number; regularMarketTime?: number; currentTradingPeriod?: { regular?: { end?: number } } };
  const lastAt = new Date((meta.regularMarketTime ?? today.t) * 1000);
  const base = { symbol: "^N225", source: "yahoo" as const, tradingDate, prevClose: r2(prev.close), open: r2(today.open), lastAt };
  if (session === "pm") {
    const end = meta.currentTradingPeriod?.regular?.end;
    // Yahoo หยุดที่แท่ง 15:25 และไม่รวมราคาประมูลปิด 15:30 (ราคาทางการ) — ถ้าเวลาล่าสุดยังไม่ถึง 15:30 ถือว่ายังไม่ปิด
    //   ตรวจ 24 ก.ย. 69: Yahoo ให้ 65,647.27 (แท่ง 15:25) แต่ราคาปิดทางการคือ 65,513.99 → ต้องรอ/กรอกเอง
    const lastJst = jstHHMM(Math.floor(base.lastAt.getTime() / 1000));
    const settled = lastJst >= "15:30";
    const closed = settled && (end ? Date.now() / 1000 > end + 60 || jstDate(end) !== tradingDate : true);
    return { ...base, last: r2(meta.regularMarketPrice ?? (Number.isFinite(today.close) ? today.close : today.open)), closed };
  }
  // รอบเช้า
  const intra = await chart("range=5d&interval=5m");
  const todays = intra ? intra.bars.filter((b) => jstDate(b.t) === tradingDate) : [];
  const amBar = todays.find((b) => jstHHMM(b.t) === AM_CLOSE) ?? null;
  const nowJst = new Date(Date.now() + JST).toISOString();
  const pastAm = nowJst.slice(0, 10) > tradingDate || (nowJst.slice(0, 10) === tradingDate && nowJst.slice(11, 16) >= AM_CLOSE);
  if (amBar) return { ...base, last: r2(amBar.close), lastAt: new Date(amBar.t * 1000), closed: true };
  const latest = todays[todays.length - 1];
  return { ...base, last: r2(latest ? latest.close : today.open), lastAt: latest ? new Date(latest.t * 1000) : lastAt, closed: pastAm && !!latest && jstHHMM(latest.t) >= AM_CLOSE };
}
