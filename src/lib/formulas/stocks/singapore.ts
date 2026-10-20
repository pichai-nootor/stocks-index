/**
 * สูตรของ "หุ้นสิงคโปร์ (ปกติ)" — เครื่องคิดของสิงคโปร์เอง ไม่ใช้เครื่องกลาง (digits.ts pickTwo / ฐาน SENSEX) และไม่ใช้สูตรหุ้นตัวอื่น
 *
 * สูตรคำนวณ (ผู้ใช้สั่ง 21 ต.ค. 69: ผสานข้อดีของสูตรตาราง D กับการวิเคราะห์ % — คิดจากราคาเปิด, ราคาที่เปลี่ยน, % และปิดย้อนหลัง)
 *   1) D = ทศนิยมปิดทางการวันก่อน → ตารางคู่ 200 แบบ: ปิดบวก ล่าง = บน − D · ปิดลบ ล่าง = D − บน (ผลจริงเข้าตาราง 593/595)
 *   2) % ปิดงวดก่อน + % เปิดวันนี้ → 40 วันในอดีตของสิงคโปร์ที่ใกล้ที่สุด → โอกาสปิดบวก + ช่วงราคาปิด (จากราคาเปิด)
 *      ข้อมูล 10 ปี: เปิด +0.1–0.3% ปิดบวก 68% · +0.3–0.6% 80% · >+0.6% 90% (ฝั่งลบกลับกัน) · หลังเปิดแล้วขึ้น/ลงต่อ ≈ 50:50
 *   3) ถ่วงตารางด้วยทิศ: คู่ตารางเขียว × โอกาสปิดบวก · คู่ตารางแดง × โอกาสปิดลบ
 *      % บอกทศนิยมเองไม่ได้ — ราคาปิดห่างจากเปิดหลายสิบจุด (คลาดกลาง ๆ ~12 จุด) ทศนิยมจึงกระจายเท่ากัน → ใช้ % แค่บอกทิศ
 *   4) โอกาสของเลข 0–9 จากน้ำหนักนี้ → ★ สูงสุด · ตัวรอง = "อย่างน้อย 1 ใน 2 มา" สูงสุด · เจาะ/วิน จากน้ำหนักเดียวกัน
 *   5) เสมอกัน → เลขที่ไม่ได้ออกงวดก่อนมาก่อน → เลขที่โผล่บ่อยในราคาที่น่าจะปิด (ผู้ใช้เลือก 21 ต.ค. 69 แทน "เลขมากก่อน")
 *      ราคาที่น่าจะปิด = ทุกราคาก่อนปัดเศษที่ให้ % ปิด (ปัด 2 ตำแหน่ง) เท่ากับ 40 วันที่คล้าย · คิดจากปิดวันก่อนของวันนี้
 *   ข้อมูล: ^STI ปิดทางการ (ตรงกับ investing) 21 ต.ค. 59 → 19 ต.ค. 69 ใน src/data/sgx-10y.json + แถวในแอปหลังวันนั้น
 *
 * ตรวจย้อนหลัง (ใช้แค่เช็กว่าไม่แย่ลง · A = ต.ค. 60–ก.ย. 64 · B = ต.ค. 64–ต.ค. 69 · ใช้เฉพาะวันก่อนหน้า):
 *   สูตรนี้             2 ตัว A 61.3 / B 65.0 · เจาะเข้า 45.1 / 47.2 · เงินรูด+เจาะ −65 / +76 ต่องวด
 *   ถ้าขั้น 5 ใช้ "เลขมากก่อน"  63.5 / 65.0 · 46.5 / 48.5 · +7 / +104 — ย้อนหลังดีกว่า แต่ 9-8 ซ้ำ (94% ของงวด ★ ตัดสินด้วยเลขมาก)
 *     ผู้ใช้เลือกขั้น 5 จากการวิเคราะห์ % แทน ทั้งที่รู้ว่าครึ่ง A ย้อนหลังแย่กว่า
 *   ตาราง D ไม่ถ่วงทิศ  63.8 / 64.6 · 45.9 / 47.9 · +5 / +80 (สูตรวันแรก)
 *   เลขที่โผล่บ่อยในช่วง % (ไล่ราคาก่อนปัด)  61.5 / 64.2 — เอามาตัดเลขทำให้ครึ่ง A แย่ลงทุกแบบ จึงไม่ใช้
 *   ตัดสินจากผลจริงที่ล็อกไว้ (รายงานสิ้นเดือน) ไม่ใช่ผลย้อนหลัง
 */
import { type TwoPick, type DigitDetail, type Drill, type DrillSet, top2, bottom2 } from "@/lib/digits";
import raw from "@/data/sgx-10y.json";

type Row = { date: Date; openValue: number; openChange: number; closeValue: number | null; closeChange: number | null };

const DIGITS = "0123456789".split("");
const DRILL_PER_DIGIT = 6;
const SIMILAR = 40;
type Outcome = { top: string; bottom: string; set: Set<string>; w: number; up: boolean };

const r9 = (x: number) => Math.round(x * 1e9);
const r2 = (x: number) => Math.round(x * 100) / 100;
const two = (n: number) => String(((n % 100) + 100) % 100).padStart(2, "0");

/** วันในอดีต: % ปิดงวดก่อน · % เปิด · % ปิด · ปิดเทียบเปิด (%) */
type PctDay = { date: string; pp: number | null; op: number; cp: number; fo: number };
const DATA_UNTIL = "2026-10-19";
const day = (date: string, o: number, oc: number, c: number, cc: number) => ({ date, op: (oc / (o - oc)) * 100, cp: (cc / (c - cc)) * 100, fo: ((c - o) / (o - oc)) * 100 });
/** [วันที่, เปิด, เปิด − ปิดวันก่อน, ปิด, ปิด − ปิดวันก่อน] */
const BASE = (raw as [string, number, number, number, number][]).map(([d, o, oc, c, cc]) => day(d, o, oc, c, cc));

/** วันในอดีตที่ใช้ได้ ณ งวดนี้: ข้อมูล 10 ปีถึงวันสุดท้ายของ history + แถวในแอปหลัง DATA_UNTIL (ไม่เห็นอนาคต) */
function pctDays(history: Row[]): PctDay[] {
  const closed = history.filter((r) => r.closeValue != null && r.closeChange != null);
  const cutoff = closed.length ? closed[closed.length - 1].date.toISOString().slice(0, 10) : "9999";
  const app = closed.map((r) => day(r.date.toISOString().slice(0, 10), r.openValue, r.openChange, r.closeValue!, r.closeChange!)).filter((r) => r.date > DATA_UNTIL);
  const all = [...BASE.filter((r) => r.date <= cutoff), ...app];
  return all.map((r, i) => ({ ...r, pp: i ? all[i - 1].cp : null }));
}

/**
 * ขั้น 2: วิเคราะห์ % ของวันนี้ — 40 วันที่ % ปิดงวดก่อน + % เปิด ใกล้ที่สุด
 *   pUp = สัดส่วนที่ปิดบวก (เทียบปิดวันก่อน) · ช่วงปิด = ราคาเปิด × (1 + ปิดเทียบเปิด 25%–75% ของวันเหล่านั้น)
 */
export function singaporeAnalysis(openValue: number, openChange: number, history: Row[]) {
  const prevClose = r2(openValue - openChange);
  const days = pctDays(history);
  const prevPct = days.length ? days[days.length - 1].cp : null, openPct = (openChange / prevClose) * 100;
  const dist = (d: PctDay) => (prevPct === null || d.pp === null ? Math.abs(d.op - openPct) : Math.hypot(d.pp - prevPct, d.op - openPct));
  const similar = days.filter((d) => d.op !== 0).sort((a, b) => dist(a) - dist(b)).slice(0, SIMILAR);
  const fo = similar.map((d) => d.fo).sort((a, b) => a - b);
  const q = (f: number) => r2(openValue + prevClose * (fo[Math.floor(f * (fo.length - 1))] / 100));
  // เลข 0–9 โผล่บ่อยแค่ไหนในทุกราคาก่อนปัดเศษของ % ปิดของวันที่คล้าย (บน = ทศนิยมราคา · ล่าง = ทศนิยม(ราคา − ปิดวันก่อน))
  const P = Math.round(prevClose * 100), digitW = new Array(10).fill(0);
  for (const d of similar) {
    const p = Math.round(d.cp * 100) / 100;
    const lo = Math.ceil(prevClose * (1 + (p - 0.005) / 100) * 100), hi = Math.floor(prevClose * (1 + (p + 0.005) / 100) * 100);
    for (let c = lo; c <= hi; c++) for (const x of new Set(two(c) + two(Math.abs(c - P)))) digitW[Number(x)] += 1 / similar.length / (hi - lo + 1);
  }
  return { prevClose, prevPct, openPct, n: similar.length, pUp: similar.filter((d) => d.cp > 0).length / similar.length, lo: q(0.25), hi: q(0.75), digitW };
}

/** ขั้น 1+3: ตารางคู่ 200 แบบจาก D ถ่วงด้วยทิศ (บน 00–99 เท่ากัน) */
function outcomes(D: number, pUp: number): Outcome[] {
  const out: Outcome[] = [];
  for (let t = 0; t < 100; t++) {
    const top = two(t);
    for (const up of [true, false]) {
      const bottom = two(up ? t - D : D - t);
      out.push({ top, bottom, set: new Set(top + bottom), w: (up ? pUp : 1 - pUp) / 100, up });
    }
  }
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

/** เจาะ 2 ชุด × 6: เลือกทีละตัวให้ "อย่างน้อย 1 ใน 12 ตัวมา" สูงสุดในราคาชุดเดียวกัน (เลี่ยงเลขที่มาในกรณีเดียวกัน) · กลับได้ */
function drill(O: Outcome[], a: string, b: string): Drill {
  const canon = (m: string) => (m[0] <= m[1] ? m : m[1] + m[0]);
  const keys = O.map((o) => [canon(o.top), canon(o.bottom)]);
  const own = (m: string) => { const c = canon(m); return O.reduce((s, o, i) => s + (keys[i][0] === c || keys[i][1] === c ? o.w : 0), 0); };
  const covered = new Array(O.length).fill(false);
  let total = 0;
  const cands = [...DIGITS.filter((x) => x !== a).map((x) => a + x), ...DIGITS.filter((x) => x !== a && x !== b).map((x) => b + x)];
  const chosen: string[] = [];
  while (chosen.length < 2 * DRILL_PER_DIGIT) {
    let best: { m: string; p: number; own: number } | null = null;
    for (const m of cands) {
      if (chosen.filter((c) => c[0] === m[0]).length >= DRILL_PER_DIGIT || chosen.some((c) => canon(c) === canon(m))) continue;
      const c = canon(m);
      const p = total + O.reduce((s, o, i) => s + (!covered[i] && (keys[i][0] === c || keys[i][1] === c) ? o.w : 0), 0), mine = own(m);
      if (!best || r9(p) > r9(best.p) || (r9(p) === r9(best.p) && r9(mine) > r9(best.own))) best = { m, p, own: mine };
    }
    if (!best) break;
    chosen.push(best.m);
    total = best.p;
    const c = canon(best.m);
    keys.forEach((k, i) => { if (k[0] === c || k[1] === c) covered[i] = true; });
  }
  const anyOf = (nums: string[]) => { const cs = new Set(nums.map(canon)); return O.reduce((s, o, i) => s + (cs.has(keys[i][0]) || cs.has(keys[i][1]) ? o.w : 0), 0); };
  const set = (d: string): DrillSet => {
    const nums = chosen.filter((m) => m[0] === d);
    return { digit: d, numbers: nums.map((m) => ({ number: m, p: own(m) })), pAny: anyOf(nums) };
  };
  return { sets: [set(a), set(b)], pAny: anyOf(chosen) };
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
 * ฟัน 2 ตัว + เจาะ 2×6 ของสิงคโปร์ — สูตรคำนวณหัวไฟล์ (ตาราง D ถ่วงทิศจาก % · เสมอ → ไม่ใช่เลขงวดก่อน → เลขที่โผล่บ่อยในช่วง %)
 *   history = งวดที่ปิดแล้วก่อนวันนี้ (เรียงเก่า → ใหม่)
 */
export function pickSingapore(openValue: number, openChange: number, history: Row[] = []): TwoPick {
  const a = singaporeAnalysis(openValue, openChange, history);
  const O = outcomes(Math.round(a.prevClose * 100) % 100, a.pUp);
  const last = [...history].reverse().find((r) => r.closeValue != null && r.closeChange != null);
  const prev = new Set(last ? top2(last.closeValue!) + bottom2(last.closeChange!) : "");
  // มาก = มาก่อน: ไม่ใช่เลขงวดก่อน → น้ำหนักในช่วง % (≤ 1) → เลขมาก (เฉพาะกรณีเท่ากันเป๊ะ)
  const tie = (d: string) => (prev.has(d) ? 0 : 10) + r9(a.digitW[Number(d)]) / 1e9 + Number(d) * 1e-12;
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
