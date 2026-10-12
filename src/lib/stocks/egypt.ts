/**
 * หุ้นอียิปต์ (ปกติ) — ดัชนี EGX 30 · แหล่งข้อมูล: ไฟล์ CSV ที่เว็บ mubasher.info ใช้วาดกราฟเอง (Yahoo ไม่มีประวัติ ^CASE30)
 *   รายวัน (ตั้งแต่ 1998):  https://static.mubasher.info/File.MubasherCharts/File.Historical_Index_Charts_Dir/<id>.csv
 *       รูปแบบ  วันที่/00:00:00,เปิด,สูง,ต่ำ,ปิด,ปริมาณ — ช่อง "เปิด" ในไฟล์นี้คือปิดวันก่อน (ไม่ใช่ราคาเปิดจริง)
 *   รายนาที (วันนี้):        .../File.Delay_Index_Intraday_Charts_Dir/<id>.csv — เวลาในไฟล์ = UTC+2 ดีเลย์ ~15 นาที ตลาด 09:00–13:30 (ในไฟล์)
 *   ตรวจกับผลหวยหุ้นอียิปต์ 15–21 ก.ย. 69: ปิด 54,994.31 → 431 · เปลี่ยนแปลง −377.16 → 16 ตรงทุกวัน (ผล = ปิดวัน เทียบปิดวันก่อน)
 *   ออกผล ~19:35 น. ไทย (ตลาดปิด 14:30 ไคโร = 18:30 ไทย)
 * ไฟล์นี้เป็นของอียิปต์เท่านั้น ใช้เครื่องไล่กรณีเดียวกับ SENSEX ผ่านหน้าจอปกติ
 */
import type { Quote } from "@/lib/yahoo";

const ID = "39d67d8ab4f4c10bf22aa353e27879133c";
const HIST = `https://static.mubasher.info/File.MubasherCharts/File.Historical_Index_Charts_Dir/${ID}.csv`;
const INTRA = `https://static.mubasher.info/File.MubasherCharts/File.Delay_Index_Intraday_Charts_Dir/${ID}.csv`;
const PAGE = "https://english.mubasher.info/markets/EGX/"; // หน้าเว็บจริง: Open / Previous Close / High / Low / ราคาล่าสุด
export const EGYPT_SYMBOLS = ["EGX30", "EGX 30", "EGYPT", "อียิปต์", "หุ้นอียิปต์"];
export const isEgypt = (symbol: string) => EGYPT_SYMBOLS.includes(symbol.trim().toUpperCase()) || EGYPT_SYMBOLS.includes(symbol.trim());
export const EGYPT_STOCK = { symbol: "EGX30", name: "EGX 30 อียิปต์ ปิดวัน 14:30 ไคโร (18:30 ไทย) — mubasher.info" } as const;
const SESSION_END = "13:30"; // เวลาในไฟล์รายนาที

const r2 = (x: number) => Math.round(x * 100) / 100;
async function csv(url: string): Promise<string[][]> {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    return (await res.text()).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split(","));
  } catch {
    return [];
  }
}

/** ปิดรายวัน (วันที่, ปิด) ย้อนหลัง — เรียงเก่า→ใหม่ */
export async function egyptDaily(fromDate = "2016-01-01"): Promise<{ date: string; close: number }[]> {
  // ไฟล์ของ mubasher มีวันซ้ำ (~160 แถว) และวันหาย (~5–10% โดยเฉพาะวันพฤหัส) → ตัดซ้ำ; วันหายเติมจากไฟล์ investing.com ด้วยมือ (README)
  const rows = await csv(HIST);
  const seen = new Set<string>();
  return rows.filter((r) => r.length >= 5 && r[0].slice(0, 10) >= fromDate).map((r) => ({ date: r[0].slice(0, 10), close: r2(Number(r[4])) })).filter((r) => Number.isFinite(r.close) && !seen.has(r.date) && !!seen.add(r.date));
}

/**
 * วันซื้อขายถัดไปของอียิปต์ (ตลาดเปิด อาทิตย์–พฤหัส หยุดศุกร์/เสาร์) — ใช้สร้างแถวของวันใหม่ได้ทันทีที่ปิดวันก่อน
 * เพราะอียิปต์ประกาศ "เปิด" = ปิดวันก่อน จึงรู้เลขเปิด (และ D) ตั้งแต่ตลาดยังไม่เปิด ไม่ต้องรอ
 */
export function egyptNextTradingDay(lastDate: string): string {
  const d = new Date(`${lastDate}T00:00:00.000Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 5 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** อ่านกล่องสรุปของหน้า EGX ตรง ๆ (ค่าเดียวกับที่ผู้ใช้เห็นบนเว็บ) — คืน null ถ้าเว็บเปลี่ยนโครงสร้าง */
async function egyptPageQuote(): Promise<{ last: number; open: number; prevClose: number; dateLabel: string } | null> {
  try {
    const res = await fetch(PAGE, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();
    const num = (label: string) => {
      const m = html.match(new RegExp(`market-summary__block-text">\\s*${label}\\s*</span>\\s*<span class="market-summary__block-number">\\s*([\\d,.]+)`));
      return m ? Number(m[1].replace(/,/g, "")) : NaN;
    };
    const last = Number(html.match(/market-summary__last-price[^>]*>\s*([\d,.]+)/)?.[1]?.replace(/,/g, ""));
    const open = num("Open"), prevClose = num("Previous Close");
    const dateLabel = html.match(/market-summary__date">\s*Last update:\s*([^<]+?)\s*</)?.[1] ?? "";
    return [last, open, prevClose].every(Number.isFinite) ? { last, open, prevClose, dateLabel } : null;
  } catch {
    return null;
  }
}

/** ราคาวันนี้: เปิด/ปิดวันก่อน/ล่าสุด จากหน้าเว็บ EGX โดยตรง (ตรงกับที่ผู้ใช้เห็น) · ไฟล์ CSV ใช้บอกวันและเวลาแท่งล่าสุด, ปิดแล้วเมื่อถึงแท่ง 13:30 (เวลาในไฟล์) หรือไฟล์รายวันมีแถวของวันนั้นแล้ว */
export async function fetchEgyptQuote(): Promise<Quote | null> {
  const [intra, daily, page] = await Promise.all([csv(INTRA), egyptDaily("2026-01-01"), egyptPageQuote()]);
  if (!intra.length || daily.length < 2) return null;
  const tradingDate = intra[0][0].slice(0, 10);
  const first = intra[0], last = intra[intra.length - 1];
  const lastTime = last[0].slice(11, 16);
  const dailyToday = daily.find((d) => d.date === tradingDate);
  const prevRow = [...daily].reverse().find((d) => d.date < tradingDate);
  if (!prevRow) return null;
  const closed = !!dailyToday || lastTime >= SESSION_END;
  const lastPrice = dailyToday ? dailyToday.close : r2(Number(last[4]));
  const [y, m, d] = tradingDate.split("-").map(Number); const [hh, mm] = lastTime.split(":").map(Number);
  // "Open" ที่เว็บประกาศ = ปิดวันก่อน (เปลี่ยนแปลง 0 เสมอ) ซึ่งไม่บอกอะไร
  //   ผู้ใช้ขอให้ยึด "เปิดมาเท่าไหร่ เปลี่ยนแปลงเท่าไหร่" ของวันนั้นจริง ๆ → ใช้ราคาแท่งแรกของวัน (09:00 ในไฟล์รายนาที)
  const open = r2(Number(first[1]));
  const prevClose = page?.prevClose ?? prevRow.close;
  return { symbol: "EGX30", source: "yahoo", tradingDate, prevClose, open, last: dailyToday ? lastPrice : page?.last ?? lastPrice, lastAt: new Date(Date.UTC(y, m - 1, d, hh - 2, mm)), closed };
}
