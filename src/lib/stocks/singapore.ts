/**
 * หุ้นสิงคโปร์ (ปกติ) — ดัชนี Straits Times Index (Yahoo: ^STI · ทางการ sgx.com) · ไฟล์ของสิงคโปร์เท่านั้น ไม่แตะหุ้นตัวอื่น
 *   ผลหวย = ปิดทางการ (หลังประมูลปิด 17:00–17:06 สิงคโปร์ ≈ 16:06 ไทย) ตามที่ investing แสดง — ผู้ใช้ยืนยัน 21 ต.ค. 69
 *     (20 ต.ค. 69 = 5,404.02 −7.98 → 402 / 98) · ล่าง = ทศนิยม(ปิด − ปิดทางการวันก่อน)
 *   บน 3 ตัว = หลักหน่วย + ทศนิยม 2 ตำแหน่ง (5,404.02 → 402)
 *   ปิดรายวันของ Yahoo ^STI = ปิดทางการ · ผลบน raakaadee ตั้งแต่ 25 ส.ค. 69 ใช้ราคา 17:00 (ก่อนประมูล) — คนละแบบกับเจ้ามือของผู้ใช้ ห้ามใช้
 *   โครงสร้าง ล่างเทียบปิดวันก่อนเข้าตาราง D → ไล่ 200 กรณีจาก D ได้
 */
import type { Quote } from "@/lib/yahoo";

const SYMBOL = "^STI";
const SG = 8 * 3600 * 1000; // เวลาสิงคโปร์ = UTC+8 (ไทย +1)
const sgDate = (t: number) => new Date(t * 1000 + SG).toISOString().slice(0, 10);
const sgHHMM = (t: number) => new Date(t * 1000 + SG).toISOString().slice(11, 16);
const r2 = (x: number) => Math.round(x * 100) / 100;

export const SINGAPORE_STOCK = { symbol: "SGX", name: "Straits Times Index ปิดทางการ (หลังประมูลปิด ~16:06 ไทย) — Yahoo ^STI" } as const;
const SG_SYMBOLS = ["SGX", "STI", "^STI", "SINGAPORE", "สิงคโปร์", "หุ้นสิงคโปร์"];
export const isSingapore = (symbol: string) => SG_SYMBOLS.includes(symbol.trim().toUpperCase()) || SG_SYMBOLS.includes(symbol.trim());
export const SINGAPORE_YAHOO = SYMBOL;

type Bar = { t: number; open: number; close: number };
async function chart(params: string): Promise<Bar[] | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}?${params}`, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const r = (await res.json())?.chart?.result?.[0];
    if (!r?.timestamp) return null;
    const q = r.indicators.quote[0];
    const bars: Bar[] = [];
    for (let i = 0; i < r.timestamp.length; i++) if (q.open?.[i] != null && q.close?.[i] != null) bars.push({ t: r.timestamp[i], open: q.open[i], close: q.close[i] });
    return bars;
  } catch {
    return null;
  }
}

/** ปิดทางการรายวัน (ไว้เป็น "ปิดวันก่อน") + เปิดของวัน */
export async function singaporeDaily(range = "3mo"): Promise<{ date: string; open: number; close: number }[]> {
  const bars = await chart(`range=${range}&interval=1d`);
  return bars ? bars.map((b) => ({ date: sgDate(b.t), open: r2(b.open), close: r2(b.close) })) : [];
}

/** ราคาสำหรับปุ่มบันทึกเปิด/เติมปิด — prevClose = ปิดทางการวันก่อน · last = ปิดทางการ (หลังประมูลปิด) ถ้าปิดแล้ว */
export async function fetchSingaporeQuote(): Promise<Quote | null> {
  const daily = await chart("range=10d&interval=1d");
  if (!daily || daily.length < 2) return null;
  const intra = await chart("range=5d&interval=1m");
  const lastDay = daily[daily.length - 1];
  // Yahoo บางครั้งยังไม่ออกแท่งรายวันของวันนี้ ทั้งที่มีแท่งนาทีแล้ว → ยึดวันของแท่งนาทีล่าสุด
  const intraDay = intra?.length ? sgDate(intra[intra.length - 1].t) : sgDate(lastDay.t);
  const tradingDate = intraDay > sgDate(lastDay.t) ? intraDay : sgDate(lastDay.t);
  const prevBar = [...daily].reverse().find((b) => sgDate(b.t) < tradingDate);
  if (!prevBar) return null;
  const todays = intra?.filter((b) => sgDate(b.t) === tradingDate) ?? [];
  const open = r2(sgDate(lastDay.t) === tradingDate ? lastDay.open : todays[0]?.open ?? prevBar.close);
  const base = { symbol: SYMBOL, source: "yahoo" as const, tradingDate, prevClose: r2(prevBar.close), open };
  // แท่ง 17:00 ขึ้นไป = ราคาประมูลปิด = ปิดทางการ (20 ต.ค. 69: แท่ง 17:00 = 5,404.02 ตรงกับ investing ก่อนแท่งรายวันจะออก)
  const closeBar = todays.filter((b) => sgHHMM(b.t) >= "17:00").at(-1);
  if (closeBar) return { ...base, last: r2(closeBar.close), lastAt: new Date(closeBar.t * 1000), closed: true };
  const latest = todays[todays.length - 1];
  return { ...base, last: r2(latest ? latest.close : open), lastAt: new Date((latest?.t ?? lastDay.t) * 1000), closed: false };
}
