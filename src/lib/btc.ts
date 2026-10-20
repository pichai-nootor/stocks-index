/**
 * BTC ฟิวเจอร์ (BTCUSDT perpetual, Binance) — วิเคราะห์ทิศทางภายในวันจากราคาของ BTC เอง (ผู้ใช้ขอ 17 ต.ค. 69)
 *
 * ทดสอบ 17 ต.ค. 69 กับแท่ง 1 ชม. 59,559 แท่ง (1 ม.ค. 2563 → 17 ต.ค. 2569) · ครึ่ง A = ถึง 26 พ.ค. 66 · B = หลังจากนั้น
 *   หักค่าธรรมเนียม taker ไป-กลับ 0.1% · สุ่ม/ถือ Long ทุก 12 ชม. = เฉลี่ย −0.02% / −0.04% ต่อไม้
 *   ▸ ทิศทางชั่วโมงถัดไป "ไม่มีตัวไหนได้เงินหลังหักค่าธรรมเนียม" (เฉลี่ย ±0.01% ต่อไม้ ขณะที่ค่าธรรมเนียม 0.1%):
 *     ตามแรง/สวนแรง 1–72 ชม., เหนือ/ใต้ EMA24/168, funding rate, ชั่วโมงของวัน, ขึ้นแรงแล้ว Short
 *     (สวนแรง 1–4 ชม. ถูก 52–54% แต่ได้น้อยเสียมาก เฉลี่ย ~0)
 *   ▸ ตัวเดียวที่ผ่านทั้งสองครึ่ง: **ลงแรงใน 24 ชม. → Long ถือ 12 ชม.** (ไม้ไม่ทับกัน) — ยิ่งลงแรงยิ่งดี และผ่านเกือบทุกช่วงเวลา/ระยะถือที่ลอง
 *       ลง ≥3%: A 540 ไม้ ถูก 54.4% เฉลี่ย +0.12% · B 322 ไม้ 54.3% +0.10%
 *       ลง ≥5%: A 259 ไม้ 52.9% +0.13% · B 96 ไม้ 65.6% +0.39%
 *       ลง ≥7%: A 131 ไม้ 61.1% +0.57% · B 34 ไม้ 67.6% +1.15%
 *   ตัวเลขบนหน้าจอคำนวณใหม่จากแท่งในฐานข้อมูลทุกครั้ง (ตรงกับข้างบน ณ วันที่ทดสอบ)
 */
import { prisma } from "@/lib/prisma";

const H = 3600000;
export const BTC = { look: 24, hold: 12, fee: 0.001, drops: [3, 5, 7] as const, defaultDrop: 5, since: "2026-10-17", limit: 0.01, wait: 2, through: 0.001 } as const;
export type BtcDrop = (typeof BTC.drops)[number];
export const isBtcDrop = (x: number): x is BtcDrop => (BTC.drops as readonly number[]).includes(x);
/** close = เข้าที่ราคาปิดแท่งที่ลงถึงเกณฑ์ · limit = ตั้ง limit buy ต่ำกว่าราคาปิดนั้น 1% รอ 2 ชม. ไม่ match = ข้ามไม้ */
export type BtcMode = "close" | "limit";

export type Bar = { t: number; o: number; h: number; l: number; c: number };

/** เติมแท่งที่ปิดแล้วจาก Binance ต่อจากแท่งล่าสุดในฐานข้อมูล (ครั้งแรกดึงตั้งแต่ 2563) · เน็ตล่ม → ใช้ของที่มี */
export async function syncBtc(): Promise<void> {
  try {
    const last = await prisma.btcBar.findFirst({ orderBy: { openTime: "desc" }, select: { openTime: true } });
    let t = last ? last.openTime.getTime() + H : Date.UTC(2020, 0, 1);
    for (let k = 0; k < 60 && t + H <= Date.now(); k++) {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=1500&startTime=${t}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!res.ok) return;
      const d = (await res.json()) as [number, string, string, string, string][];
      const now = Date.now();
      const closed = d.filter((x) => x[0] + H <= now);
      if (!closed.length) return;
      await prisma.btcBar.createMany({ data: closed.map((x) => ({ openTime: new Date(x[0]), open: +x[1], high: +x[2], low: +x[3], close: +x[4] })) });
      t = closed[closed.length - 1][0] + H;
      if (d.length < 1500) return;
    }
  } catch {
    // ซ้ำกับคำขออื่นที่เติมพร้อมกัน หรือเชื่อมต่อไม่ได้ — ครั้งหน้าเติมต่อ
  }
}

/** ราคาล่าสุด (แท่งที่ยังไม่ปิด) — ไม่ได้ → null */
export async function btcLivePrice(): Promise<number | null> {
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const p = Number(((await res.json()) as { price: string }).price);
    return Number.isFinite(p) ? p : null;
  } catch {
    return null;
  }
}

export type BtcSnapshot = { at: number; bidWall: { price: number; qty: number } | null; askWall: { price: number; qty: number } | null; mark: number; index: number; funding: number; nextFunding: number; bid: number; ask: number; bidDepth: number; askDepth: number; oi: number | null };

/** ข้อมูลสดประกอบ (ยังไม่ผ่านการทดสอบเป็นสัญญาณ) — funding, mark/index, order book ±0.5%, OI ตอนนี้ · ไม่ได้ → null */
export async function btcSnapshot(): Promise<BtcSnapshot | null> {
  try {
    const get = async <T,>(path: string) => {
      const res = await fetch(`https://fapi.binance.com/fapi/v1/${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(path);
      return (await res.json()) as T;
    };
    const [p, d, oi] = await Promise.all([
      get<{ markPrice: string; indexPrice: string; lastFundingRate: string; nextFundingTime: number; time: number }>("premiumIndex?symbol=BTCUSDT"),
      get<{ bids: [string, string][]; asks: [string, string][] }>("depth?symbol=BTCUSDT&limit=1000"),
      get<{ openInterest: string }>("openInterest?symbol=BTCUSDT").catch(() => null),
    ]);
    const bid = +d.bids[0][0], ask = +d.asks[0][0], m = (bid + ask) / 2;
    const sum = (xs: [string, string][], ok: (px: number) => boolean) => xs.reduce((a, [px, q]) => (ok(+px) ? a + +q : a), 0);
    // กำแพง = ช่วงราคา $100 ที่มีคำสั่งรอมากสุด (ไม่นับ ±0.1% ใกล้ราคาที่หนาตามปกติ)
    const wall = (xs: [string, string][], side: 1 | -1) => {
      const b = new Map<number, number>();
      for (const [px, q] of xs) { const p = +px; if (side * (p - m) < m * 0.001) continue; const k = Math.floor(p / 100) * 100; b.set(k, (b.get(k) ?? 0) + +q); }
      let best: { price: number; qty: number } | null = null;
      for (const [k, q] of b) if (!best || q > best.qty) best = { price: k + 50, qty: q };
      return best;
    };
    return {
      at: p.time, bidWall: wall(d.bids, -1), askWall: wall(d.asks, 1), mark: +p.markPrice, index: +p.indexPrice, funding: +p.lastFundingRate, nextFunding: p.nextFundingTime, bid, ask,
      bidDepth: sum(d.bids, (px) => px >= m * 0.995), askDepth: sum(d.asks, (px) => px <= m * 1.005), oi: oi ? +oi.openInterest : null,
    };
  } catch {
    return null;
  }
}

/** แท่ง 15 นาทีล่าสุด ~4 วัน (เฉพาะที่ปิดแล้ว) ดึงสดจาก Binance ทุกครั้ง ไม่เก็บลงฐานข้อมูล · ไม่ได้ → null */
export async function btc15Live(): Promise<Bar[] | null> {
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=400", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const d = (await res.json()) as [number, string, string, string, string][];
    const now = Date.now();
    const bars = d.filter((x) => x[0] + 15 * 60000 <= now).map((x) => ({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] }));
    return bars.length >= 300 ? bars : null;
  } catch {
    return null;
  }
}

export async function btcBars(): Promise<Bar[]> {
  const rows = await prisma.btcBar.findMany({ orderBy: { openTime: "asc" } });
  return rows.map((r) => ({ t: r.openTime.getTime(), o: r.open, h: r.high, l: r.low, c: r.close }));
}

/** เปลี่ยนแปลง 24 ชม. ณ ปิดแท่ง i */
export const change24 = (bars: Bar[], i: number) => (i >= BTC.look ? bars[i].c / bars[i - BTC.look].c - 1 : 0);

export type BtcTrade = { entryAt: number; exitAt: number; entry: number; exit: number | null; drop24: number; ret: number | null; worst: number };

/** limit ที่ยังรอ match (สัญญาณเกิดแล้ว ยังไม่ครบ 2 ชม.) */
export type BtcPending = { signalAt: number; price: number; cancelAt: number; drop24: number };

/**
 * ไม้ทั้งหมดของเกณฑ์ drop%: ปิดแท่งที่ลง 24 ชม. ≥ drop% → Long ถือ 12 ชม. ออกที่ราคาปิด · ระหว่างถือไม่เปิดไม้ใหม่
 *   close: เข้าที่ราคาปิดแท่งนั้น
 *   limit: ตั้งซื้อที่ราคาปิด −1% ภายใน 2 แท่งถัดไป · นับว่า match เมื่อราคาต่ำสุดลงทะลุ limit อีก 0.1% (กันกรณีแตะแล้วไม่ได้คิว)
 *          match = เข้าที่ราคา limit ถือ 12 ชม. นับจากปิดแท่งที่ match · ไม่ match = ข้าม แล้วหาสัญญาณใหม่หลังหมดเวลารอ
 *   ret = กำไรหลังหักค่าธรรมเนียม (สัดส่วนของราคา ไม่คูณเลเวอเรจ) · worst = ราคาต่ำสุดระหว่างถือเทียบราคาเข้า
 *   ทดสอบ 17 ต.ค. 69 (ครึ่ง A / B · เฉลี่ยต่อไม้ · รวม) — limit "ไม่ชนะชัด" จึงไม่ใช่ค่าเริ่มต้น:
 *     แท่ง 1 ชม. (แบบในหน้านี้): −3% close +0.13/+0.10 รวม 69/33% · limit +0.05/+0.14 รวม 14/16%
 *                               −5% close +0.13/+0.39 รวม 33/38% · limit −0.01/+0.55 รวม −2/25%
 *                               −7% close +0.57/+1.15 รวม 74/39% · limit +0.66/+1.55 รวม 58/33%
 *     แท่ง 15 นาที (สัญญาณเช็กทุก 15 นาที) limit ดีกว่าต่อไม้ทั้งสองครึ่ง — ผลเปลี่ยนตามวิธีวัด = ยังเชื่อไม่ได้
 */
export function btcTrades(bars: Bar[], drop: number, mode: BtcMode = "close"): { trades: BtcTrade[]; pending: BtcPending | null } {
  const out: BtcTrade[] = [];
  let pending: BtcPending | null = null;
  let i: number = BTC.look;
  while (i < bars.length) {
    const r = change24(bars, i);
    if (r > -drop / 100) { i++; continue; }
    let f = i, entry = bars[i].c;
    if (mode === "limit") {
      const p = bars[i].c * (1 - BTC.limit);
      f = -1;
      for (let k = i + 1; k <= Math.min(i + BTC.wait, bars.length - 1); k++) if (bars[k].l <= p * (1 - BTC.through)) { f = k; break; }
      if (f < 0) {
        if (i + BTC.wait >= bars.length) pending = { signalAt: bars[i].t + H, price: p, cancelAt: bars[i].t + H + BTC.wait * H, drop24: r };
        i += BTC.wait + 1;
        continue;
      }
      entry = p;
    }
    const j = f + BTC.hold, done = j < bars.length;
    let low = entry;
    for (let k = mode === "limit" ? f : f + 1; k <= Math.min(j, bars.length - 1); k++) low = Math.min(low, bars[k].l);
    const exit = done ? bars[j].c : null;
    out.push({ entryAt: bars[f].t + H, exitAt: bars[f].t + H + BTC.hold * H, entry, exit, drop24: r, ret: exit === null ? null : exit / entry - 1 - BTC.fee, worst: low / entry - 1 });
    i = j;
  }
  return { trades: out, pending };
}

/**
 * จุดเข้าตามราคา (ทดสอบ 17 ต.ค. 69 · แท่ง 1 ชม. ม.ค. 63 → ต.ค. 69 แบ่ง 3 ช่วง · หักค่าธรรมเนียม 0.1%):
 *   ตั้ง limit buy ต่ำกว่าจุดต่ำสุด 24 ชม. k% ไว้ตลอด (คำนวณใหม่ทุกแท่ง · คำสั่งใช้ได้ 1 ชม.) → match = Long ถือ 1 ชม. แล้วปล่อย
 *   แท่ง 1 ชม. ถือ 1 ชม.: k 2% +0.51 / +0.12 / +0.49% ต่อไม้ · k 2.5% +0.62 / +0.48 / +1.07% · k 3% +0.97 / +0.68 / +2.18% (ถือ 4/12 ชม. ก็บวกทุกช่วง)
 *   แท่ง 15 นาที (ผู้ใช้อยากถือสั้น ๆ): ถือ 15 นาทีอ่อน (ช่วงแรกติดลบ) · ถือ 30–60 นาทีบวกทุกช่วง · ตั้ง TP +0.5/1/1.5% ได้น้อยกว่าถือครบ 1 ชม.
 *     (ตัดไม้ที่เด้งแรงทิ้ง) · ผู้ใช้ขอจุด stop → ตาราง 15 นาที (k 2.5%, หลังผ่าน EMA 200 วัน): ไม่มี stop +1.43/+0.57/+1.85%
 *     SL 3% +1.09/+0.35/+1.55% (เสียน้อยสุดในบรรดา SL ที่ไม่ทำให้ขาดทุน) · SL 1–2% ถูกน้อยลงมาก · SL 5% ไม่ได้ช่วยอะไร
 *     TP +1% ร่วมกับ SL = ขาดทุน · TP +3% + SL 3% บวกทุกช่วงแต่น้อยกว่าไม่ตั้ง TP → ใช้ SL 3% + ปิดเมื่อครบ 1 ชม. ไม่ตั้ง TP
 *   Short ฝั่งตรงข้าม แม้กรองเฉพาะขาลง (ใต้ EMA 200 วัน / 50 วัน < 200 วัน) ทุก TP/SL ยังขาดทุน
 *   Short ฝั่งตรงข้าม (สูงกว่าจุดสูงสุด 24 ชม. 2–3%) ไม่ผ่าน — ขาดทุนเกือบทุกช่วง จึงไม่มีจุดเข้า S
 *   ราคาเคยลงต่อหลังเข้าลึกสุด ~−28% (มี.ค. 63) → เลเวอเรจสูงโดนล้างพอร์ต
 */
export const RANGE = { levels: [2, 2.5, 3] as const, defaultLevel: 2.5, hold: 1, stop: 0.03 } as const;
export type RangeLevel = (typeof RANGE.levels)[number];
export const isRangeLevel = (x: number): x is RangeLevel => (RANGE.levels as readonly number[]).includes(x);
const low24 = (bars: Bar[], i: number) => { let m = Infinity; for (let k = i - BTC.look + 1; k <= i; k++) m = Math.min(m, bars[k].l); return m; };

/** ไม้ทั้งหมดของจุดเข้า "ต่ำกว่าจุดต่ำสุด 24 ชม. k%" + ราคาที่ต้องตั้งตอนนี้ (ใช้ได้ถึงปิดแท่งถัดไป) */
export function btcRangeTrades(bars: Bar[], k: number): { trades: BtcTrade[]; next: { price: number; stop: number; low: number; until: number } } {
  const out: BtcTrade[] = [];
  let i: number = BTC.look;
  while (i + 1 < bars.length) {
    const lv = low24(bars, i) * (1 - k / 100), j = i + 1;
    if (bars[j].l > lv * (1 - BTC.through)) { i++; continue; }
    const x = j + RANGE.hold, done = x < bars.length, stop = lv * (1 - RANGE.stop);
    let low = lv;
    for (let q = j; q <= Math.min(x, bars.length - 1); q++) low = Math.min(low, bars[q].l);
    // stop: นับเฉพาะแท่งหลังแท่งที่ match (ในแท่งเดียวกันไม่รู้ลำดับราคา) · โดน stop = ออกที่ราคา stop
    let hit = false;
    for (let q = j + 1; q <= Math.min(x, bars.length - 1); q++) if (bars[q].l <= stop) { hit = true; break; }
    const exit = hit ? stop : done ? bars[x].c : null;
    out.push({ entryAt: bars[j].t + H, exitAt: bars[j].t + H + RANGE.hold * H, entry: lv, exit, drop24: lv / bars[j - BTC.look].c - 1, ret: exit === null ? null : exit / lv - 1 - BTC.fee, worst: low / lv - 1 });
    i = x;
  }
  const last = bars.length - 1, lo = low24(bars, last);
  const price = lo * (1 - k / 100);
  return { trades: out, next: { price, stop: price * (1 - RANGE.stop), low: lo, until: bars[last].t + 2 * H } };
}

export type BtcStats = { n: number; hit: number; avg: number; total: number; worst: number; maxLossStreak: number };
export function btcStats(trades: BtcTrade[]): BtcStats {
  const done = trades.filter((t) => t.ret !== null);
  let streak = 0, maxLossStreak = 0;
  for (const t of done) { streak = t.ret! > 0 ? 0 : streak + 1; maxLossStreak = Math.max(maxLossStreak, streak); }
  const total = done.reduce((s, t) => s + t.ret!, 0);
  return { n: done.length, hit: done.length ? done.filter((t) => t.ret! > 0).length / done.length : 0, avg: done.length ? total / done.length : 0, total, worst: done.reduce((m, t) => Math.min(m, t.worst), 0), maxLossStreak };
}

/** ฐานเทียบ: Long ทุก 12 ชม. โดยไม่ดูอะไรเลย (หักค่าธรรมเนียมเท่ากัน) */
export function btcBaseline(bars: Bar[], from: number, to: number): { n: number; hit: number; avg: number } {
  const r: number[] = [];
  for (let i = Math.max(from, 0); i + BTC.hold < Math.min(to, bars.length); i += BTC.hold) r.push(bars[i + BTC.hold].c / bars[i].c - 1 - BTC.fee);
  return { n: r.length, hit: r.length ? r.filter((x) => x > 0).length / r.length : 0, avg: r.length ? r.reduce((s, x) => s + x, 0) / r.length : 0 };
}

/** ล็อกไม้ตั้งแต่วันเปิดเมนู (ผลจริง) + เติมราคาออกเมื่อครบ 12 ชม. — ไม่เขียนทับราคาเข้า */
export async function lockBtcSignals(userId: string, trades: BtcTrade[], drop: number, mode: BtcMode | "range"): Promise<void> {
  const since = Date.parse(`${BTC.since}T00:00:00+07:00`);
  for (const t of trades) {
    if (t.entryAt < since) continue;
    const key = { userId_drop_mode_entryAt: { userId, drop, mode, entryAt: new Date(t.entryAt) } };
    await prisma.btcSignal.upsert({ where: key, create: { userId, drop, mode, entryAt: new Date(t.entryAt), entry: t.entry, exitAt: new Date(t.exitAt), exit: t.exit }, update: t.exit === null ? {} : { exit: t.exit } });
  }
}

type FlowRow = { time: number; oi?: number; oiValue?: number; lsAccount?: number; lsTop?: number; takerRatio?: number };

/**
 * เก็บ OI / long-short ratio / taker buy-sell รายชั่วโมงสะสมลง BtcFlow — Binance ให้ย้อนหลังแค่ 30 วัน
 *   เรียกทุกครั้งที่เปิดหน้า: ขอเปิดหน้า /btc อย่างน้อยเดือนละครั้ง ข้อมูลจะต่อเนื่อง · ดึงย้อน 2 ชม. ทุกครั้งเผื่อแถวที่ Binance ยังไม่ครบ
 */
export async function syncBtcFlow(): Promise<void> {
  try {
    const [first, last] = await Promise.all([
      prisma.btcFlow.findFirst({ orderBy: { time: "asc" }, select: { time: true } }),
      prisma.btcFlow.findFirst({ orderBy: { time: "desc" }, select: { time: true } }),
    ]);
    const oldest = Date.now() - 29 * 24 * H;
    // ยังเก็บไม่ถึงต้นช่วงที่ Binance มี → ดึงใหม่ตั้งแต่ต้น · ไม่งั้นต่อจากแถวล่าสุด
    const from = !first || !last || first.time.getTime() > oldest + 24 * H ? oldest : Math.max(last.time.getTime() - 2 * H, oldest);
    const rows = new Map<number, FlowRow>();
    const get = async (path: string, put: (row: FlowRow, x: Record<string, string | number>) => void) => {
      for (let t = from, k = 0; t <= Date.now() && k < 3; k++) {
        const res = await fetch(`https://fapi.binance.com/futures/data/${path}?symbol=BTCUSDT&period=1h&limit=500&startTime=${t}&endTime=${t + 499 * H}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (!res.ok) return;
        const d = (await res.json()) as Record<string, string | number>[];
        for (const x of d) {
          const time = Number(x.timestamp);
          const row = rows.get(time) ?? { time };
          put(row, x);
          rows.set(time, row);
        }
        t += 500 * H; // ใส่แค่ startTime Binance จะส่ง 500 แถวล่าสุดมาแทน
      }
    };
    await Promise.all([
      get("openInterestHist", (r, x) => { r.oi = +x.sumOpenInterest; r.oiValue = +x.sumOpenInterestValue; }),
      get("globalLongShortAccountRatio", (r, x) => { r.lsAccount = +x.longShortRatio; }),
      get("topLongShortPositionRatio", (r, x) => { r.lsTop = +x.longShortRatio; }),
      get("takerlongshortRatio", (r, x) => { r.takerRatio = +x.buySellRatio; }),
    ]);
    await prisma.$transaction([...rows.values()].map(({ time, ...v }) => prisma.btcFlow.upsert({ where: { time: new Date(time) }, create: { time: new Date(time), ...v }, update: v })));
  } catch {
    // เชื่อมต่อไม่ได้ — ครั้งหน้าเติมต่อ (ย้อนได้ถึง 30 วัน)
  }
}

export async function btcFlowSummary(): Promise<{ n: number; first: number | null; last: FlowRow | null; oi24: number | null }> {
  const [n, first, last] = await Promise.all([
    prisma.btcFlow.count(),
    prisma.btcFlow.findFirst({ orderBy: { time: "asc" }, select: { time: true } }),
    prisma.btcFlow.findFirst({ where: { oi: { not: null }, lsAccount: { not: null }, takerRatio: { not: null } }, orderBy: { time: "desc" } }),
  ]);
  const prev = last && (await prisma.btcFlow.findFirst({ where: { time: { lte: new Date(last.time.getTime() - 24 * H) }, oi: { not: null } }, orderBy: { time: "desc" }, select: { oi: true } }));
  return {
    n,
    oi24: last?.oi && prev?.oi ? last.oi / prev.oi - 1 : null,
    first: first?.time.getTime() ?? null,
    last: last && { time: last.time.getTime(), oi: last.oi ?? undefined, oiValue: last.oiValue ?? undefined, lsAccount: last.lsAccount ?? undefined, lsTop: last.lsTop ?? undefined, takerRatio: last.takerRatio ?? undefined },
  };
}

export type Zone = { price: number; kind: "supply" | "demand"; from: "กราฟ" | "กรอบ 24 ชม." | "order book"; note: string };
export type LiveRead = {
  price: number; high: number; low: number; pos: number; ch15: number | null; ch1: number; ch4: number; ch24: number; vol1: number; per: number; stop: number; hold: number; swing: { med: number; p75: number };
  supply: Zone[]; demand: Zone[]; facts: string[];
};

/**
 * วิเคราะห์ ณ ตอนนี้จากข้อมูลที่ดึงมา (ผู้ใช้ขอ 17 ต.ค. 69 · ไม่ใช้สถิติย้อนหลัง) — Demand/Supply + สภาพตลาด
 *   โซนจากกราฟ = จุดกลับตัวแท่ง 1 ชม. ใน 72 ชม. (high/low สูง/ต่ำกว่า 3 แท่งซ้ายขวา) · กรอบ 24 ชม. · กำแพง order book
 *   เป็นการอ่านสภาพ ไม่ได้ทดสอบว่าได้เปรียบ (ต่างจากจุดเข้า Long ใต้จุดต่ำสุด 24 ชม. ที่ทดสอบแล้ว)
 */
export function btcLiveRead(bars: Bar[], price: number, snap: BtcSnapshot | null, flow: { last: FlowRow | null; oi24: number | null }, per = 1): LiveRead {
  // per = จำนวนแท่งต่อชั่วโมง (1 = แท่ง 1 ชม. · 4 = แท่ง 15 นาที) · จุดกลับตัว = สูง/ต่ำสุดในช่วง ±1 ชม. (อย่างน้อย ±3 แท่ง)
  //   15 นาที (เล่นสั้น): จุดกลับตัวแค่ 24 ชม. ล่าสุด · SL เลยโซน max(0.3%, 2 × แกว่งเฉลี่ยต่อแท่ง) · ไม่ถึง TP/SL ปิดใน 2 ชม. (ผู้ใช้: BTC ฟิวเจอร์ควรเห็นผลใน 1–2 ชม. ไม่เข้าเป้าให้ stop ออก)
  const last = bars.length - 1, look = BTC.look * per, side = Math.max(3, per);
  let high = -Infinity, low = Infinity, vol = 0;
  for (let k = last - look + 1; k <= last; k++) { high = Math.max(high, bars[k].h); low = Math.min(low, bars[k].l); vol += (bars[k].h - bars[k].l) / bars[k].c; }
  const zones: Zone[] = [];
  for (let i = Math.max(side, last - (per === 4 ? 24 : 72) * per); i <= last - side; i++) {
    const w = bars.slice(i - side, i + side + 1);
    if (w.every((b) => b.h <= bars[i].h)) zones.push({ price: bars[i].h, kind: "supply", from: "กราฟ", note: `ยอดที่ราคาถูกขายลง (${new Date(bars[i].t).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` });
    if (w.every((b) => b.l >= bars[i].l)) zones.push({ price: bars[i].l, kind: "demand", from: "กราฟ", note: `ก้นที่มีแรงซื้อเด้ง (${new Date(bars[i].t).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` });
  }
  zones.push({ price: high, kind: "supply", from: "กรอบ 24 ชม.", note: "จุดสูงสุด 24 ชม." }, { price: low, kind: "demand", from: "กรอบ 24 ชม.", note: "จุดต่ำสุด 24 ชม." });
  if (snap?.askWall) zones.push({ price: snap.askWall.price, kind: "supply", from: "order book", note: `คำสั่งรอขายหนา ${snap.askWall.qty.toFixed(0)} BTC` });
  if (snap?.bidWall) zones.push({ price: snap.bidWall.price, kind: "demand", from: "order book", note: `คำสั่งรอซื้อหนา ${snap.bidWall.qty.toFixed(0)} BTC` });
  // ใกล้กันไม่เกิน 0.15% = โซนเดียวกัน (เก็บตัวแรกที่ใกล้ราคามากสุด)
  const pick = (xs: Zone[]) => xs.reduce<Zone[]>((a, z) => (a.some((y) => Math.abs(y.price / z.price - 1) < 0.0015) ? a : [...a, z]), []).slice(0, 3);
  // โซนที่กลับบทบาท: ก้นเดิมที่หลุดลงมาแล้ว = แนวต้าน · ยอดเดิมที่ทะลุขึ้นไปแล้ว = แนวรับ
  const flip = (z: Zone, kind: Zone["kind"]): Zone => (z.kind === kind ? z : { ...z, kind, note: z.note.replace(/^ก้นที่มีแรงซื้อเด้ง/, "ก้นเดิมที่หลุดลงมา → แนวต้าน").replace(/^ยอดที่ราคาถูกขายลง/, "ยอดเดิมที่ทะลุขึ้นไป → แนวรับ") });
  const supply = pick(zones.filter((z) => z.price > price * 1.0005).sort((a, b) => a.price - b.price)).map((z) => flip(z, "supply"));
  const demand = pick(zones.filter((z) => z.price < price * 0.9995).sort((a, b) => b.price - a.price)).map((z) => flip(z, "demand"));

  const ch = (hours: number) => price / bars[last - hours * per + 1].c - 1;
  // ราคาแกว่งได้แค่ไหนในเวลาที่ถือ: กว้าง (สูงสุด−ต่ำสุด) ของทุกช่วงยาวเท่าเวลาถือ ใน 24 ชม. ล่าสุด → มัธยฐาน / เปอร์เซ็นไทล์ 75
  const hold = per === 4 ? 2 : ZONE.maxHold, win = hold * per, widths: number[] = [];
  for (let i = Math.max(0, last - look + 1); i + win - 1 <= last; i++) {
    let h = -Infinity, l = Infinity;
    for (let k = i; k < i + win; k++) { h = Math.max(h, bars[k].h); l = Math.min(l, bars[k].l); }
    widths.push(h / l - 1);
  }
  widths.sort((a, b) => a - b);
  const swing = { med: widths[Math.floor(widths.length / 2)] ?? 0, p75: widths[Math.floor(widths.length * 0.75)] ?? 0 };
  const facts: string[] = [];
  const pos = high > low ? (price - low) / (high - low) : 0.5;
  facts.push(`ราคาอยู่ ${(pos * 100).toFixed(0)}% ของกรอบ 24 ชม. — ${pos > 0.8 ? "ใกล้ขอบบน (ใกล้ supply)" : pos < 0.2 ? "ใกล้ขอบล่าง (ใกล้ demand)" : "กลางกรอบ ยังไม่ถึงโซนไหน"}`);
  if (snap) {
    const imb = snap.bidDepth / (snap.bidDepth + snap.askDepth);
    facts.push(`Order book ±0.5%: ฝั่งซื้อ ${(imb * 100).toFixed(0)}% / ขาย ${(100 - imb * 100).toFixed(0)}% — ${imb > 0.6 ? "ฝั่งรอซื้อหนากว่า" : imb < 0.4 ? "ฝั่งรอขายหนากว่า" : "พอ ๆ กัน"} (เปลี่ยนเร็ว ใช้ดูขณะนั้น)`);
    facts.push(`Funding ${(snap.funding * 100).toFixed(4)}% — ${snap.funding > 0.0003 ? "Long จ่ายแพง คน Long แน่น" : snap.funding < 0 ? "Short จ่าย คน Short แน่น" : "ปกติ"}`);
  }
  if (flow.last?.lsAccount) facts.push(`บัญชี Long ต่อ Short ${flow.last.lsAccount.toFixed(2)} เท่า — ${flow.last.lsAccount > 2 ? "รายย่อย Long แน่นมาก" : flow.last.lsAccount < 1 ? "รายย่อย Short มากกว่า" : "Long มากกว่าเล็กน้อย–ปานกลาง"}`);
  if (flow.last?.takerRatio) facts.push(`Taker ซื้อ/ขาย ชั่วโมงล่าสุด ${flow.last.takerRatio.toFixed(2)} — ${flow.last.takerRatio > 1.1 ? "คนกดซื้อ market มากกว่า" : flow.last.takerRatio < 0.9 ? "คนกดขาย market มากกว่า" : "พอ ๆ กัน"}`);
  if (flow.oi24 !== null) facts.push(`Open Interest 24 ชม. ${flow.oi24 >= 0 ? "+" : "−"}${Math.abs(flow.oi24 * 100).toFixed(1)}% — ${Math.abs(flow.oi24) < 0.02 ? "สถานะเปิดใหม่ไม่ค่อยเปลี่ยน" : flow.oi24 > 0 ? "มีสถานะเปิดใหม่เพิ่ม" : "มีการปิดสถานะ"}`);
  facts.unshift(`ช่วง ${hold} ชม. ราคามักแกว่งกว้าง ~${(swing.med * 100).toFixed(2)}% (แกว่งแรงหน่อย ~${(swing.p75 * 100).toFixed(2)}%) — ${swing.med < 0.006 ? "ตลาดค่อนข้างนิ่ง เป้าไกลอาจไม่ถึง" : "ตลาดแกว่งพอสมควร"}`);
  return { price, high, low, pos, ch15: per === 4 ? price / bars[last].c - 1 : null, ch1: ch(1), ch4: ch(4), ch24: ch(24), vol1: (vol / look) * per, per, stop: Math.max(ZONE.minStop, (vol / look) * (per === 4 ? 2 : 1)), hold, swing, supply, demand, facts };
}

/**
 * แผนตามโซน ณ ตอนนี้ (ผู้ใช้ต้องการอ่านสภาพปัจจุบัน ไม่ใช่สถิติ):
 *   Short ที่ supply ใกล้สุด · Long ที่ demand ใกล้สุด · SL เลยโซน read.stop (ดู btcLiveRead)
 *   TP = โซนฝั่งตรงข้ามตัวแรกที่ไกลกว่า SL ≥ 2 เท่า (R:R ≥ 2) · ไม่มี = ใช้โซนไกลสุดที่มี และแสดง R:R ให้เห็น
 *   ย้อนดู 17 ต.ค. 69: TP = โซนใกล้สุด (R:R < 1) เสีย 5 ใน 6 ไม้ใน 24 ชม. จึงบังคับ R:R ≥ 2
 */
export const ZONE = { minStop: 0.003, minRR: 2, maxHold: 12 } as const;
export type ZonePlan = { side: "S" | "L"; entry: number; tp: number; sl: number; rr: number; ok: boolean; next: number | null; reach: "ปกติ" | "ต้องแกว่งแรง" | "ไกลเกิน"; why: string };
/**
 * ระบบเลือกเอง: ไล่โซนจากใกล้ไปไกล · เป้า TP ต้อง R:R ≥ 2 และไม่ไกลกว่าที่ราคามักแกว่งในเวลาถือ (≤ เปอร์เซ็นไทล์ 75)
 *   ผู้ใช้ 17 ต.ค. 69: ตลาดนิ่ง เป้าไกลอาจไม่ถึงใน 1–2 ชม. → เข้าเฉพาะเป้าที่ถึงได้ · ไม่มีเลย = แผนโซนใกล้สุด ok = false (รอ) พร้อมเหตุผล
 */
export function zonePlans(read: Pick<LiveRead, "supply" | "demand" | "stop" | "swing" | "hold">): ZonePlan[] {
  const gap = read.stop, out: ZonePlan[] = [];
  const reachOf = (d: number): ZonePlan["reach"] => (d <= read.swing.med ? "ปกติ" : d <= read.swing.p75 ? "ต้องแกว่งแรง" : "ไกลเกิน");
  for (const [side, zones, targets] of [["S", read.supply, read.demand], ["L", read.demand, read.supply]] as const) {
    let first: ZonePlan | null = null, chosen: ZonePlan | null = null;
    for (let k = 0; k < zones.length && !chosen; k++) {
      const entry = zones[k].price, sl = side === "S" ? entry * (1 + gap) : entry * (1 - gap);
      const far = targets.filter((z) => (side === "S" ? z.price < entry : z.price > entry)).sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));
      if (!far.length) continue;
      const dist = (z: Zone) => Math.abs(z.price / entry - 1);
      const good = far.find((z) => dist(z) >= ZONE.minRR * gap && dist(z) <= read.swing.p75);
      const t = good ?? far.find((z) => dist(z) >= ZONE.minRR * gap) ?? far[far.length - 1];
      const d = dist(t), rr = d / gap, reach = reachOf(d);
      const why = good ? "" : rr < ZONE.minRR ? `เป้าใกล้เกิน R:R แค่ 1 : ${rr.toFixed(1)} (ต้อง ≥ 1 : ${ZONE.minRR})` : `เป้า ${(d * 100).toFixed(2)}% ไกลกว่าที่ราคามักแกว่งใน ${read.hold} ชม. (~${(read.swing.med * 100).toFixed(2)}%) — ตลาดนิ่ง รอให้ราคาขยับ`;
      const p: ZonePlan = { side, entry, sl, tp: t.price, rr, ok: !!good, next: zones[k + 1]?.price ?? null, reach, why };
      first ??= p;
      if (good) chosen = p;
    }
    if (chosen ?? first) out.push((chosen ?? first)!);
  }
  return out;
}

export type SlotSide = { ok: boolean; entry: number; tp: number; sl: number; why: string; filled: boolean; outcome: "TP" | "SL" | "หมดเวลา" | "ถืออยู่" | null; ret: number | null };
export type SlotRow = { t: number; price: number; S: SlotSide | null; L: SlotSide | null };

/**
 * ทุกแท่ง 15 นาทีใน 24 ชม. (ผู้ใช้ขอ 17 ต.ค. 69): ณ ปิดแท่งนั้นระบบให้ S/L ที่ไหน (กติกาเดียวกับ zonePlans · ไม่มี order book ย้อนหลัง)
 *   แต่ละแถวคิดแยกกัน "ถ้าตั้งตามแถวนี้": limit ใช้ได้ 1 แท่งถัดไป · แตะ = เข้า · SL ก่อน TP ถ้าแท่งเดียวกันโดนทั้งคู่
 *   ไม่ถึงทั้งคู่ใน read.hold ชม. = ปิดที่ราคาปิด · ret หักค่าธรรมเนียม 0.1% ไม่คูณเลเวอเรจ
 */
export function zoneTimeline(bars15: Bar[], hours = 24): SlotRow[] {
  const out: SlotRow[] = [], last = bars15.length - 1;
  for (let i = last - hours * 4 + 1; i <= last; i++) {
    const read = btcLiveRead(bars15.slice(0, i + 1), bars15[i].c, null, { last: null, oi24: null }, 4);
    const row: SlotRow = { t: bars15[i].t + 15 * 60000, price: bars15[i].c, S: null, L: null };
    for (const p of zonePlans(read)) {
      const side: SlotSide = { ok: p.ok, entry: p.entry, tp: p.tp, sl: p.sl, why: p.why, filled: false, outcome: null, ret: null };
      const j = i + 1;
      if (p.ok && j <= last && (p.side === "S" ? bars15[j].h >= p.entry : bars15[j].l <= p.entry)) {
        side.filled = true;
        side.outcome = "ถืออยู่";
        let exit: number | null = null;
        const end = j + read.hold * 4;
        for (let k = j + 1; k <= Math.min(end, last); k++) {
          const b = bars15[k];
          if (p.side === "S" ? b.h >= p.sl : b.l <= p.sl) { exit = p.sl; side.outcome = "SL"; break; }
          if (p.side === "S" ? b.l <= p.tp : b.h >= p.tp) { exit = p.tp; side.outcome = "TP"; break; }
        }
        if (exit === null && end <= last) { exit = bars15[end].c; side.outcome = "หมดเวลา"; }
        if (exit !== null) side.ret = (p.side === "S" ? p.entry / exit - 1 : exit / p.entry - 1) - BTC.fee;
      }
      row[p.side] = side;
    }
    out.push(row);
  }
  return out.reverse();
}
