/**
 * สูตรของ "หุ้นดาวโจนส์ (ปกติ)" — เครื่องคิดของดาวโจนส์เอง ไม่ใช้เครื่องกลาง (digits.ts pickTwo / ฐาน SENSEX) และไม่ใช้สูตรหุ้นตัวอื่น
 *   นำเข้าจากไฟล์กลางแค่ชนิดข้อมูล (type) และตัวแปลงเลข top2/bottom2
 *
 * ข้อมูลที่ใช้ออกแบบ: ปิดทางการ ^DJI (Yahoo) 3 ม.ค. 2543 → 9 ต.ค. 2569 = 6,732 งวด (ตรงกับผลหวยจริง 38/38 งวด)
 *   โครงสร้าง: ล่าง = บน − D (ขึ้น) หรือ D − บน (ลง) · D = ทศนิยมปิดวันก่อน → ไล่ 200 กรณี (บน 00–99 × ขึ้น/ลง)
 *   ทดสอบ walk-forward ข้อมูลดาวโจนส์ล้วน — A = 2543–2555 (3,268 งวด) · B = 2556–2569 (3,464 งวด):
 *     สุ่มเดา: ★ 34.3 / 2 ตัว 58.9 (A) · 34.5 / 59.2 (B)
 *     ★ เสมอกันใน 96% ของงวด → กฎตัดเสมอคือตัวตัดสิน:
 *       เลขมากก่อน   A ★35.6 / 2 ตัว 63.4 · B ★35.9 / 62.8   ← ชนะสุ่มทั้งสองครึ่ง นิ่งสุด (เลือกใช้)
 *       เลขน้อยก่อน  A 33.9 / 62.5 · B 35.2 / 63.0 (ครึ่งแรกแพ้สุ่ม)
 *       เลขออกบ่อย (ทั้งหมด/100/500 งวด)  A 34.9–35.4 · B 35.0–35.5 · เลขเย็น 100 งวด A 35.4 · B 34.9
 *       เลขที่ออกเมื่อวาน  A 34.7 · B 36.2 · ไม่ใช่เลขเมื่อวาน A 34.9 · B 34.8 (ไม่นิ่ง)
 *     ทิศทางจากเปิด (เปิดเหนือ/ใต้ปิดวันก่อน → ถ่วงขึ้น/ลง) ไม่ช่วย: A 63.6 · B 62.7 (เท่าเดิม) → ใช้ขึ้น/ลง 50:50
 *   2 ตัวได้ ~63% (สุ่ม 59%) มาจากการเลือกตัวรองที่ไม่ "มาด้วยกัน" กับ ★ ในกรณีเดียวกัน
 */
import type { TwoPick, DigitDetail, Drill, DrillSet } from "@/lib/digits";

export const DOW_BASE = { days: 6732, star: 0.358, two: 0.631, randomStar: 0.344, randomTwo: 0.59 } as const;

const DIGITS = "0123456789".split("");
const DRILL_PER_DIGIT = 6;
type Outcome = { top: string; bottom: string; set: Set<string>; w: number };

const cents = (x: number) => Math.round(Math.abs(x) * 100) % 100;
const r9 = (x: number) => Math.round(x * 1e9);

/** ทุกกรณีของวันนี้ (น้ำหนักเท่ากัน): บน 00–99 × ขึ้น/ลง */
const cache = new Map<number, Outcome[]>();
function outcomes(D: number): Outcome[] {
  const hit = cache.get(D);
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
  cache.set(D, out);
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

const pAny = (O: Outcome[], digits: string[]) => O.reduce((s, o) => s + (digits.some((d) => o.set.has(d)) ? o.w : 0), 0);

/** เจาะ 2 ชุด × 6: เลือกทีละตัวให้ "อย่างน้อย 1 ใน 12 ตัวมา" สูงสุด (เลี่ยงเลขที่มาในกรณีเดียวกัน) · กลับได้ */
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

/** ชุดวิน 6 ตัว: ต้องมี ★ แล้วเลือกอีก 5 ตัวให้ "บน หรือ ล่าง อยู่ครบในชุด" บ่อยสุด */
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
 * ฟัน 2 ตัว + เจาะ 2×6 ของดาวโจนส์
 *   ★ = เลขที่โอกาสโผล่ (จาก D) สูงสุด · ตัวรอง = ตัวที่ทำให้ "อย่างน้อย 1 ใน 2 มา" สูงสุด · เสมอกัน → เลขมากก่อน (ผลทดสอบหัวไฟล์)
 *   ไม่ใช้ประวัติ (ทุกกฎที่ใช้ประวัติดาวโจนส์ไม่ชนะ "เลขมากก่อน" ทั้งสองครึ่ง) — รับ history ไว้ให้หน้าตาเหมือนสูตรอื่น
 */
export function pickDowJones(openValue: number, openChange: number, history: unknown[] = []): TwoPick {
  void history;
  const D = cents(openValue - openChange);
  const O = outcomes(D);
  const tie = (d: string) => Number(d);
  const details = DIGITS.map((d) => detail(O, d)).sort((x, y) => r9(y.p) - r9(x.p) || tie(y.digit) - tie(x.digit));
  const first = details[0];
  const rank = (chosen: string[]) => details
    .filter((d) => !chosen.includes(d.digit))
    .map((d) => ({ d, any: pAny(O, [...chosen, d.digit]) }))
    .sort((x, y) => r9(y.any) - r9(x.any) || tie(y.d.digit) - tie(x.d.digit))[0];
  const second = rank([first.digit]);
  const third = rank([first.digit, second.d.digit]);
  const fourth = rank([first.digit, second.d.digit, third.d.digit]);
  return {
    digits: [first, second.d],
    standout: first,
    standoutRate: first.p,
    pAny: second.any,
    pBoth: O.reduce((s, o) => s + (o.set.has(first.digit) && o.set.has(second.d.digit) ? o.w : 0), 0),
    third: third.d,
    pAny3: third.any,
    fourth: fourth.d,
    pAny4: fourth.any,
    win: winSet(O, first.digit),
    tiedWithMain: details.filter((d) => r9(d.p) === r9(first.p)).map((d) => d.digit),
    drill: drill(O, first.digit, second.d.digit),
    pDouble: O.reduce((s, o) => s + (o.top[0] === o.top[1] || o.bottom[0] === o.bottom[1] ? o.w : 0), 0),
  };
}
