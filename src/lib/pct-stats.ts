/**
 * สถิติ "% ตอนปิด/ตอนเปิด → เลขที่ออก" ของหุ้นปกติ จากราคารายวันย้อนหลัง 10 ปี (ผู้ใช้ขอ 14 ต.ค. 69)
 *   ไว้ดูว่าแต่ละ % (ละเอียดถึง 0.01%) เคยออกเลขอะไร — เป็นเครื่องมือดูข้อมูล ไม่ได้ใช้ในสูตรฟัน
 *   ผล = ทศนิยมราคาปิด (บน) + ทศนิยม(ปิด − ปิดวันก่อน) (ล่าง) · ราคารายวัน = ปิดทั้งวัน (ตรงกับรอบบ่าย/รอบเดียว)
 */
import { prisma } from "@/lib/prisma";
import { top2, bottom2 } from "@/lib/digits";
import { todayThai } from "@/lib/intraday";
import { egyptDaily, isEgypt } from "@/lib/stocks/egypt";
import { nikkeiMorningCloses, nikkeiSession as nikkeiSessionOf } from "@/lib/stocks/nikkei";
import { chinaMorningCloses, chinaSession as chinaSessionOf } from "@/lib/stocks/china";
import { hangSengResults, hangSengSession as hangSengSessionOf } from "@/lib/stocks/hangseng";
import { isDowJones } from "@/lib/stocks/dowjones";

export const PCT_INDEXES = [
  { key: "nk-am", label: "นิเคอิ เช้า", yahoo: "^N225", am: "nk", note: "ปิดภาคเช้า ย้อนหลัง ~2 ปี" },
  { key: "nk-pm", label: "นิเคอิ บ่าย", yahoo: "^N225", am: null, note: "ปิดทั้งวัน 10 ปี · ไม่มี % เปิดบ่ายย้อนหลัง" },
  { key: "cn-am", label: "จีน เช้า", yahoo: "399001.SZ", am: "cn", note: "ปิดภาคเช้า ย้อนหลัง ~2 ปี" },
  { key: "cn-pm", label: "จีน บ่าย", yahoo: "399001.SZ", am: null, note: "ปิดทั้งวัน 10 ปี · ไม่มี % เปิดบ่ายย้อนหลัง" },
  { key: "hk-am", label: "ฮั่งเส็ง เช้า", yahoo: "^HSI", am: "hk", note: "ปิดภาคเช้า ย้อนหลัง ~2 ปี" },
  // ฮั่งเส็งบ่าย: ผลหวย = ราคา 16:00 ไม่ใช่ปิดทางการ — เดิมใช้คีย์ hk-pm เก็บปิดทางการ (ผิด) · คีย์ใหม่ hk-pm16 เก็บราคา 16:00 (15 ต.ค. 69)
  { key: "hk-pm16", label: "ฮั่งเส็ง บ่าย", yahoo: "^HSI", am: "hk-pm", note: "ราคา 16:00 (ตามผลหวย) ย้อนหลัง ~2 ปี · ไม่มี % เปิดบ่ายย้อนหลัง" },
  { key: "sx", label: "SENSEX", yahoo: "^BSESN", am: null, note: "10 ปี" },
  { key: "dj", label: "ดาวโจนส์", yahoo: "^DJI", am: null, note: "10 ปี" },
  { key: "eg", label: "อียิปต์", yahoo: null, am: null, note: "10 ปี · ไม่มี % ตอนเปิด (ตลาดประกาศเปิด = ปิดวันก่อน)" },
] as const;
/** รอบบ่ายดูได้แต่ % ปิด (ข้อมูลรายวันไม่มีราคาเปิดภาคบ่าย) · อียิปต์ไม่มีเปิด */
export const hasOpenPct = (key: string) => !/-pm/.test(key) && key !== "eg";
export type PctIndex = (typeof PCT_INDEXES)[number]["key"];
export const isPctIndex = (s: string): s is PctIndex => PCT_INDEXES.some((x) => x.key === s);

export type PctDay = { date: string; prevClose: number; close: number; change: number; openPct: number | null; closePct: number; top: string; bottom: string; digits: string[] };

const r2 = (x: number) => Math.round(x * 100) / 100;

async function yahooDaily(symbol: string): Promise<{ date: string; open: number; close: number }[]> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d`, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 6 * 3600 }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const r = (await res.json())?.chart?.result?.[0];
    if (!r?.timestamp) return [];
    const q = r.indicators.quote[0], off = Number(r.meta?.gmtoffset ?? 0);
    const out: { date: string; open: number; close: number }[] = [];
    for (let i = 0; i < r.timestamp.length; i++) if (q.open?.[i] != null && q.close?.[i] != null) out.push({ date: new Date((r.timestamp[i] + off) * 1000).toISOString().slice(0, 10), open: r2(q.open[i]), close: r2(q.close[i]) });
    return out;
  } catch {
    return [];
  }
}

/** ดึงราคาล่าสุดจากแหล่ง แล้วเก็บวันที่ยังไม่มีลง IndexDay (เก็บถาวร ไม่เขียนทับวันที่มีแล้ว) */
export async function syncIndexDays(key: PctIndex) {
  const idx = PCT_INDEXES.find((x) => x.key === key)!;
  const daily: { date: string; open: number | null; close: number }[] = idx.yahoo ? await yahooDaily(idx.yahoo) : (await egyptDaily()).map((r) => ({ ...r, open: null }));
  // รอบเช้า: ผล = ปิดภาคเช้า เทียบปิดวันก่อน · เปิด = เปิดเช้า
  const amClose = idx.am === "nk" ? await nikkeiMorningCloses() : idx.am === "cn" ? await chinaMorningCloses() : idx.am === "hk" ? await hangSengResults("am") : idx.am === "hk-pm" ? await hangSengResults("pm") : null;
  const have = new Set((await prisma.indexDay.findMany({ where: { key }, select: { date: true } })).map((r) => r.date));
  const add: { key: string; date: string; prevClose: number; open: number | null; close: number }[] = [];
  for (let i = 1; i < daily.length; i++) {
    const prevClose = daily[i - 1].close, date = daily[i].date;
    // วันนี้ยังอาจไม่ปิด (ราคาระหว่างวัน) → ไม่เก็บ รอเก็บพรุ่งนี้ตอนเป็นราคาปิดจริงแล้ว
    if (!prevClose || date === daily[i - 1].date || have.has(date) || date >= todayThai()) continue;
    const close = amClose ? amClose[date] : daily[i].close;
    if (close === undefined || !Number.isFinite(close)) continue;
    add.push({ key, date, prevClose, open: hasOpenPct(key) ? daily[i].open : null, close });
    have.add(date);
  }
  if (add.length) await prisma.indexDay.createMany({ data: add });
}

/** วันทั้งหมดของดัชนี (เก่า→ใหม่) จากที่เก็บไว้ พร้อมราคาปิด จุดที่เปลี่ยน % เปิด/ปิด (ปัด 2 ตำแหน่งแบบที่เว็บแสดง) และเลขที่ออก */
export async function pctDays(key: PctIndex): Promise<PctDay[]> {
  await syncIndexDays(key);
  const rows = await prisma.indexDay.findMany({ where: { key }, orderBy: { date: "asc" } });
  return rows.map((r) => {
    const change = r2(r.close - r.prevClose), top = top2(r.close), bottom = bottom2(change);
    return { date: r.date, prevClose: r.prevClose, close: r.close, change, openPct: r.open !== null && r.open !== r.prevClose ? r2(((r.open - r.prevClose) / r.prevClose) * 100) : null, closePct: r2((change / r.prevClose) * 100), top, bottom, digits: [...new Set(top + bottom)] };
  });
}

/** หุ้นในระบบ → ชุดข้อมูล % ของมัน (null = ไม่มี) */
export function pctKeyOf(symbol: string): PctIndex | null {
  const nk = nikkeiSessionOf(symbol), cn = chinaSessionOf(symbol), hk = hangSengSessionOf(symbol);
  if (nk) return `nk-${nk}`;
  if (cn) return `cn-${cn}`;
  if (hk) return hk === "am" ? "hk-am" : "hk-pm16";
  if (isDowJones(symbol)) return "dj";
  if (isEgypt(symbol)) return "eg";
  if (/SENSEX|BSESN/i.test(symbol)) return "sx";
  return null;
}

/** สถิติช่วง % ปิด [lo, hi] จากข้อมูลที่เก็บไว้ (อ่านอย่างเดียว ไม่ดึงใหม่) — วัน · เลขที่ออกบ่อย · เลข 2 ตัวที่ออกบ่อย */
export async function closeBandStats(key: PctIndex, lo: number, hi: number) {
  const rows = await prisma.indexDay.findMany({ where: { key } });
  const list = rows.map((r) => ({ change: r2(r.close - r.prevClose), r })).map(({ change, r }) => ({ pct: r2((change / r.prevClose) * 100), top: top2(r.close), bottom: bottom2(change) })).filter((x) => x.pct >= Math.min(lo, hi) && x.pct <= Math.max(lo, hi));
  const digit = "0123456789".split("").map((d) => ({ d, n: list.filter((x) => (x.top + x.bottom).includes(d)).length })).sort((a, b) => b.n - a.n);
  const num = new Map<string, number>(); for (const x of list) for (const m of [x.top, x.bottom]) num.set(m, (num.get(m) ?? 0) + 1);
  return { days: list.length, digit, nums: [...num].sort((a, b) => b[1] - a[1]).slice(0, 4) };
}
