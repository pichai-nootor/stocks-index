/**
 * หุ้นฮั่งเส็ง (ปกติ) — ดัชนี Hang Seng Index (Yahoo: ^HSI · ทางการ hsi.com.hk) · ไฟล์ของฮั่งเส็งเท่านั้น ไม่แตะหุ้นตัวอื่น
 *   รอบเช้า "HSI เช้า" = ปิดภาคเช้า 12:00 ฮ่องกง (11:00 ไทย) ประกาศผล ~11:05 ไทย
 *   รอบบ่าย "HSI บ่าย" = ราคา 16:00 ฮ่องกง (15:00 ไทย) ประกาศผล ~15:15 ไทย
 *   "ล่าง" ทั้งสองรอบ = ทศนิยม(ราคา − ปิดทางการวันก่อน) · ปิดทางการ = ปิดรายวันของ Yahoo (รวมประมูลปิด 16:10)
 *
 * ตรวจกับผลหวยจริง (raakaadee "เลขหลัก") 12 ต.ค. 69:
 *   บ่าย: ราคาแท่ง 16:00 ฮ่องกง (ก่อนประมูลปิด) ตรงกับผลหวย 24/24 วัน (25 ส.ค. – 9 ต.ค. 69) — ไม่ใช่ราคาปิดรายวัน
 *         (ปิดรายวันรวมประมูลปิด ต่างจากผลหวย ±0–50 จุด) · ล่างเทียบปิดทางการวันก่อนตรงทุกวัน
 *   เช้า: ปิดภาคเช้าจริง (แท่ง 12:00) ตรงกับผลหวยแค่ 1/26 วัน — ผลหวยรอบเช้าต่างจากราคาจริง ±0–20 จุด
 *         (ล่างยังเทียบปิดทางการวันก่อนตรงทุกวัน) → ระบบเติมจากราคาจริง ถ้าผลหวยไม่ตรงให้แก้ปิดเองในตาราง
 */
import type { Quote } from "@/lib/yahoo";

const SYMBOL = "^HSI";
const HK = 8 * 3600 * 1000; // เวลาฮ่องกง = UTC+8 (ไทย +1)
const hkDate = (t: number) => new Date(t * 1000 + HK).toISOString().slice(0, 10);
const hkHHMM = (t: number) => new Date(t * 1000 + HK).toISOString().slice(11, 16);
const r2 = (x: number) => Math.round(x * 100) / 100;

export type HangSengSession = "am" | "pm";
/** แท่งที่ใช้เป็นผลของแต่ละรอบ (เวลาฮ่องกง) */
const RESULT_BAR: Record<HangSengSession, string> = { am: "12:00", pm: "16:00" };
const PM_OPEN_BAR = "13:00"; // เปิดภาคบ่าย

export const HANGSENG_SYMBOLS: Record<string, HangSengSession> = { "HSI เช้า": "am", "HSI-AM": "am", "HSI บ่าย": "pm", "HSI-PM": "pm", HSI: "pm", HANGSENG: "pm" };
export const hangSengSession = (symbol: string): HangSengSession | null => HANGSENG_SYMBOLS[symbol.trim()] ?? HANGSENG_SYMBOLS[symbol.trim().toUpperCase()] ?? null;
export const HANGSENG_STOCKS = [
  { symbol: "HSI เช้า", name: "Hang Seng Index ปิดภาคเช้า 12:00 ฮ่องกง (11:00 ไทย) — Yahoo" },
  { symbol: "HSI บ่าย", name: "Hang Seng Index ราคา 16:00 ฮ่องกง (15:00 ไทย) — Yahoo" },
] as const;
export const HANGSENG_CLOSE_THAI = { am: "11:00", pm: "15:00" } as const;

type Bar = { t: number; open: number; close: number };
async function chart(params: string): Promise<{ bars: Bar[]; meta: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const r = (await res.json())?.chart?.result?.[0];
    if (!r?.timestamp) return null;
    const q = r.indicators.quote[0];
    const bars: Bar[] = [];
    for (let i = 0; i < r.timestamp.length; i++) if (q.open?.[i] != null && q.close?.[i] != null) bars.push({ t: r.timestamp[i], open: q.open[i], close: q.close[i] });
    return { bars, meta: r.meta ?? {} };
  } catch {
    return null;
  }
}

/** ปิดทางการรายวัน (ไว้เป็น "ปิดวันก่อน") + เปิดของวัน */
export async function hangSengDaily(range = "3mo"): Promise<{ date: string; open: number; close: number }[]> {
  const c = await chart(`range=${range}&interval=1d`);
  return c ? c.bars.map((b) => ({ date: hkDate(b.t), open: r2(b.open), close: r2(b.close) })) : [];
}

/**
 * ราคาผลของแต่ละรอบย้อนหลัง (คีย์ = วันที่ฮ่องกง)
 *   แท่ง 1 ชม. (Yahoo ให้ ~730 วัน): เช้า = แท่ง 11:30 (ปิด 12:00) ตรงกับแท่ง 5 นาที 55/59 วัน · บ่าย = แท่ง 15:30 ตรงกับผลหวย 3 ตัวบน 682/708 วัน
 *   แท่ง 5 นาที (~60 วัน) แม่นกว่า → ทับวันที่มี (บ่ายตรงผลหวย 24/24)
 */
const HOURLY_BAR: Record<HangSengSession, string> = { am: "11:30", pm: "15:30" };
export async function hangSengResults(session: HangSengSession): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const hourly = await chart("range=730d&interval=1h");
  if (hourly) for (const b of hourly.bars) if (hkHHMM(b.t) === HOURLY_BAR[session]) out[hkDate(b.t)] = r2(b.close);
  const c = await chart("range=60d&interval=5m");
  if (c) for (const b of c.bars) if (hkHHMM(b.t) === RESULT_BAR[session]) out[hkDate(b.t)] = r2(b.close);
  return out;
}

/** ราคาสำหรับปุ่มบันทึกเปิด/เติมปิด — prevClose = ปิดทางการวันก่อน · last = แท่งผลของรอบนั้น (ถ้ามีแล้ว) */
export async function fetchHangSengQuote(session: HangSengSession): Promise<Quote | null> {
  const daily = await chart("range=10d&interval=1d");
  if (!daily || daily.bars.length < 2) return null;
  const intra = await chart("range=5d&interval=1m");
  const lastDay = daily.bars[daily.bars.length - 1];
  // Yahoo บางครั้งยังไม่ออกแท่งรายวันของวันนี้ ทั้งที่มีแท่งนาทีแล้ว → ยึดวันของแท่งนาทีล่าสุด
  const intraDay = intra?.bars.length ? hkDate(intra.bars[intra.bars.length - 1].t) : hkDate(lastDay.t);
  const tradingDate = intraDay > hkDate(lastDay.t) ? intraDay : hkDate(lastDay.t);
  const prevBar = [...daily.bars].reverse().find((b) => hkDate(b.t) < tradingDate);
  if (!prevBar) return null;
  const todays = intra?.bars.filter((b) => hkDate(b.t) === tradingDate) ?? [];
  const dayOpen = hkDate(lastDay.t) === tradingDate ? lastDay.open : todays[0]?.open;
  const pmOpen = session === "pm" ? todays.find((b) => hkHHMM(b.t) === PM_OPEN_BAR)?.open : undefined;
  const open = r2(pmOpen ?? dayOpen ?? prevBar.close);
  const base = { symbol: SYMBOL, source: "yahoo" as const, tradingDate, prevClose: r2(prevBar.close), open };
  const resultBar = todays.find((b) => hkHHMM(b.t) === RESULT_BAR[session]);
  if (resultBar) return { ...base, last: r2(resultBar.close), lastAt: new Date(resultBar.t * 1000), closed: true };
  const latest = todays[todays.length - 1];
  return { ...base, last: r2(latest ? latest.close : open), lastAt: new Date((latest?.t ?? lastDay.t) * 1000), closed: false };
}
