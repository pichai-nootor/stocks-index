/**
 * หุ้นดาวโจนส์ (ปกติ) — Dow Jones Industrial Average (Yahoo: ^DJI · อ้างอิง investing.com/indices/us-30) · ไฟล์ของดาวโจนส์เท่านั้น
 *   ผลหวย = ปิดทางการของวันซื้อขายสหรัฐ ประกาศ ~03:05 ไทยของวันถัดไป (ช่วงเวลาฤดูหนาวสหรัฐ ~04:05)
 *   บน 3 ตัว = หลักหน่วย + ทศนิยม 2 ตำแหน่งของปิด · ล่าง = ทศนิยมของ (ปิด − ปิดวันก่อน)
 *   ตรวจกับผลหวยจริง (raakaadee) 38/38 งวด (ก.ค.–ต.ค. 69) ตรงกับปิดรายวันของ Yahoo ทุกงวด
 *   วันที่ของแถว = วันที่ตลาดสหรัฐ (ไม่ใช่วันที่ไทยตอนผลออก) — เหมือนที่ raakaadee ใช้
 */
const SYMBOL = "^DJI";
const r2 = (x: number) => Math.round(x * 100) / 100;

export const DOW_STOCK = { symbol: "DOW JONES", name: "Dow Jones Industrial Average ปิดทางการ (ผลออก ~03:05 ไทย) — Yahoo ^DJI" } as const;
const DOW_SYMBOLS = ["DOW JONES", "DOWJONES", "DOW", "DJI", "DJIA", "^DJI", "ดาวโจนส์"];
export const isDowJones = (symbol: string) => DOW_SYMBOLS.includes(symbol.trim().toUpperCase()) || DOW_SYMBOLS.includes(symbol.trim());
export const DOW_YAHOO = SYMBOL;

/** ปิดทางการรายวัน + เปิดของวัน (วันที่ตามเวลานิวยอร์ก) */
export async function dowDaily(range = "3mo"): Promise<{ date: string; open: number; close: number }[]> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}?range=${range}&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const r = (await res.json())?.chart?.result?.[0];
    if (!r?.timestamp) return [];
    const q = r.indicators.quote[0];
    const end: number | undefined = r.meta?.currentTradingPeriod?.regular?.end;
    const ny = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(t * 1000));
    const out: { date: string; open: number; close: number }[] = [];
    for (let i = 0; i < r.timestamp.length; i++) {
      if (q.open?.[i] == null || q.close?.[i] == null) continue;
      const date = ny(r.timestamp[i]);
      // แท่งของวันที่ยังซื้อขายอยู่ = ราคาระหว่างวัน ไม่ใช่ปิด → ไม่เอา
      if (end && date === ny(end) && Date.now() / 1000 < end + 60) continue;
      out.push({ date, open: r2(q.open[i]), close: r2(q.close[i]) });
    }
    return out;
  } catch {
    return [];
  }
}
