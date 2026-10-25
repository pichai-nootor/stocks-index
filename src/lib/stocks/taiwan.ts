/**
 * หุ้นไต้หวัน (ปกติ) — ดัชนี TAIEX / Taiwan Weighted (Yahoo: ^TWII · TradingView TWSE:IX0001 · อ้างอิง investing.com/indices/taiwan-weighted)
 *   ผลหวย = ปิดทางการ (หลังประมูลปิด 13:25–13:30 ไต้หวัน = 12:30 ไทย) ตามที่ investing แสดง
 *   บน 3 ตัว = หลักหน่วย + ทศนิยม 2 ตำแหน่งของปิด · ล่าง = ทศนิยมของ (ปิด − ปิดวันก่อน)
 *   ตรวจ 21 ต.ค. 69: ปิด/เปิดรายวันของ Yahoo ตรงกับตารางข้อมูลย้อนหลังของ investing 20/20 วัน (21 ก.ย. – 21 ต.ค. 69)
 *   ไฟล์ของไต้หวันเท่านั้น (ไม่เกี่ยวกับไต้หวัน VIP ใน formulas/tw.ts)
 */
const SYMBOL = "^TWII";
const r2 = (x: number) => Math.round(x * 100) / 100;

export const TAIWAN_STOCK = { symbol: "TAIWAN", name: "TAIEX ปิดทางการ (ผลออก ~12:30 ไทย) — Yahoo ^TWII" } as const;
const TAIWAN_SYMBOLS = ["TAIWAN", "TAIEX", "TWII", "^TWII", "ไต้หวัน", "หุ้นไต้หวัน"];
export const isTaiwan = (symbol: string) => TAIWAN_SYMBOLS.includes(symbol.trim().toUpperCase()) || TAIWAN_SYMBOLS.includes(symbol.trim());
export const TAIWAN_YAHOO = SYMBOL;

/** ปิดทางการรายวัน + เปิดของวัน (วันที่ตามเวลาไต้หวัน) · ตัดแท่งของวันที่ยังซื้อขายอยู่ */
export async function taiwanDaily(range = "6mo"): Promise<{ date: string; open: number; close: number }[]> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}?range=${range}&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const r = (await res.json())?.chart?.result?.[0];
    if (!r?.timestamp) return [];
    const q = r.indicators.quote[0];
    const end: number | undefined = r.meta?.currentTradingPeriod?.regular?.end;
    const tw = (t: number) => new Date(t * 1000 + 8 * 3600 * 1000).toISOString().slice(0, 10);
    const out: { date: string; open: number; close: number }[] = [];
    for (let i = 0; i < r.timestamp.length; i++) {
      if (q.open?.[i] == null || q.close?.[i] == null) continue;
      const date = tw(r.timestamp[i]);
      if (end && date === tw(end) && Date.now() / 1000 < end + 60) continue; // ยังไม่ปิด
      out.push({ date, open: r2(q.open[i]), close: r2(q.close[i]) });
    }
    return out;
  } catch {
    return [];
  }
}
