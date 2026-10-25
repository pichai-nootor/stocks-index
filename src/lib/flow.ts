/**
 * เลขไหลของวัน (หุ้นปกติ · ผู้ใช้ขอ 22 ต.ค. 69) — เลขโดดที่ออกซ้ำหลายรอบในวันเดียวกัน นิเช้า → ดาวโจนส์
 *   ณ รอบใดก็ตาม: นับว่าแต่ละเลขออกมาแล้วกี่รอบ → 2 ตัวที่ไหลมากสุด = เลขไหลสำหรับรอบที่ยังไม่ออก (ใช้ได้ทุกหุ้น)
 *   เสมอกัน: ออกรวมหลายหลักกว่า (เช่น 43/34 นับ 2) → ออกล่าสุดกว่า (ไหลยังไม่ขาด)
 *   ทดสอบย้อนหลัง (IndexDay) ก่อนทำเมนู: ฟัน 2 ตัวด้วยเลขไหล ≈ 57–62% เทียบสุ่ม 59% — เมนูนี้เป็นเครื่องมือดู + เก็บผลจริง ไม่ได้อยู่ในสูตรฟัน
 */
import { nikkeiSession } from "@/lib/stocks/nikkei";
import { chinaSession } from "@/lib/stocks/china";
import { hangSengSession } from "@/lib/stocks/hangseng";
import { stockFormulaId } from "@/lib/formulas/stocks";
import { top2, bottom2 } from "@/lib/digits";

const G = "0123456789".split("");

/** รอบของวันเรียงตามเวลาผลออก (เวลาไทย) · key = คีย์ IndexDay ของรอบเดียวกัน (ใช้ทดสอบย้อนหลัง) */
export const FLOW_ROUNDS = [
  { slot: "nk-am", key: "nk-am", time: "09:30", label: "นิเคอิเช้า" },
  { slot: "cn-am", key: "cn-am", time: "10:30", label: "จีนเช้า" },
  { slot: "hk-am", key: "hk-am", time: "11:00", label: "ฮั่งเส็งเช้า" },
  { slot: "tw", key: "tw", time: "12:30", label: "ไต้หวัน" },
  { slot: "nk-pm", key: "nk-pm", time: "13:30", label: "นิเคอิบ่าย" },
  { slot: "cn-pm", key: "cn-pm", time: "14:00", label: "จีนบ่าย" },
  { slot: "hk-pm", key: "hk-pm16", time: "15:00", label: "ฮั่งเส็งบ่าย" },
  { slot: "sg", key: "sg", time: "16:00", label: "สิงคโปร์" },
  { slot: "sx", key: "sx", time: "17:00", label: "อินเดีย" },
  { slot: "eg", key: "eg", time: "18:30", label: "อียิปต์" },
  { slot: "dj", key: "dj", time: "03:05", label: "ดาวโจนส์" },
] as const;
export type FlowSlot = (typeof FLOW_ROUNDS)[number]["slot"];

/** หุ้นของผู้ใช้ → รอบในตาราง (null = ไม่ใช่หุ้นปกติที่รู้จัก) */
export function flowSlotOf(symbol: string): FlowSlot | null {
  const nk = nikkeiSession(symbol), cn = chinaSession(symbol), hk = hangSengSession(symbol);
  if (nk) return nk === "am" ? "nk-am" : "nk-pm";
  if (cn) return cn === "am" ? "cn-am" : "cn-pm";
  if (hk) return hk === "am" ? "hk-am" : "hk-pm";
  return ({ taiwan: "tw", singapore: "sg", sensex: "sx", egypt: "eg", dowjones: "dj" } as const)[stockFormulaId(symbol) as "taiwan"] ?? null;
}

/** ผลของรอบหนึ่ง: บน 2 ตัว + ล่าง 2 ตัว */
export type FlowResult = { slot: FlowSlot; top: string; bottom: string };
export const resultOf = (slot: FlowSlot, close: number, change: number): FlowResult => ({ slot, top: top2(close), bottom: bottom2(change) });

export type DigitFlow = { d: string; rounds: number; total: number; last: number };
/** นับเลขที่ออกแล้วในรอบที่ส่งมา (เรียงตามเวลาแล้ว) */
export function countFlow(done: FlowResult[]): DigitFlow[] {
  return G.map((d) => {
    let rounds = 0, total = 0, last = -1;
    done.forEach((r, i) => { const n = (r.top + r.bottom).split(d).length - 1; if (n) { rounds++; total += n; last = i; } });
    return { d, rounds, total, last };
  });
}
/** 2 ตัวไหลมากสุด · เสมอ → ออกรวมหลายหลักกว่า → ออกล่าสุดกว่า */
export const flowTwo = (done: FlowResult[]): DigitFlow[] =>
  done.length < 2 ? [] : countFlow(done).sort((a, b) => b.rounds - a.rounds || b.total - a.total || b.last - a.last).slice(0, 2);
export const hitsAny = (r: FlowResult, ds: string[]) => ds.some((d) => (r.top + r.bottom).includes(d));

/** ไล่ทั้งวัน: แต่ละรอบ (ตั้งแต่รอบที่ 3) ใช้เลขไหลจากรอบก่อนหน้า แล้วดูว่าเข้าไหม */
export function walkDay(day: FlowResult[]) {
  return day.map((r, i) => { const two = flowTwo(day.slice(0, i)).map((x) => x.d); return { r, two, hit: two.length ? hitsAny(r, two) : null }; });
}

/** ทดสอบย้อนหลัง: วัน → ผลแต่ละรอบ (เรียงตามเวลาแล้ว) · strong = เลขไหลตัวแรกออกมาแล้ว ≥3 รอบ */
export function backtest(days: FlowResult[][]) {
  const all = { n: 0, hit: 0 }, strong = { n: 0, hit: 0 };
  for (const day of days) day.forEach((r, i) => {
    const two = flowTwo(day.slice(0, i));
    if (!two.length) return;
    const h = hitsAny(r, two.map((x) => x.d)) ? 1 : 0;
    all.n++; all.hit += h;
    if (two[0].rounds >= 3) { strong.n++; strong.hit += h; }
  });
  return { all, strong };
}
/** ฟัน 2 ตัวแบบสุ่ม เข้าอย่างน้อย 1 ตัวใน 4 หลัก */
export const RANDOM_TWO = 1 - 0.8 ** 4;

/** เลขทายของวัน D ล็อกตอนรอบแรกออก (นิเช้า 09:30 ไทย = 02:30 UTC) */
export const guessLockAt = (date: string) => new Date(`${date}T02:30:00.000Z`);
export const guessLocked = (date: string, now = new Date()) => now >= guessLockAt(date);
/** วันที่ยังทายได้ที่ใกล้สุด: ก่อน 09:30 = วันนี้ · หลังจากนั้น = พรุ่งนี้ */
export function nextGuessDate(now = new Date()) {
  const d = new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  return guessLocked(d, now) ? new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : d;
}

/**
 * ให้คะแนนเลขทาย 2 ตัวกับผลจริงทั้งวัน
 *   rounds = รอบที่เข้า (บน/ล่างมีเลขทายอย่างน้อย 1 ตัว) · สุ่ม ≈ 59% ของรอบ
 *   topHit = ทายโดนเลขที่ไหลมากสุดของวัน (เสมอกันนับทุกตัว) · topChance = โอกาสถ้าสุ่ม 2 ตัว
 */
export function scoreGuess(digits: string[], day: FlowResult[]) {
  const c = countFlow(day), max = Math.max(...c.map((x) => x.rounds));
  const tops = c.filter((x) => x.rounds === max).map((x) => x.d);
  const k = tops.length;
  return {
    n: day.length,
    rounds: day.filter((r) => hitsAny(r, digits)).length,
    tops, max,
    topHit: digits.some((d) => tops.includes(d)),
    topChance: 1 - ((10 - k) * (9 - k)) / 90,
    perDigit: digits.map((d) => ({ d, rounds: c.find((x) => x.d === d)!.rounds })),
  };
}

/**
 * เลขไหลล่วงหน้า (ระบบวิเคราะห์ · ผู้ใช้ขอ 22 ต.ค. 69) — คิดจากผลรอบปิดวันของ "วันก่อน" เท่านั้น
 *   ตัวที่ 1 = เลขค้าง +7: เลขที่ออกน้อยสุดของวันก่อน (นับทุกหลัก → นับรอบ → ค้างนานสุด คือออกครั้งสุดท้ายเร็วสุด/ไม่ออกเลย) แล้ว +7
 *   ตัวที่ 2 = บนของจีนบ่าย (หลักสิบ + หลักหน่วย) +3 · ถ้าซ้ำตัวที่ 1 → เลขค้างลำดับถัดไป +7
 *   ที่มา: ค้นสูตร 521 แบบบนปี 2559–2566 แล้วตรวจกับ ต.ค. 66–69 ที่ไม่ได้ใช้คัด → เข้า 61.0% ของรอบ (สุ่ม 59.0%) · โดนเลขไหลสุดของวัน 138/415 วัน (สุ่ม ≈129)
 *   ได้เปรียบสุ่มแค่ ~2 จุด ยังอาจเป็นความบังเอิญ — ล็อกทุกวันแล้วให้ผลจริงตัดสิน
 */
export const SYS_SLOTS: FlowSlot[] = ["nk-pm", "cn-pm", "hk-pm", "tw", "sg", "sx", "eg"];
export const SYS_METHOD = "ระบบ";
/** วิธีเทียบ (ล็อกคู่กันอัตโนมัติ) — ทดสอบแล้วเท่าสุ่ม · "ไหลต่อ" เอาออก 22 ต.ค. 69 ตามผู้ใช้ (ทดสอบแย่กว่าสุ่ม: เลขไหลไม่ข้ามวัน) */
export const COMPARE_METHODS = ["ระบบ: เลขค้าง"] as const;

const staleOrder = (rows: FlowResult[]) => {
  const c = countFlow(rows);
  return [...c].sort((a, b) => a.total - b.total || a.rounds - b.rounds || a.last - b.last);
};
/** วันก่อนใช้ได้ไหม: รอบปิดวัน ≥4 จาก 7 (บางวันบางตลาดปิด — ผู้ใช้ 23 ต.ค. 69) */
export const SYS_MIN_ROUNDS = 4;
export function systemDay(prev: FlowResult[]) {
  const rows = SYS_SLOTS.map((s) => prev.find((r) => r.slot === s)).filter((r): r is FlowResult => !!r);
  return rows.length >= SYS_MIN_ROUNDS ? rows : null;
}
export function systemGuess(prev: FlowResult[]): { method: string; digits: string[]; why: string }[] | null {
  const rows = systemDay(prev);
  if (!rows) return null;
  const order = staleOrder(rows);
  const cn = rows.find((r) => r.slot === "cn-pm")?.top;
  const a = String((+order[0].d + 7) % 10);
  const b = cn && String((+cn[0] + +cn[1] + 3) % 10);
  // จีนปิด หรือได้เลขซ้ำตัวที่ 1 → เลขค้างลำดับถัดไป +7
  const next = (why: string) => { const o = order.find((x) => String((+x.d + 7) % 10) !== a)!; const d = String((+o.d + 7) % 10); return { d, why: `${why} → เลขค้างถัดไป ${o.d}+7 = ${d}` }; };
  const second = !cn || !b ? next("จีนบ่ายปิด") : b !== a ? { d: b, why: `บนจีนบ่าย ${cn} → ${cn[0]}+${cn[1]}+3 = ${b}` } : next("ซ้ำ");
  return [
    { method: SYS_METHOD, digits: [a, second.d], why: `เลขค้าง ${order[0].d} (ออก ${order[0].total} หลัก) +7 = ${a} · ${second.why}` },
    { method: COMPARE_METHODS[0], digits: order.slice(0, 2).map((x) => x.d), why: "2 ตัวที่ออกน้อยสุดของวันก่อน" },
  ];
}

/** ชั่วโมงตอนนี้ (เวลาไทย) */
export const thaiHour = (d = new Date()) => new Date(d.getTime() + 7 * 3600 * 1000).getUTCHours();
