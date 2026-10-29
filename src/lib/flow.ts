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
import { top2, bottom2, DRILL_PER_DIGIT } from "@/lib/digits";
import { betResult } from "@/lib/bet";

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

/**
 * เลขเจาะจากเลขไหล (ผู้ใช้ขอ 28 ต.ค. 69) — 2 ชุด × DRILL_PER_DIGIT: เลขไหลแต่ละตัวจับคู่กับเลขที่ไหลรองลงมาตามอันดับ ตัดเบิ้ล ตัดคู่ซ้ำ (กลับได้)
 *   ทดสอบ IndexDay 625 วัน (ต.ค. 66–ต.ค. 69 · 5,390 รอบ): เจาะมา (ตรง บน/ล่าง กลับได้) 42.7% · จับคู่ไหลน้อย 43.3% · สุ่มคู่ 43.1% = เท่าสุ่มทุกแบบ
 */
export const FLOW_DRILL_RANDOM = 0.431;
const canon = (m: string) => (m[0] <= m[1] ? m : m[1] + m[0]);
export function flowDrill(done: FlowResult[]): string[][] {
  const two = flowTwo(done).map((x) => x.d);
  const order = countFlow(done).sort((a, b) => b.rounds - a.rounds || b.total - a.total || b.last - a.last).map((x) => x.d);
  const chosen: string[] = [];
  return two.map((d) => {
    const set: string[] = [];
    for (const x of order) {
      if (set.length >= DRILL_PER_DIGIT) break;
      const m = d + x;
      if (x === d || chosen.some((c) => canon(c) === canon(m))) continue;
      set.push(m); chosen.push(m);
    }
    return set;
  });
}
export const drillHits = (r: FlowResult, sets: string[][]) => sets.flat().some((m) => canon(m) === canon(r.top) || canon(m) === canon(r.bottom));

/** ไล่ทั้งวัน: แต่ละรอบ (ตั้งแต่รอบที่ 3) ใช้เลขไหล + เลขเจาะจากรอบก่อนหน้า แล้วดูว่าเข้าไหม */
export function walkDay(day: FlowResult[]) {
  return day.map((r, i) => {
    const done = day.slice(0, i), two = flowTwo(done).map((x) => x.d), drill = two.length ? flowDrill(done) : [];
    return { r, i, two, drill, hit: two.length ? hitsAny(r, two) : null, drillHit: two.length ? drillHits(r, drill) : null };
  });
}

/**
 * ถ้าแทงเลขไหลทุกรอบ (ผู้ใช้ถาม 28 ต.ค. 69) — รูดเลขไหล 2 ตัว + เจาะ 12 ตัว ตามวิธีแทงใน bet.ts (ทุน 2,480 ต่อรอบที่เลขละ 20)
 *   วัน = [วันที่, ผลแต่ละรอบเรียงตามเวลา] · คิดตั้งแต่รอบที่ 3 (มีเลขไหลแล้ว) · ทรุดลึกสุด = กำไรสะสมลดลงจากจุดสูงสุดมากสุด
 *   อัตราจ่าย 100 = เกมเสมอตัวถ้าสุ่ม (คืน 1.00 ต่อบาท) — กำไร/ขาดทุนที่เห็นจึงเป็นความผันผวนเป็นหลัก
 */
export function flowMoney(days: (readonly [string, FlowResult[]])[], stake: number, only?: (w: ReturnType<typeof walkDay>[number], date: string, day: FlowResult[]) => boolean) {
  const rows = days.map(([d, day]) => {
    const w = walkDay(day).filter((x) => x.two.length && (!only || only(x, d, day)));
    const b = w.map((x) => betResult(x.two, x.drill.flat(), x.r.top, x.r.bottom, stake));
    // แต่ละรอบที่ซื้อ: หุ้น · เลขไหลเข้าไหม (บน/ล่างมีเลขไหล) · ได้/เสีย
    const items = w.map((x, i) => ({ slot: x.r.slot, hit: !!x.hit, profit: b[i].profit }));
    return { d, rounds: b.length, hits: items.filter((x) => x.hit).length, items, cost: b.reduce((a, x) => a + x.cost, 0), win: b.reduce((a, x) => a + x.win, 0), tickets: b.reduce((a, x) => a + x.tickets, 0) };
  }).filter((r) => r.rounds);
  let cum = 0, peak = 0, drawdown = 0;
  for (const r of [...rows].sort((a, b) => a.d.localeCompare(b.d))) { cum += r.win - r.cost; peak = Math.max(peak, cum); drawdown = Math.max(drawdown, peak - cum); }
  const sum = (l: typeof rows) => ({ days: l.length, rounds: l.reduce((a, r) => a + r.rounds, 0), hits: l.reduce((a, r) => a + r.hits, 0), cost: l.reduce((a, r) => a + r.cost, 0), win: l.reduce((a, r) => a + r.win, 0) });
  const years = [...new Set(rows.map((r) => r.d.slice(0, 4)))].sort().map((y) => ({ y, ...sum(rows.filter((r) => r.d.startsWith(y))) }));
  const months = [...new Set(rows.map((r) => r.d.slice(0, 7)))].sort().map((m) => ({ m, ...sum(rows.filter((r) => r.d.startsWith(m))) }));
  const profits = rows.map((r) => r.win - r.cost);
  return { rows, total: sum(rows), years, months, drawdown, plusDays: profits.filter((x) => x > 0).length, worstDay: Math.min(0, ...profits), bestDay: Math.max(0, ...profits) };
}

/**
 * หุ้นที่เล่นเลขไหล (ผู้ใช้ 29 ต.ค. 69: "เอาที่ดีที่สุดกลับมา") — ฮั่งเส็งเช้า · นิเคอิบ่าย · ฮั่งเส็งบ่าย ทุกวันที่ตลาดเปิด
 *   ผลจริงที่ผู้ใช้บันทึก (ส.ค.–ต.ค. 69 · เลขละ 20 · 97 รอบ): ซื้อ 100 คืน 107.2 (+17,440) — ดีที่สุดในทุกวิธีที่ลอง
 *   ย้อนหลังดัชนีทางการ 625 วัน: คืน 107.9 (สองครึ่ง 108.0 / 107.7) · คัด 3 จากครึ่งแรก ครึ่งหลังยังคืน 107.7
 *   ลองแล้วผลจริงแย่กว่า (29 ต.ค. 69): ดูตลาดวันนี้ทีละรอบ (ไหลแรง/นำ) 101.6 · + พักตอนไหลขาด 102.2 · 3 หุ้น + ไหลขาด 105.5 · 4 หุ้น (+ดาวโจนส์) 103.1 · ทุกรอบ 100.9
 *   ข้อควรรู้: คัดหลังเห็นข้อมูล ยังอาจบังเอิญ — อย่าปรับบ่อย รอผลจริงตัดสิน · หุ้นอื่นเพิ่มรายวันได้ (flowModel)
 */
export const FLOW_PLAY: FlowSlot[] = ["hk-am", "nk-pm", "hk-pm"];
/**
 * หุ้นเพิ่มรายวัน (ผู้ใช้ 29 ต.ค. 69: "3 หุ้นหลัก + วันไหนหุ้นอื่นน่าไหลไปก็แนะนำเพิ่ม") — ดูเลขไหลของวันนั้นก่อนรอบนั้น:
 *   ไหลแรงแค่ไหน = เลขไหลตัวแรกออกแล้วกี่ % ของรอบ (อ่อน <60% · กลาง 60–75% · แรง ≥75%) · ตัวแรกนำตัวที่สองหรือเสมอ
 *   ประเมิน = ในอดีต หุ้นนี้ตอนเลขไหลเป็นแบบนี้ ซื้อ 1 ได้คืนเท่าไร (หดเข้าหาค่าทั้งหมดของหุ้น K2 รอบ · ค่าหุ้นหดเข้าหา 1.00 K1 รอบ)
 *   หุ้นหลักเล่นเสมอ · หุ้นอื่นเล่นเมื่อประเมิน > PLAY_EXTRA
 *   ผลจริง (ส.ค.–ต.ค. 69 เลขละ 50): ต.ค. +76,400 · รวม +54,400 (3 หุ้นอย่างเดียว +55,000 / +43,600)
 *   ย้อนหลังเดินหน้า (ใช้แค่ข้อมูลก่อนแต่ละวัน): คืน 106.5 สองครึ่ง 106.5 / 106.5 (3 หุ้นอย่างเดียว 106.3) · เกณฑ์ 1.05 / 1.08 แย่กว่า
 * + ตามไหล (ผู้ใช้ 29 ต.ค. 69: "a ออก b ออก c ออก ควรตามเลขไหลตัวต่อไปไหม"): เลขไหลเข้าติดกัน ≥ FOLLOW_STREAK รอบ → ตามไปทุกหุ้นรอบถัดไป
 *   ย้อนหลัง 3 ปี รอบหลังเข้าติด 4+: ซื้อ 100 คืน 112 (3 ช่วง 108 / 123 / 106) · ผลจริง 157 (19 รอบ) · เข้าติด 3 รอบกลับคืนแค่ 92 จึงเริ่มที่ 4
 *   รวมกับข้างบน (เลขละ 50): ผลจริง ต.ค. +120,800 รวม +119,000 · ย้อนหลังเดินหน้า คืน 106.7 (107.7 / 105.6) กำไร +620,200 (เดิม +521,000)
 *   ลองแล้วไม่ใช้: ไม่เข้าติด 3+ รอบให้หยุด (ย้อนหลังดีขึ้นนิด แต่ผลจริงแย่ลง)
 */
export const FOLLOW_STREAK = 4;
/** เลขไหลเข้าติดกันกี่รอบล่าสุด (นับเฉพาะรอบที่มีเลขไหลแล้ว) */
export const flowStreak = (done: FlowResult[]) => { const wd = walkDay(done); let n = 0; for (let k = wd.length - 1; k >= 0 && wd[k].hit === true; k--) n++; return n; };
export const PLAY_K1 = 150;
export const PLAY_K2 = 300;
export const PLAY_EXTRA = 1.06;
/**
 * ราคาปิดเมื่อวาน (ผู้ใช้ 29 ต.ค. 69: "ดูดัชนีแต่ละตัวว่าสมเหตุสมผลจะเล่นเลขไหลไหม") — รู้ก่อนผลออก (= เปิด − เปลี่ยนตอนเปิด)
 *   บน = สตางค์ปิดเมื่อวาน ± ล่าง → คิดได้เลยว่าเลขไหล 2 ตัวมีทางโผล่ใน 4 หลักกี่ % (ทุกล่าง 00–99 × ขึ้น/ลง)
 *   ย้อนหลัง 5,419 รอบ: ทาง ≥62% เข้าจริง 65% · ≤56% เข้าแค่ 53% (สองครึ่งตรงกัน) · ดัชนีขึ้น/ลง/วิ่งแรง ไม่ช่วย (สลับไปมา)
 *   ไม่เล่นรอบที่ทาง ≤ FLOW_PREV_TIGHT: ย้อนหลัง 37 เดือน กำไรเท่าเดิม (+442k vs +434k เลขละ 20) ทุนลด 24% ทรุด 41k (เดิม 61k)
 *   ผลจริง ส.ค.–ต.ค. 69: +47,520 vs +45,680 ทุนลด 25% บวกครบ 3 เดือน
 */
export const FLOW_PREV_TIGHT = 0.56;
export function prevFit(prevClose: number, two: string[]) {
  const p = Math.round(Math.abs(prevClose) * 100) % 100;
  let h = 0;
  for (let c = 0; c < 100; c++) for (const s of [1, -1]) {
    const t = String((((p + s * c) % 100) + 100) % 100).padStart(2, "0");
    if ((t + String(c).padStart(2, "0")).split("").some((x) => two.includes(x))) h++;
  }
  return h / 200;
}
export type FlowMood = { ratio: number; strength: "อ่อน" | "กลาง" | "แรง"; lead: boolean };
export function flowMood(done: FlowResult[]): FlowMood | null {
  const t = flowTwo(done);
  if (!t.length) return null;
  const ratio = t[0].rounds / done.length;
  return { ratio, strength: ratio >= 0.75 ? "แรง" : ratio >= 0.6 ? "กลาง" : "อ่อน", lead: t[0].rounds > t[1].rounds };
}
export type RoundEst = { slot: FlowSlot; mood: FlowMood; est: number; slotRet: number; slotN: number; cellRet: number | null; cellN: number; base: boolean; streak: number; follow: boolean; tight: boolean; play: boolean };
type Acc = { n: number; c: number; w: number };
const cellKey = (slot: FlowSlot, m: FlowMood) => `${slot}|${m.strength}|${m.lead ? "L" : "T"}`;
/** days = วันที่ผลครบ → (date) => ประเมินรอบ (slot, ผลที่ออกแล้ววันนั้น) จากสถิติก่อน date */
export function flowModel(days: (readonly [string, FlowResult[]])[]) {
  const sorted = [...days].sort((a, b) => a[0].localeCompare(b[0]));
  const acc = new Map<string, Acc>();
  const add = (k: string, c: number, w: number) => { const a = acc.get(k) ?? { n: 0, c: 0, w: 0 }; acc.set(k, { n: a.n + 1, c: a.c + c, w: a.w + w }); };
  const snaps: { d: string; acc: Map<string, Acc> }[] = [];
  for (const [d, day] of sorted) {
    snaps.push({ d, acc: new Map(acc) }); // ก่อนวันนี้ (add สร้างอ็อบเจกต์ใหม่ ค่าเดิมใน snapshot ไม่ถูกแก้)
    walkDay(day).forEach((w, i) => {
      const m = flowMood(day.slice(0, i));
      if (!m) return;
      const b = betResult(w.two, w.drill.flat(), w.r.top, w.r.bottom, 1);
      add(w.r.slot, b.cost, b.win);
      add(cellKey(w.r.slot, m), b.cost, b.win);
    });
  }
  return (date: string) => {
    const snap = snaps.find((x) => x.d >= date)?.acc ?? acc;
    /** prevClose = ราคาปิดเมื่อวานของหุ้นนี้ (ไม่รู้ = ไม่ตัด) */
    return (slot: FlowSlot, done: FlowResult[], prevClose?: number): RoundEst | null => {
      const mood = flowMood(done);
      if (!mood) return null;
      const s = snap.get(slot), c = snap.get(cellKey(slot, mood));
      const slotScore = s ? ((s.w / s.c) * s.n + PLAY_K1) / (s.n + PLAY_K1) : 1;
      const est = c ? ((c.w / c.c) * c.n + slotScore * PLAY_K2) / (c.n + PLAY_K2) : slotScore;
      const base = FLOW_PLAY.includes(slot);
      const streak = flowStreak(done), follow = streak >= FOLLOW_STREAK;
      const tight = prevClose !== undefined && prevFit(prevClose, flowTwo(done).map((x) => x.d)) <= FLOW_PREV_TIGHT;
      return { slot, mood, est, slotRet: s ? s.w / s.c : 1, slotN: s?.n ?? 0, cellRet: c ? c.w / c.c : null, cellN: c?.n ?? 0, base, streak, follow, tight, play: (base || est > PLAY_EXTRA || follow) && !tight };
    };
  };
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
/** เวลาตอนนี้ (เวลาไทย) "HH:MM" — เทียบกับ FLOW_ROUNDS[].time ได้ตรง ๆ */
export const thaiHHMM = (d = new Date()) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16);
