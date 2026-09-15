/**
 * ดึงราคาจาก Yahoo Finance (chart API, ไม่ต้องใช้ key) — ใช้เติมค่าเปิด/ปิดอัตโนมัติ และอ่านราคาสดระหว่างวัน
 * ค่าที่ได้เป็น float32 (เช่น 74781.7578125) ปัดเป็น 2 ตำแหน่งแล้วตรงกับที่ตลาดประกาศ
 */

/** ชื่อหุ้นในระบบ → สัญลักษณ์ Yahoo (เพิ่มได้ตามต้องการ) */
const SYMBOLS: Record<string, string> = {
  "BSE SENSEX": "^BSESN", SENSEX: "^BSESN", BSESN: "^BSESN",
  "NIFTY 50": "^NSEI", NIFTY: "^NSEI", NSEI: "^NSEI",
};
export const yahooSymbol = (stockSymbol: string) => SYMBOLS[stockSymbol.trim().toUpperCase()] ?? null;

export type Quote = {
  symbol: string;
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

export async function fetchQuote(stockSymbol: string): Promise<Quote | null> {
  const symbol = yahooSymbol(stockSymbol);
  if (!symbol) return null;
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
    return { symbol, tradingDate, prevClose: r2(prevClose), open: r2(q.open[i]), last: r2(meta.regularMarketPrice ?? q.close[i]), lastAt, closed };
  } catch {
    return null;
  }
}
