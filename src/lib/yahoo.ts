/**
 * ดึงราคาอัตโนมัติ — ใช้เติมค่าเปิด/ปิด และอ่านราคาสดระหว่างวัน
 *   SENSEX: API ของเว็บ BSE (เรียลไทม์ ดีเลย์ ~1 นาที) ถ้าล่มใช้ Yahoo Finance (ดีเลย์ ~15 นาที)
 *   Yahoo ให้ค่าเป็น float32 (เช่น 74781.7578125) ปัดเป็น 2 ตำแหน่งแล้วตรงกับที่ตลาดประกาศ
 */

import { nikkeiSession, fetchNikkeiQuote } from "@/lib/stocks/nikkei";
import { isEgypt, fetchEgyptQuote } from "@/lib/stocks/egypt";
import { chinaSession, fetchChinaQuote } from "@/lib/stocks/china";
import { hangSengSession, fetchHangSengQuote } from "@/lib/stocks/hangseng";
import { isDowJones, DOW_YAHOO } from "@/lib/stocks/dowjones";
import { isSingapore, SINGAPORE_YAHOO, fetchSingaporeQuote } from "@/lib/stocks/singapore";

/** ชื่อหุ้นในระบบ → สัญลักษณ์ Yahoo (เพิ่มได้ตามต้องการ) */
const SYMBOLS: Record<string, string> = {
  "BSE SENSEX": "^BSESN", SENSEX: "^BSESN", BSESN: "^BSESN",
  "NIFTY 50": "^NSEI", NIFTY: "^NSEI", NSEI: "^NSEI",
};
export const yahooSymbol = (stockSymbol: string) => SYMBOLS[stockSymbol.trim().toUpperCase()] ?? (nikkeiSession(stockSymbol) ? "^N225" : isEgypt(stockSymbol) ? "^CASE30" : chinaSession(stockSymbol) ? "399001.SZ" : hangSengSession(stockSymbol) ? "^HSI" : isDowJones(stockSymbol) ? DOW_YAHOO : isSingapore(stockSymbol) ? SINGAPORE_YAHOO : null);

export type Quote = {
  symbol: string;
  /** แหล่งราคาสด: BSE = เว็บตลาดโดยตรง (ดีเลย์ ~1 นาที) · Yahoo ดีเลย์ ~15 นาที */
  source: "bse" | "yahoo";
  /** วันซื้อขายล่าสุดที่มีข้อมูล (YYYY-MM-DD ตามเวลาตลาด) */
  tradingDate: string;
  prevClose: number;
  open: number;
  last: number;
  lastAt: Date;
  /** ตลาดปิดแล้วสำหรับวันนั้น → last คือราคาปิด */
  closed: boolean;
};

const r2 = (x: number) => Math.round(x * 100) / 100;

/** วันที่ตามเขตเวลาของตลาด */
function dateInZone(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const num = (x: string) => Number(String(x).replace(/,/g, ""));

/**
 * SENSEX แบบเรียลไทม์จาก API ของเว็บ BSE เอง (ดีเลย์ราว 1 นาที) — ไม่เป็นทางการสำหรับบุคคลภายนอก อาจเปลี่ยน/ปิดได้
 * ตัวอย่างผลลัพธ์: ltp "74,273.11", chg "+269.29", dttm "16 Sep 26 | 13:53" (IST), Prev_Close, I_open
 */
export async function fetchBseSensexLive(): Promise<Quote | null> {
  try {
    const res = await fetch("https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36", Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const row = (await res.json())?.[0];
    if (!row?.ltp || !row?.dttm) return null;
    const m = /^(\d{1,2}) (\w{3}) (\d{2}) \| (\d{1,2}):(\d{2})$/.exec(String(row.dttm).trim());
    if (!m) return null;
    const [, d, mon, yy, hh, mm] = m;
    const lastAt = new Date(Date.UTC(2000 + Number(yy), MONTHS[mon], Number(d), Number(hh), Number(mm)) - 330 * 60 * 1000); // IST → UTC
    const tradingDate = `${2000 + Number(yy)}-${String(MONTHS[mon] + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const nowIst = new Date(Date.now() + 330 * 60 * 1000);
    const nowIstDate = nowIst.toISOString().slice(0, 10);
    const nowIstMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
    const closed = nowIstDate !== tradingDate || nowIstMin >= 15 * 60 + 35;
    return { symbol: "^BSESN", source: "bse", tradingDate, prevClose: r2(num(row.Prev_Close)), open: r2(num(row.I_open)), last: r2(num(row.ltp)), lastAt, closed };
  } catch {
    return null;
  }
}

export async function fetchQuote(stockSymbol: string): Promise<Quote | null> {
  // นิเคอิ (ปกติ) มีไฟล์ของตัวเอง: รอบเช้าใช้แท่ง 11:30 JST, รอบบ่ายใช้ปิดวัน
  const nk = nikkeiSession(stockSymbol);
  if (nk) return fetchNikkeiQuote(nk);
  if (isEgypt(stockSymbol)) return fetchEgyptQuote(); // อียิปต์: mubasher.info (Yahoo ไม่มีประวัติ)
  const cn = chinaSession(stockSymbol); // จีน (SZSE): รอบเช้าใช้แท่ง 11:30 จีน, รอบบ่ายใช้ปิดวัน
  if (cn) return fetchChinaQuote(cn);
  const hs = hangSengSession(stockSymbol); // ฮั่งเส็ง: เช้าใช้แท่ง 12:00 ฮ่องกง, บ่ายใช้แท่ง 16:00 (ก่อนประมูลปิด)
  if (hs) return fetchHangSengQuote(hs);
  if (isSingapore(stockSymbol)) return fetchSingaporeQuote(); // สิงคโปร์: ผล = ปิดทางการ (หลังประมูลปิด)
  const symbol = yahooSymbol(stockSymbol);
  if (!symbol) return null;
  // SENSEX: ใช้ BSE เรียลไทม์ก่อน ถ้าล่มค่อยใช้ Yahoo
  if (symbol === "^BSESN") {
    const live = await fetchBseSensexLive();
    if (live) return live;
  }
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta, ts: number[] = r.timestamp ?? [], q = r.indicators?.quote?.[0] ?? {};
    const tz: string = meta.exchangeTimezoneName ?? "Asia/Kolkata";
    // แถวสุดท้ายที่มีข้อมูล = วันซื้อขายล่าสุด
    let i = ts.length - 1;
    while (i >= 0 && (q.open?.[i] == null || q.close?.[i] == null)) i--;
    if (i < 0) return null;
    let prevIdx = i - 1;
    while (prevIdx >= 0 && q.close[prevIdx] == null) prevIdx--; // ข้ามวันหยุด (แถวว่าง)
    const prevClose = prevIdx >= 0 ? q.close[prevIdx] : meta.chartPreviousClose;
    const lastAt = new Date((meta.regularMarketTime ?? ts[i]) * 1000);
    const end = meta.currentTradingPeriod?.regular?.end;
    const tradingDate = dateInZone(new Date(ts[i] * 1000), tz);
    const closed = end ? Date.now() / 1000 > end + 60 || dateInZone(new Date(end * 1000), tz) !== tradingDate : false;
    return { symbol, source: "yahoo", tradingDate, prevClose: r2(prevClose), open: r2(q.open[i]), last: r2(meta.regularMarketPrice ?? q.close[i]), lastAt, closed };
  } catch {
    return null;
  }
}
