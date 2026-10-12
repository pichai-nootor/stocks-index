/**
 * หุ้น VIP จาก stocks-vip.com — ดัชนีจำลองของแต่ละตลาด อัปเดตทุกนาที
 *   ผลของวัน: บน 3 หลัก = หลักหน่วย + ทศนิยม 2 ตำแหน่งของราคาปิด (969,004.29 → "429")
 *              ล่าง 2 หลัก = ทศนิยมของ diff ที่เว็บให้ (−92.32 → "32")
 *   ระหว่างวัน diff = ราคา − เปิด ทุกแถวเป๊ะ แต่แถวสุดท้าย (ผล) ไม่ตรง (18 ก.ย. 69: −92.32 ทั้งที่ ราคา − เปิด = −92.94)
 *   → ล่างของผลอาจไม่ผูกกับบนผ่านทศนิยมเปิด เก็บ open/close/diff ไว้ให้สูตร B (formulas/vip.ts) พิสูจน์ตัวเองด้วยคะแนน
 *   ตรวจแล้ว 74 งวดที่มีราคาครบทั้ง 6 ตลาด (20–27 ก.ย. 69): vipTop3(ปิด) + vipBottom2(diff) = ผลทางการ 74/74 → ราคาที่เก็บได้ตรวจตัวเองได้
 *   endpoint (ไม่เป็นทางการ อาจเปลี่ยนได้):
 *     https://api.stocks-vip.com/api/history/{market}  → ผลย้อนหลัง ~15 วัน (r1 เช้า / r2 เย็น) — ให้แต่เลขผล ไม่มีราคา
 *     https://api.stocks-vip.com/api/{market}           → ราคาวันนี้
 *       อินเดีย/นิเคอิ/จีน/ไต้หวัน: prices = ลิสต์รายนาที + ช่อง open
 *       ฮั่งเส็ง/เกาหลี: ไม่มี open และ prices เป็น "ภาพนิ่ง" ของราคาล่าสุด แต่มีช่อง results.r1/r2 = ราคา+diff ณ เวลาออกผลของรอบนั้น
 *         → สองตลาดนี้เก็บได้แค่ "ราคาปิดรายรอบ" (เช้าและบ่าย) ห้ามเอาภาพนิ่งมาเก็บเป็นราคาเปิด
 */

/** เวลาออกผล (เวลาไทย) ต่อรอบ — เวลาในฟีดราคาไม่ใช่เวลาไทย (อินเดียฟีดจบ 16:15 แต่ผลออก 17:25) จึงยึดตารางนี้ */
export const VIP_MARKETS = [
  { code: "in", label: "หุ้นอินเดีย VIP", rounds: [2], closeThai: { 2: "17:25" } },
  { code: "jp", label: "หุ้นนิเคอิ VIP", rounds: [1, 2], closeThai: { 1: "09:05", 2: "13:25" }, feedRoundTime: { 1: "11:05", 2: "15:25" } }, // เวลาในฟีด = เวลาญี่ปุ่น (ไทย +2 ชม.)
  { code: "cn", label: "หุ้นจีน VIP", rounds: [1, 2], closeThai: { 1: "10:05", 2: "14:25" }, feedRoundTime: { 1: "11:05", 2: "15:25" } }, // เวลาในฟีด = เวลาจีน (ไทย +1 ชม.)
  { code: "hk", label: "หุ้นฮั่งเส็ง VIP", rounds: [1, 2], closeThai: { 1: "10:35", 2: "15:25" } },
  { code: "tw", label: "หุ้นไต้หวัน VIP", rounds: [2], closeThai: { 2: "11:35" } },
  { code: "kr", label: "หุ้นเกาหลี VIP", rounds: [2], closeThai: { 2: "12:35" } },
  { code: "sg", label: "หุ้นสิงคโปร์ VIP", rounds: [2], closeThai: { 2: "17:05" } }, // ฟีดจบ 18:05 (เวลาสิงคโปร์ = ไทย +1 ชม.)
  { code: "uk", label: "หุ้นอังกฤษ VIP", rounds: [2], closeThai: { 2: "21:50" } }, // หน้า /live/ukx ของ stocks-vip.com ดึงผลจาก lottosuperrich (ดู fetchUkHistory)
] as const;
export type VipMarket = (typeof VIP_MARKETS)[number]["code"];
export const isVipMarket = (s: string): s is VipMarket => VIP_MARKETS.some((m) => m.code === s);
export const vipMarket = (code: VipMarket) => VIP_MARKETS.find((m) => m.code === code)!;
export const roundLabel = (round: number, market: VipMarket) => (vipMarket(market).rounds.length === 1 ? "" : round === 1 ? "เช้า" : "เย็น");
/** เวลาออกผลรอบสุดท้ายของวัน (เวลาไทย "HH:MM") */
export const lastCloseThai = (market: VipMarket) => { const m = vipMarket(market); return (m.closeThai as Record<number, string>)[Math.max(...m.rounds)]; };
/** เวลาออกผล (ไทย) ของรอบ */
export const roundCloseThai = (market: VipMarket, round: number) => (vipMarket(market).closeThai as Record<number, string>)[round];
/** วันนี้ (ไทย) ผ่านเวลาออกผลของวันที่ feedDate แล้วหรือยัง (ไม่ระบุรอบ = รอบสุดท้าย) */
export function pastCloseThai(market: VipMarket, feedDate: string, now = new Date(), round?: number) {
  const thai = new Date(now.getTime() + 7 * 3600 * 1000);
  const today = thai.toISOString().slice(0, 10);
  const hhmm = thai.toISOString().slice(11, 16);
  const close = round ? roundCloseThai(market, round) : lastCloseThai(market);
  return feedDate < today || (feedDate === today && hhmm >= close);
}

const API = "https://api.stocks-vip.com/api";
// สร้างใหม่ทุกครั้ง — AbortSignal.timeout ที่สร้างครั้งเดียวระดับโมดูลจะหมดอายุแล้วทำให้ทุก fetch หลังจากนั้นล้มทันที
const opts = () => ({ headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" as const, signal: AbortSignal.timeout(8000) });

export type VipHistoryRow = { date: string; round: number; top: string; bottom: string; close?: number; diff?: number };

/** แถวผล 1 รอบ: ตารางประวัติให้ {prize_1st, prize_2nd} ส่วนช่อง results ในฟีด (ฮั่งเส็ง) ให้ {price, diff} */
const parseRounds = (date: string, row: Record<string, unknown>, out: VipHistoryRow[]) => {
  for (const [key, round] of [["r1", 1], ["r2", 2]] as const) {
    const r = row[key] as { prize_1st?: unknown; prize_2nd?: unknown; price?: unknown; diff?: unknown } | null | undefined;
    if (!r) continue;
    let top: string | null = null, bottom: string | null = null, prices: { close?: number; diff?: number } = {};
    if (/^\d{3}$/.test(String(r.prize_1st)) && /^\d{2}$/.test(String(r.prize_2nd))) { top = String(r.prize_1st); bottom = String(r.prize_2nd); }
    else if (Number.isFinite(Number(r.price)) && Number.isFinite(Number(r.diff)) && r.price !== null && r.price !== undefined) { top = vipTop3(Number(r.price)); bottom = vipBottom2(Number(r.diff)); prices = { close: Number(r.price), diff: Number(r.diff) }; }
    if (top === null || bottom === null) continue;
    const had = out.find((x) => x.date === date && x.round === round);
    // ตารางประวัติให้แต่เลขผล ส่วนช่อง results ของฟีดให้ราคาปิด+diff ด้วย → ถ้าแถวเดิมยังไม่มีราคา ให้เติมเข้าไป (เดิมข้ามทิ้ง ราคาจึงหายทุกวันที่เปิดหน้าช้า)
    if (had) { if (had.close === undefined && prices.close !== undefined) Object.assign(had, prices); continue; }
    out.push({ date, round, top, bottom, ...prices });
  }
};

/**
 * ผลย้อนหลังจากเว็บ (ราว 15 วัน) — ข้ามรอบที่ยังไม่ออกผล
 * บางตลาด (ฮั่งเส็ง) ฟีดราคาวันนี้มีช่อง results ของวันนั้นด้วย ซึ่งมาเร็วกว่าตารางประวัติ → รวมเข้าไปด้วย
 */
export async function fetchVipHistory(market: VipMarket): Promise<VipHistoryRow[] | null> {
  if (market === "uk") return fetchUkHistory();
  try {
    const res = await fetch(`${API}/history/${market}?t=${Date.now()}`, opts());
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.status !== "success" || !Array.isArray(json.data)) return null;
    const out: VipHistoryRow[] = [];
    for (const row of json.data) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) continue;
      parseRounds(String(row.date), row, out);
    }
    try {
      const feed = (await (await fetch(`${API}/${market}?t=${Date.now()}`, opts())).json())?.data;
      if (feed?.results && /^\d{4}-\d{2}-\d{2}$/.test(String(feed.date))) parseRounds(String(feed.date), feed.results, out);
    } catch { /* ฟีดล่มไม่เป็นไร ใช้ประวัติอย่างเดียว */ }
    return out;
  } catch {
    return null;
  }
}

/**
 * หุ้นอังกฤษ VIP (FTSE 100 ของ stocks-vip.com /live/ukx) — ผลมาจาก gcp.lottosuperrich.com (ไม่เป็นทางการ อาจเปลี่ยนได้)
 *   บน 3 ตัว = 3 หลักท้ายของรางวัลที่ 1 · ล่าง 2 ตัว = 2 หลักท้ายของรางวัลที่ 2 (12 ต.ค. 69: 24866 / 68337 → 866 / 37 ตรงกับ raakaadee)
 *   รางวัลนี้มาจากราคาในกราฟ /chart/gb เหมือนตลาด VIP อื่น: แถวสุดท้าย 59,628.66 / diff −147.37 → 866 / 37
 *     (diff ของแถวผลไม่ตรง ราคา − เปิด = −147.61 เหมือนตลาดอื่น) · เวลาในกราฟ = ไทย − 10 ชม. (แถวสุดท้าย 11:50 = 21:50 ไทย)
 *   /history/gb ให้ย้อนหลังแค่ 5 วัน (ไม่รวมวันนี้) · /result/gb = งวดวันนี้ (ใช้เมื่อถึงเวลาประกาศ show_1st ไทยแล้วเท่านั้น)
 */
const UK_API = "https://gcp.lottosuperrich.com";
type UkRow = { lotto_date?: unknown; show_1st?: unknown; results?: { prize_1st?: unknown; prize_2nd?: unknown } | null };
async function fetchUkHistory(): Promise<VipHistoryRow[] | null> {
  const toRow = (x: UkRow): VipHistoryRow | null => {
    const d = String(x.lotto_date ?? ""), p1 = String(x.results?.prize_1st ?? ""), p2 = String(x.results?.prize_2nd ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{5}$/.test(p1) && /^\d{5}$/.test(p2) ? { date: d, round: 2, top: p1.slice(-3), bottom: p2.slice(-2) } : null;
  };
  try {
    const res = await fetch(`${UK_API}/history/gb?t=${Date.now()}`, opts());
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.status !== "success" || !Array.isArray(json.data)) return null;
    const out = (json.data as UkRow[]).map(toRow).filter((x): x is VipHistoryRow => x !== null);
    try {
      const today = (await (await fetch(`${UK_API}/result/gb?t=${Date.now()}`, opts())).json())?.data as UkRow | undefined;
      const nowThai = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
      const row = today && String(today.show_1st ?? "9999") <= nowThai ? toRow(today) : null; // ก่อนเวลาประกาศอาจยังเป็นเลขหมุน
      if (row && !out.some((x) => x.date === row.date)) out.push(row);
    } catch { /* งวดวันนี้ล่มไม่เป็นไร */ }
    return out;
  } catch {
    return null;
  }
}

/** ราคาวันนี้ของอังกฤษ VIP จากกราฟ /chart/gb (รูปแบบใกล้ฟีด stocks-vip: open + prices รายนาที + times) */
async function fetchUkToday(): Promise<VipToday | null> {
  try {
    const res = await fetch(`${UK_API}/chart/gb?t=${Date.now()}`, opts());
    if (!res.ok) return null;
    const d = (await res.json())?.data;
    const list: { time?: string; price?: unknown; diff?: unknown; datetime?: string }[] = Array.isArray(d?.prices) ? d.prices : [];
    const times: string[] = Array.isArray(d?.times) ? d.times.map(String) : [];
    if (!list.length || !times.length || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) return null;
    const last = list[list.length - 1];
    const price = Number(last.price), diff = Number(last.diff);
    if (!Number.isFinite(price) || !Number.isFinite(diff)) return null;
    const date = String(d.date), endTime = times[times.length - 1], lastTime = String(last.time);
    // ไม่เก็บราคาเปิด (ผู้ใช้สั่ง 13 ต.ค. 69): สูตรไม่ใช้ และผลมาจากราคาแถวสุดท้าย + diff → เก็บแค่ราคาปิด + diff ตอนผลออก
    const feedDone = lastTime >= endTime;
    return { date, open: null, last: price, diff, rounds: [], lastTime, endTime, closed: feedDone || pastCloseThai("uk", date), feedDone, updatedAt: String(last.datetime ?? "") };
  } catch {
    return null;
  }
}

export type VipRoundPrice = { round: number; price: number; diff: number; time: string };
export type VipToday = {
  date: string;        // YYYY-MM-DD
  /** ราคาเปิด — มีเฉพาะตลาดที่ฟีดให้ช่อง open (อินเดีย/นิเคอิ/จีน/ไต้หวัน) · ฮั่งเส็ง/เกาหลีไม่มี = null (ห้ามเอาราคาระหว่างวันมาสวมเป็น "เปิด") */
  open: number | null;
  last: number;        // ราคาล่าสุด
  /** ราคา ณ เวลาออกผลของแต่ละรอบ (ตลาด 2 รอบ) — ถ้าฟีดถึงเวลานั้นแล้ว */
  rounds: VipRoundPrice[];
  diff: number;        // diff ตามเว็บ (ระหว่างวัน = last − open; แถวผลอาจไม่ตรง)
  lastTime: string;    // เวลาแถวล่าสุดตามฟีด (ไม่ใช่เวลาไทย)
  endTime: string;     // เวลาแถวสุดท้ายของฟีด
  closed: boolean;     // เลยเวลาออกผล (ไทย) ของวันนั้น หรือฟีดถึงแถวสุดท้ายแล้ว
  feedDone: boolean;   // ฟีดถึงแถวสุดท้ายแล้วจริง — ใช้แถวสุดท้ายเป็น "ผล" ได้เฉพาะเมื่อเป็น true (19–20 ก.ย. อินเดีย ฟีดถึงแถวสุดท้าย ~17:45 ทั้งที่เวลาออกผล 17:25)
  updatedAt: string;   // dateUpdate จากเว็บ
};

/** ราคาวันนี้ (เปิด + ล่าสุด) — ใช้ดู D = ทศนิยมของเปิด ตั้งแต่ตลาดเปิด และเก็บ open/close ตอนปิด */
export async function fetchVipToday(market: VipMarket): Promise<VipToday | null> {
  if (market === "uk") return fetchUkToday();
  try {
    const res = await fetch(`${API}/${market}?t=${Date.now()}`, opts());
    if (!res.ok) return null;
    const d = (await res.json())?.data;
    // บางตลาด (เกาหลี/ฮั่งเส็ง) ฟีดให้ prices เป็นก้อนเดียว ไม่ใช่ลิสต์รายนาที → แปลงเป็นลิสต์ 1 จุด
    const list: { time?: string; price?: number; diff?: string | number }[] = Array.isArray(d?.prices) ? d.prices : d?.prices && typeof d.prices === "object" ? [d.prices] : [];
    if (!list.length || !Array.isArray(d.tLabels)) return null;
    d.prices = list;
    // ฮั่งเส็ง/เกาหลีไม่มีช่อง open และ prices เป็น "ภาพนิ่ง" ของราคาล่าสุด — เดิมเอาภาพนิ่งนั้นมาเก็บเป็นราคาเปิด ได้ค่าที่ไม่ใช่ราคาเปิดเลย
    const open = d.open !== null && d.open !== undefined && Number.isFinite(Number(d.open)) ? Number(d.open) : null;
    const last = list[list.length - 1];
    const price = Number(last.price), diff = Number(last.diff);
    if (!Number.isFinite(price) || !Number.isFinite(diff)) return null;
    const endTime = String(d.tLabels[d.tLabels.length - 1]);
    const date = String(d.date);
    const m = vipMarket(market);
    const roundTimes = ("feedRoundTime" in m ? m.feedRoundTime : {}) as Record<number, string>;
    const rounds: VipRoundPrice[] = [];
    for (const [r, t] of Object.entries(roundTimes)) {
      // แถวสุดท้ายที่เวลา ≤ เวลาออกผลของรอบ (ฟีดบางนาทีหาย) — แต่ฟีดต้องเดินถึงเวลาออกผลแล้วจริง
      // (28 ก.ย. 69 นิเคอิรอบเช้า: ฟีดค้างที่ 11:04 ยังไม่มีแถว 11:05 → เดิมเอาแถว 11:04 มาบันทึกเป็นผล 613/41 ทั้งที่เว็บยังไม่ออกผล)
      if (String(last.time) < t) continue;
      const row = [...d.prices].reverse().find((x: { time: string }) => String(x.time) <= t);
      if (row && String(row.time) >= t.slice(0, 3) + "00") rounds.push({ round: Number(r), price: Number(row.price), diff: Number(row.diff), time: String(row.time) });
    }
    // ตลาดที่ฟีดไม่มีราคารายนาที (ฮั่งเส็ง/เกาหลี) ให้ช่อง results เป็นราคา ณ เวลาออกผลของรอบนั้น — ใช้เก็บราคาปิดได้ทั้งรอบเช้าและรอบบ่าย
    for (const [key, round] of [["r1", 1], ["r2", 2]] as const) {
      const rr = (d.results as Record<string, { price?: unknown; diff?: unknown } | null> | undefined)?.[key];
      if (!rr || rounds.some((x) => x.round === round)) continue;
      const p = Number(rr.price), f = Number(rr.diff);
      if (Number.isFinite(p) && Number.isFinite(f)) rounds.push({ round, price: p, diff: f, time: String(last.time) });
    }
    rounds.sort((a, b) => a.round - b.round);
    const feedDone = String(last.time) >= endTime;
    return { date, open, last: price, diff, rounds, lastTime: String(last.time), endTime, closed: feedDone || pastCloseThai(market, date), feedDone, updatedAt: String(d.dateUpdate ?? "") };
  } catch {
    return null;
  }
}

/** "429" จาก 969004.29 · "32" จาก −92.32 */
export const vipTop3 = (price: number) => { const c = Math.round(Math.abs(price) * 100); return String(c % 1000).padStart(3, "0"); };
export const vipBottom2 = (diff: number) => String(Math.round(Math.abs(diff) * 100) % 100).padStart(2, "0");
/** เลขที่ "ออก" ของงวด = เลขโดดใน 2 ตัวบน (2 หลักท้าย) + 2 ตัวล่าง — หลักร้อยไม่นับ */
export const vipDigits = (top: string, bottom: string) => [...new Set((top.slice(-2) + bottom).split(""))];
