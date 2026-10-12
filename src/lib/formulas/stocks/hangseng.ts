/**
 * สูตรของ "หุ้นฮั่งเส็ง (ปกติ)" — เครื่องคิดของฮั่งเส็งเอง ไม่ใช้เครื่องกลาง (digits.ts pickTwo / ฐาน SENSEX) ตามที่ผู้ใช้สั่ง 12 ต.ค. 69
 *   นำเข้าจากไฟล์กลางแค่ชนิดข้อมูล (type) และตัวแปลงเลข top2/bottom2 — ไม่ใช้สถิติหรือกฎของหุ้นตัวอื่น
 *
 * ข้อมูลที่ใช้ออกแบบ: ผลหวยฮั่งเส็งจริง (raakaadee) 25 พ.ย. 65 → 9 ต.ค. 69 เช้า 927 · บ่าย 924 งวด + ปิดทางการวันก่อนจาก Yahoo ^HSI
 *   โครงสร้าง: ล่าง = บน ∓ D (D = ทศนิยมปิดทางการวันก่อน) ตรงกับผลหวย 99.7% ทั้งสองรอบ → ไล่ 200 กรณีจาก D ได้
 *
 * ทดสอบ walk-forward ข้อมูลฮั่งเส็งล้วน (ตั้งกฎจากครึ่งแรก A = ก่อน ก.ค. 68, ยืนยันครึ่งหลัง B):
 *   บ่าย: เลขเสมอกัน → เลขที่โผล่บ่อยที่สุดในประวัติฮั่งเส็งบ่ายเอง — A ★39.6 / 2 ตัว 66.3 · B ★40.7 / 66.6 · ปี 69 ★42.0 / 65.9
 *         (เลขเสมอ → เลขมาก: A 35.4 / 63.3 · B 34.8 / 64.9) ▸ บ่ายเลข 1 โผล่บ่อย (39%/37%) เลข 0, 7 น้อย ทั้งสองครึ่ง
 *   เช้า: ไม่มีสัญญาณไหนชนะทั้งสองครึ่ง (ความถี่/เลขร้อน/เลขเย็น/เลขเมื่อวาน/ทิศทางจากเปิด) → เลขเสมอ → เลขมาก ★36.9 / 64.4 (777 งวด)
 *   สุ่มเดา: เช้า ★34.2 / 2 ตัว 58.8 · บ่าย ★34.6 / 59.4
 *   ทิศทางจากช่องว่างเปิด (เช้า: เปิด 9:30 · บ่าย: เปิด 13:00) ไม่ช่วยทั้งสองรอบ → ใช้ขึ้น/ลง 50:50
 *   เจาะ 2 ชุด × 6 (เลือกเลขที่ไม่มาในกรณีเดียวกัน): เช้า A 45.6% · B 49.3% · บ่าย A 47.7% · B 47.0% (ชนะการเลือกตามความถี่คู่)
 *     ปรับ 12 ต.ค. 69 — บ่าย: ถ่วงกรณีด้วยความถี่หลักสิบ/หน่วยของ "บน" ในฮั่งเส็งบ่ายเอง → A 47.2 → 49.8% · B 50.3 → 52.3%
 *       เช้า: แบบถ่วงได้ A 48.8 แต่ B 48.0 (แย่กว่าเดิม 49.3) ไม่นิ่ง → เช้าคงแบบเดิม
 *   ชุดวิน 6 ตัว (ปรับ 12 ต.ค. 69): ต้องมี ★ + เลือกให้ "บน หรือ ล่าง อยู่ครบในชุด" บ่อยสุด (ผู้ใช้แทงวิน 3 ตัวบน / 2 ตัว)
 *     เช้า: 3 ตัวบน 19.2 → 23.6% · 2 ตัว 48.4 → 66.7% · บ่าย: 3 ตัวบน 21.6 → 26.4% · 2 ตัว 51.7 → 66.7% (ดีขึ้นทั้งครึ่ง A และ B)
 *     แลกกับ "บนและล่างเข้าชุดพร้อมกัน" ที่ลดจาก ~22% เหลือ ~5–7% · สุ่มเดา: 3 ตัวบน 21.6% · 2 ตัว ~59%
 *   "วันอ่อน" แบบ SENSEX ใช้กับฮั่งเส็งไม่ได้: วันที่เลขเด่น <34% บ่ายถูก 50.5% (111 งวด) เช้า 34.2% → ไม่แสดงป้ายวันอ่อน
 */
import { top2, bottom2, uniqueDigits, type TwoPick, type DigitDetail, type Drill, type DrillSet } from "@/lib/digits";
import type { HangSengSession } from "@/lib/stocks/hangseng";

export const HANGSENG_BASE = {
  am: { days: 777, star: 0.369, two: 0.644, drill: 0.471, randomStar: 0.342, randomTwo: 0.588 },
  pm: { days: 774, star: 0.401, two: 0.664, drill: 0.474, randomStar: 0.346, randomTwo: 0.594, star2026: 0.42, two2026: 0.659 },
} as const;

/**
 * จำนวนงวดที่เลข 0–9 โผล่ (บน 2 ตัว ∪ ล่าง) ในผลหวยฮั่งเส็งจริง ถึง 9 ต.ค. 69 — เก็บแค่ 10 ตัวเลขแทนข้อมูลย้อนหลังทั้งหมด (ไม่ให้หนักเครื่อง)
 * แถวในแอปหลังวันนี้นับเพิ่มเอง
 */
const COUNTS_UNTIL = "2026-10-09";
const DIGIT_COUNTS: Record<HangSengSession, { n: number; c: number[] }> = {
  am: { n: 927, c: [303, 305, 334, 346, 315, 319, 316, 275, 321, 351] },
  pm: { n: 924, c: [299, 354, 320, 312, 327, 330, 305, 306, 327, 316] },
};

/** จำนวนครั้งที่เลข 0–9 อยู่หลักสิบ / หลักหน่วยของ "บน" ในผลหวยฮั่งเส็งบ่าย ถึง 9 ต.ค. 69 (ใช้ถ่วงเลขเจาะรอบบ่าย) */
const PM_TOP_POS = { n: 924, tens: [84, 117, 87, 92, 98, 87, 79, 75, 95, 110], units: [72, 108, 100, 94, 88, 89, 101, 91, 103, 78] };

const DIGITS = "0123456789".split("");
const DRILL_PER_DIGIT = 6;
type Row = { date: Date; closeValue: number | null; closeChange: number | null };
type Outcome = { top: string; bottom: string; set: Set<string>; w: number };

const cents = (x: number) => Math.round(Math.abs(x) * 100) % 100;
const r9 = (x: number) => Math.round(x * 1e9);

/** ทุกกรณีของวันนี้: บน 00–99 × ขึ้น/ลง (50:50) · ล่าง = บน − D (ขึ้น) หรือ D − บน (ลง) */
const outcomeCache = new Map<number, Outcome[]>();
function outcomes(D: number): Outcome[] {
  const hit = outcomeCache.get(D);
  if (hit) return hit;
  const out: Outcome[] = [];
  for (let t = 0; t < 100; t++) {
    const top = String(t).padStart(2, "0");
    for (const up of [true, false]) {
      const v = up ? t - D : D - t;
      const bottom = String(((v % 100) + 100) % 100).padStart(2, "0");
      out.push({ top, bottom, set: new Set(top + bottom), w: 0.005 });
    }
  }
  outcomeCache.set(D, out);
  return out;
}

function detail(O: Outcome[], digit: string): DigitDetail {
  const pos = { topTens: 0, topUnits: 0, botTens: 0, botUnits: 0 };
  let any = 0, tens = 0, units = 0, top = 0, bottom = 0;
  for (const o of O) {
    const at = { topTens: o.top[0], topUnits: o.top[1], botTens: o.bottom[0], botUnits: o.bottom[1] };
    let hit = false;
    for (const k of Object.keys(pos) as (keyof typeof pos)[]) if (at[k] === digit) { pos[k] += o.w; hit = true; }
    if (hit) any += o.w;
    if (at.topTens === digit || at.botTens === digit) tens += o.w;
    if (at.topUnits === digit || at.botUnits === digit) units += o.w;
    if (at.topTens === digit || at.topUnits === digit) top += o.w;
    if (at.botTens === digit || at.botUnits === digit) bottom += o.w;
  }
  return { digit, p: any, pos, tens, units, top, bottom, givenTens: any ? tens / any : 0, givenUnits: any ? units / any : 0 };
}

/** ความถี่ของเลขในฮั่งเส็งรอบนี้: ฐานที่เก็บไว้ + แถวในแอปหลัง COUNTS_UNTIL ที่อยู่ก่อนวันนี้ */
function digitCounts(session: HangSengSession, history: Row[]): number[] {
  const c = [...DIGIT_COUNTS[session].c];
  for (const r of history) {
    if (r.closeValue == null || r.closeChange == null || r.date.toISOString().slice(0, 10) <= COUNTS_UNTIL) continue;
    for (const d of uniqueDigits(top2(r.closeValue) + bottom2(r.closeChange))) c[Number(d)]++;
  }
  return c;
}

/** บ่าย: ถ่วงน้ำหนักกรณีด้วยความถี่ตำแหน่งของ "บน" (ฐาน + แถวในแอปหลัง COUNTS_UNTIL) · ปรับให้รวมเป็น 1 */
function pmWeighted(O: Outcome[], history: Row[]): Outcome[] {
  const tens = [...PM_TOP_POS.tens], units = [...PM_TOP_POS.units];
  let n = PM_TOP_POS.n;
  for (const r of history) {
    if (r.closeValue == null || r.date.toISOString().slice(0, 10) <= COUNTS_UNTIL) continue;
    const t = top2(r.closeValue); tens[Number(t[0])]++; units[Number(t[1])]++; n++;
  }
  const f = (c: number) => ((c + 20) / (n + 200)) * 10;
  const W = O.map((o) => ({ ...o, w: o.w * f(tens[Number(o.top[0])]) * f(units[Number(o.top[1])]) }));
  const sum = W.reduce((s, o) => s + o.w, 0);
  return W.map((o) => ({ ...o, w: o.w / sum }));
}

const pAny = (O: Outcome[], digits: string[]) => O.reduce((s, o) => s + (digits.some((d) => o.set.has(d)) ? o.w : 0), 0);

/** เจาะ: เลือกทีละตัวให้ "อย่างน้อย 1 ใน 12 ตัวมา" สูงสุด (เลี่ยงเลขที่มาในกรณีเดียวกัน) ชุดละ 6 · กลับได้ */
function drill(O: Outcome[], a: string, b: string): Drill {
  const canon = (m: string) => (m[0] <= m[1] ? m : m[1] + m[0]);
  const hits = (o: Outcome, m: string) => { const r = m[1] + m[0]; return o.top === m || o.top === r || o.bottom === m || o.bottom === r; };
  const any = (nums: string[]) => O.reduce((s, o) => s + (nums.some((m) => hits(o, m)) ? o.w : 0), 0);
  const cands = [...DIGITS.filter((x) => x !== a).map((x) => a + x), ...DIGITS.filter((x) => x !== a && x !== b).map((x) => b + x)];
  const chosen: string[] = [];
  while (chosen.length < 2 * DRILL_PER_DIGIT) {
    let best: { m: string; p: number; own: number } | null = null;
    for (const m of cands) {
      if (chosen.filter((c) => c[0] === m[0]).length >= DRILL_PER_DIGIT || chosen.some((c) => canon(c) === canon(m))) continue;
      const p = any([...chosen, m]), own = any([m]);
      if (!best || r9(p) > r9(best.p) || (r9(p) === r9(best.p) && r9(own) > r9(best.own))) best = { m, p, own };
    }
    if (!best) break;
    chosen.push(best.m);
  }
  const set = (d: string): DrillSet => {
    const nums = chosen.filter((m) => m[0] === d);
    return { digit: d, numbers: nums.map((m) => ({ number: m, p: any([m]) })), pAny: any(nums) };
  };
  return { sets: [set(a), set(b)], pAny: any(chosen) };
}

/**
 * ชุดวิน 6 ตัว: ต้องมี ★ (ตัวเด่นที่ฟัน) แล้วเลือกอีก 5 ตัวให้ "บน หรือ ล่าง อยู่ครบในชุด" บ่อยสุด (ไล่ครบทุกชุด)
 *   ผลทดสอบดูหัวไฟล์ · แบบเก่า (บนและล่างพร้อมกัน) เข้า 2 ตัวแค่ ~50% เทียบแบบนี้ ~67%
 */
function winSet(O: Outcome[], must: string, k = 6) {
  const inSet = (s: Set<string>, x: string) => s.has(x[0]) && s.has(x[1]);
  let best: { digits: string[]; p: number } | null = null;
  const go = (start: number, chosen: string[]) => {
    if (chosen.length === k) {
      if (!chosen.includes(must)) return;
      const S = new Set(chosen);
      const p = O.reduce((s, o) => s + (inSet(S, o.top) || inSet(S, o.bottom) ? o.w : 0), 0);
      if (!best || p > best.p) best = { digits: [...chosen], p };
      return;
    }
    for (let i = start; i < 10; i++) go(i + 1, [...chosen, DIGITS[i]]);
  };
  go(0, []);
  const b = best!, S = new Set(b.digits);
  return { digits: b.digits, pWin: b.p, pBoth: O.reduce((s, o) => s + (inSet(S, o.top) && inSet(S, o.bottom) ? o.w : 0), 0) };
}

/**
 * ฟัน 2 ตัว + เจาะ 2×6 ของฮั่งเส็ง
 *   ★ = เลขที่โอกาสโผล่ (จาก D) สูงสุด · ตัวรอง = ตัวที่ทำให้ "อย่างน้อย 1 ใน 2 มา" สูงสุด
 *   เสมอกัน: บ่าย → เลขที่โผล่บ่อยในประวัติฮั่งเส็งบ่าย · เช้า → เลขมากก่อน (ผลทดสอบของแต่ละรอบเอง)
 */
export function pickHangSeng(openValue: number, openChange: number, history: Row[], session: HangSengSession): TwoPick {
  const D = cents(openValue - openChange);
  const O = outcomes(D);
  const counts = digitCounts(session, history);
  const tie = (d: string) => (session === "pm" ? counts[Number(d)] * 10 + Number(d) : Number(d)); // มาก = มาก่อน
  const details = DIGITS.map((d) => detail(O, d)).sort((x, y) => r9(y.p) - r9(x.p) || tie(y.digit) - tie(x.digit));
  const first = details[0];
  const rank = (chosen: string[]) => details
    .filter((d) => !chosen.includes(d.digit))
    .map((d) => ({ d, any: pAny(O, [...chosen, d.digit]) }))
    .sort((x, y) => r9(y.any) - r9(x.any) || tie(y.d.digit) - tie(x.d.digit))[0];
  const second = rank([first.digit]);
  const third = rank([first.digit, second.d.digit]);
  const fourth = rank([first.digit, second.d.digit, third.d.digit]);
  const pBoth = O.reduce((s, o) => s + (o.set.has(first.digit) && o.set.has(second.d.digit) ? o.w : 0), 0);
  const n = DIGIT_COUNTS[session].n + history.filter((r) => r.closeValue != null && r.date.toISOString().slice(0, 10) > COUNTS_UNTIL).length;
  return {
    digits: [first, second.d],
    standout: first,
    standoutRate: counts[Number(first.digit)] / n,
    pAny: second.any,
    pBoth,
    third: third.d,
    pAny3: third.any,
    fourth: fourth.d,
    pAny4: fourth.any,
    win: winSet(O, first.digit),
    tiedWithMain: details.filter((d) => r9(d.p) === r9(first.p)).map((d) => d.digit),
    drill: drill(session === "pm" ? pmWeighted(O, history) : O, first.digit, second.d.digit),
    pDouble: O.reduce((s, o) => s + (o.top[0] === o.top[1] || o.bottom[0] === o.bottom[1] ? o.w : 0), 0),
  };
}
