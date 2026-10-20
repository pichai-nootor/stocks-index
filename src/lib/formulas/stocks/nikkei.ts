/**
 * สูตรของ "หุ้นนิเคอิ (ปกติ)" — ไฟล์ของนิเคอิ: ค่าอ้างอิง/หลักฐานของหุ้นตัวนี้ และตั้งค่าเฉพาะตัว
 * ข้อมูล: ราคาจริง Nikkei 225 จาก Yahoo (src/lib/stocks/nikkei.ts) — รอบเช้า = ปิดภาคเช้า 11:30 JST, รอบบ่าย = ปิดวัน 15:30 JST
 *
 * เครื่องคิด: ใช้เครื่องไล่กรณีเดียวกับ SENSEX (ล่าง = ทศนิยม(ปิด − ปิดวันก่อน) → รู้ D ตั้งแต่เช้า → ไล่ 200 กรณี)
 *   เพราะเป็นดัชนีจริง โครงสร้างนี้เป็นคณิตศาสตร์ ไม่ใช่สมมติฐาน (ตรวจกับผลหวยนิเคอิ 2565–2569: ตรง 98%)
 *   ทิศทางปิด: เครื่องผสมฐาน SENSEX (น้ำหนัก 30 วัน) กับประวัติของหุ้นนี้เอง — นิเคอิมี 2,442 วัน จึงใช้สถิติของตัวเองเป็นหลัก
 *   → ไม่มีโค้ดสูตรซ้ำในไฟล์นี้ (ไม่แตะ digits.ts) มีแต่ค่าอ้างอิงของนิเคอิเพื่อเทียบบนหน้าจอ/เอกสาร
 *
 * หลักฐานของนิเคอิเอง (walk-forward บนปิดวัน 2,412 วัน, 2016-09 → 2026-09):
 *   ตัวหลัก 34.9% (สุ่ม 34.4) · 2 ตัว ≥1 62.2% (สุ่ม 59.1) · คู่ผูกครบ 16.8% (สุ่ม ~10) · เจาะ 12 เลข 45.5% (สุ่ม ~42)
 *   → เลขเดี่ยวของนิเคอิ "อ่อน" กว่า SENSEX (36%) แต่คู่ผูกกับ 2 ตัวยังได้แต้มต่อจากโครงสร้างเหมือนกัน
 *   ทิศทางปิดตามช่องว่างเปิด (นิเคอิ): ≥1% ปิดทางเดียวกับที่เปิด 96–97% · ≥0.5% 87–88% · ≥0.25% 74–76% · ≥0.1% 61–62% · <0.1% 51–54%
 *   (ต่างจาก SENSEX ที่เปิดลบเชื่อถือได้กว่าเปิดบวก — นิเคอิสองทางเท่ากัน และช่องว่าง ≥1% แม่นกว่า SENSEX มาก)
 *   คู่ผูก (ต้องมาครบทั้งคู่) วัดใหม่ 23 ก.ย. 69 บนข้อมูลในแอป: บ่าย 18.3% (2,442 งวด) · วันที่โมเดลให้ ≥23.5% ถูกจริง 24.8% (270 งวด) — เท่าอียิปต์ (คณิตศาสตร์เดียวกัน)
 *   รอบเช้ามีข้อมูลแค่ 60 วัน (Yahoo ให้แท่ง 5 นาทีย้อนหลังจำกัด) ยังสรุปไม่ได้ — สะสมต่อวันละ 1 แถวอัตโนมัติ
 *
 * ทดสอบรอบบ่าย 12 ต.ค. 69 (ข้อมูล Yahoo ^N225 ในโฟลเดอร์ทดลอง — ไม่แตะข้อมูลในแอป):
 *   เปิดภาคบ่าย (12:30 JST) บอกทิศปิดถูก 87.8% แต่ใส่ทิศเข้าไปแล้วเลขฟันแทบไม่เปลี่ยน (★ 38.7 เท่าเดิม · 2 ตัว 64.1→64.2)
 *     แม้รู้ทิศจริงล่วงหน้า ★ ก็ไม่ดีขึ้น (36.8%) — ★ เสมอกันหลายตัว 96% ของงวด ตัวตัดสินคือกติกาเสมอ ไม่ใช่ทิศ
 *   กติกาเสมอ 10 ปี: เลขมาก (ตอนนี้) ★34.9 · เลขน้อย 34.6 · ออกบ่อย 37.0 · ออกน้อย 34.7 — "ออกบ่อย" ชนะรวมแต่แพ้ช่วง 2023–26 → ไม่เปลี่ยน
 */
import { pickTwo, type TwoPick, type DigitDetail, type Drill, type DrillSet } from "@/lib/digits";
import amRaw from "@/data/nikkei-am-3y.json";
import type { RecordLike } from "@/lib/stats";
import type { NikkeiSession } from "@/lib/stocks/nikkei";
export const NIKKEI_BASE = {
  pm: { days: 2412, star: 0.349, two: 0.622, pairBoth: 0.168, drill: 0.455, randomStar: 0.344, randomTwo: 0.591 },
  am: { days: 30, star: 0.267, two: 0.5, note: "ข้อมูลน้อย ยังสรุปไม่ได้" },
  directionSame: [
    { minPct: 1.0, up: 0.97, down: 0.96 },
    { minPct: 0.5, up: 0.88, down: 0.87 },
    { minPct: 0.25, up: 0.76, down: 0.74 },
    { minPct: 0.1, up: 0.61, down: 0.62 },
    { minPct: 0, up: 0.54, down: 0.51 },
  ],
} as const;

/** เกณฑ์ "งวดคู่ผูกแข็ง" ของนิเคอิ — ค่าเดียวกับอียิปต์เพราะมาจากโครงสร้าง D ไม่ใช่จากพฤติกรรมตลาด (บ่าย: วันแบบนี้ 24.8% เทียบ 18.3% ปกติ) */
export const NIKKEI_PAIR_STRONG = 0.235;
export const NIKKEI_PAIR_BASE = { pm: { both: 0.183, strong: 0.248, strongDays: 270, days: 2442 }, am: { both: 0.150, days: 60 } } as const;

/** เวลาออกผล (ไทย) ของแต่ละรอบ — ไว้แสดง/เตือนบนหน้าจอ */
export const NIKKEI_CLOSE_THAI = { am: "09:30", pm: "13:30" } as const;

/**
 * ฟันของหุ้นนิเคอิ (เช้า/บ่าย) — เครื่องไล่ 200 กรณีจาก D · กฎของนิเคอิอยู่ที่นี่ที่เดียว (แก้นิเคอิแก้ไฟล์นี้ ไม่กระทบหุ้นอื่น)
 *   เช้า: pickNikkeiAm (ด้านล่าง · ตั้งแต่ 21 ต.ค. 69) — ตาราง D ถ่วงทิศจาก % เปิด + % ปิดเช้างวดก่อน · เลขเสมอ → เลขมากก่อน
 *   บ่าย: เลขเสมอ → เลขที่ออกรอบเช้าวันเดียวกันก่อน ทั้งตัวหลักและตัวรอง (13 ต.ค. 69 · ทดสอบกับข้อมูลนิเคอิเอง · ใช้กับทุกงวดรวมย้อนหลัง)
 *     ทดสอบ 729 งวด (~3 ปี Yahoo ปิดเช้า + เปิดบ่าย · ครึ่ง A / B): 2 ตัว 66.8→70.1 / 62.2→64.7 · เจาะ 52.2→54.1 / 44.1→47.1
 *       กำไร/งวด +196→+328 / −102→+30 · ★ 38.2→39.8 / 39.2→36.2 (สลับกัน)
 *     ยังไม่มีผลเช้า → amWait (ยังไม่ใช่เลขจริง ห้ามโชว์เป็นเลขฟัน)
 */
export function pickNikkei(openValue: number, openChange: number, history: RecordLike[], session: NikkeiSession, amOfDay: string[] | undefined): TwoPick & { amWait?: boolean } {
  if (session === "am") return pickNikkeiAm(openValue, openChange, history);
  return amOfDay ? pickTwo(openValue, openChange, history, (d) => (amOfDay.includes(d) ? 1 : 0)) : { ...pickTwo(openValue, openChange, history), amWait: true };
}

/* ---------- รอบเช้า: ตาราง D ถ่วงทิศจาก % (ผู้ใช้สั่งใช้ทันที 21 ต.ค. 69: "ใช้เลย เพราะตอนนี้แย่มาก") ---------- */
/**
 * ผลจริงที่ล็อกก่อนเปลี่ยน (29 ก.ย. – 20 ต.ค. 69, 18 งวด): 2 ตัวเข้า 44% · เจาะ 39% · −12,640 บาท
 * สูตรคำนวณ:
 *   1) D = ทศนิยมปิดทางการวันก่อน → ตารางคู่ 200 แบบ (ปิดบวก ล่าง = บน − D · ปิดลบ ล่าง = D − บน)
 *   2) % ปิดเช้างวดก่อน + % เปิดวันนี้ → 40 วันในอดีตของนิเคอิเช้าที่ใกล้ที่สุด → โอกาสปิดเช้าบวก
 *      ข้อมูล 3 ปี: เปิด +0.5–1% ปิดเช้าบวก 90% · >+1% 100% · −1 ถึง −0.5% 11% · หลังเปิดแกว่ง ~150–350 จุด
 *   3) ถ่วงตาราง: คู่ตารางเขียว × โอกาสปิดบวก · คู่ตารางแดง × โอกาสปิดลบ · บน 00–99 เท่ากัน
 *      % บอกทศนิยมไม่ได้: %ปิดคาด ≈ 1.56 × %เปิด คลาดจริงกลาง ๆ ~210 จุด (0.01% ≈ 6.5 จุด)
 *   4) ★ = โอกาสสูงสุด · ตัวรอง = "อย่างน้อย 1 ใน 2 มา" สูงสุด · เจาะ/วิน จากน้ำหนักเดียวกัน · เสมอ → เลขมากก่อน
 * ตรวจย้อนหลังบนนิเคอิเช้าเอง (IndexDay nk-am 732 วัน · A ก่อน 16 เม.ย. 68 / B หลัง · ใช้เฉพาะวันก่อนหน้า):
 *   สูตรนี้ 2 ตัว 61.1 / 59.8 · เจาะ 50.0 / 46.4 · เงิน +122 / −54 ต่องวด
 *   ตาราง D ไม่ถ่วง + เลขมาก (ใกล้สูตรเดิม) 60.6 / 59.8 · 49.1 / 46.7 · +94 / −59 · สุ่ม ~59
 *   หลบเลขงวดก่อน (แบบสิงคโปร์) 56.0 / 56.8 · ตัดเสมอด้วยช่วง % 55.6 / 60.4 · −295 / −92 → แย่ลง ไม่ใช้
 *   เลขเปิดโผล่ในผลปิด 34.3% = เลขสุ่ม 34.2% → เลขเปิดไม่บอกเลขปิด
 *   ยังชนะสุ่มแค่เล็กน้อย — ตัดสินจากผลจริงที่ล็อก
 */
const AM_DIGITS = "0123456789".split("");
const AM_SIMILAR = 40;
const AM_DATA_UNTIL = "2026-10-19";
type AmOutcome = { top: string; bottom: string; set: Set<string>; w: number };
type AmRow = { date: Date; openValue: number; openChange: number; closeValue: number | null; closeChange: number | null };
const amR9 = (x: number) => Math.round(x * 1e9);
const amTwo = (n: number) => String(((n % 100) + 100) % 100).padStart(2, "0");
const amDay = (date: string, o: number, oc: number, c: number, cc: number) => ({ date, op: (oc / (o - oc)) * 100, cp: (cc / (c - cc)) * 100 });
/** [วันที่, เปิด, เปิด − ปิดวันก่อน, ปิดเช้า, ปิดเช้า − ปิดวันก่อน] จาก IndexDay nk-am */
const AM_BASE = (amRaw as [string, number, number, number, number][]).map(([d, o, oc, c, cc]) => amDay(d, o, oc, c, cc));

/** ขั้น 2: โอกาสปิดเช้าบวกจาก 40 วันที่ % ปิดเช้างวดก่อน + % เปิด ใกล้ที่สุด (เฉพาะวันก่อนงวดนี้) */
export function nikkeiAmAnalysis(openValue: number, openChange: number, history: AmRow[]) {
  const closed = history.filter((r) => r.closeValue != null && r.closeChange != null);
  const cutoff = closed.length ? closed[closed.length - 1].date.toISOString().slice(0, 10) : "9999";
  const app = closed.map((r) => amDay(r.date.toISOString().slice(0, 10), r.openValue, r.openChange, r.closeValue!, r.closeChange!)).filter((r) => r.date > AM_DATA_UNTIL);
  const all = [...AM_BASE.filter((r) => r.date <= cutoff), ...app];
  const days = all.map((r, i) => ({ ...r, pp: i ? all[i - 1].cp : null }));
  const prevPct = days.length ? days[days.length - 1].cp : null, openPct = (openChange / (openValue - openChange)) * 100;
  const dist = (d: (typeof days)[number]) => (prevPct === null || d.pp === null ? Math.abs(d.op - openPct) : Math.hypot(d.pp - prevPct, d.op - openPct));
  const similar = days.filter((d) => d.op !== 0).sort((a, b) => dist(a) - dist(b)).slice(0, AM_SIMILAR);
  return { prevPct, openPct, n: similar.length, pUp: similar.length ? similar.filter((d) => d.cp > 0).length / similar.length : 0.5 };
}

function amOutcomes(D: number, pUp: number): AmOutcome[] {
  const out: AmOutcome[] = [];
  for (let t = 0; t < 100; t++) {
    const top = amTwo(t);
    for (const up of [true, false]) {
      const bottom = amTwo(up ? t - D : D - t);
      out.push({ top, bottom, set: new Set(top + bottom), w: (up ? pUp : 1 - pUp) / 100 });
    }
  }
  return out;
}

function amDetail(O: AmOutcome[], digit: string): DigitDetail {
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

const amPAny = (O: AmOutcome[], digits: string[]) => O.reduce((s, o) => s + (digits.some((d) => o.set.has(d)) ? o.w : 0), 0);

/** เจาะ 2 ชุด × 6: เลือกทีละตัวให้ "อย่างน้อย 1 ใน 12 ตัวมา" สูงสุด (เลี่ยงเลขที่มาในกรณีเดียวกัน) · กลับได้ */
function amDrill(O: AmOutcome[], a: string, b: string): Drill {
  const canon = (m: string) => (m[0] <= m[1] ? m : m[1] + m[0]);
  const hits = (o: AmOutcome, m: string) => { const r = m[1] + m[0]; return o.top === m || o.top === r || o.bottom === m || o.bottom === r; };
  const any = (nums: string[]) => O.reduce((s, o) => s + (nums.some((m) => hits(o, m)) ? o.w : 0), 0);
  const cands = [...AM_DIGITS.filter((x) => x !== a).map((x) => a + x), ...AM_DIGITS.filter((x) => x !== a && x !== b).map((x) => b + x)];
  const chosen: string[] = [];
  while (chosen.length < 12) {
    let best: { m: string; p: number; own: number } | null = null;
    for (const m of cands) {
      if (chosen.filter((c) => c[0] === m[0]).length >= 6 || chosen.some((c) => canon(c) === canon(m))) continue;
      const p = any([...chosen, m]), own = any([m]);
      if (!best || amR9(p) > amR9(best.p) || (amR9(p) === amR9(best.p) && amR9(own) > amR9(best.own))) best = { m, p, own };
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
function amWinSet(O: AmOutcome[], must: string, k = 6) {
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
    for (let i = start; i < 10; i++) go(i + 1, [...chosen, AM_DIGITS[i]]);
  };
  go(0, []);
  const b = best!, S = new Set(b.digits);
  return { digits: b.digits, pWin: b.p, pBoth: O.reduce((s, o) => s + (inSet(S, o.top) && inSet(S, o.bottom) ? o.w : 0), 0) };
}

/** ฟัน 2 ตัว + เจาะ 2×6 ของนิเคอิเช้า (สูตรคำนวณด้านบน) · history = งวดเช้าที่ปิดแล้วก่อนวันนี้ (เก่า → ใหม่) */
export function pickNikkeiAm(openValue: number, openChange: number, history: AmRow[]): TwoPick {
  const { pUp } = nikkeiAmAnalysis(openValue, openChange, history);
  const O = amOutcomes(Math.round(Math.abs(openValue - openChange) * 100) % 100, pUp);
  const tie = (d: string) => Number(d); // เลขมากก่อน
  const details = AM_DIGITS.map((d) => amDetail(O, d)).sort((x, y) => amR9(y.p) - amR9(x.p) || tie(y.digit) - tie(x.digit));
  const first = details[0];
  const rank = (chosen: string[]) => details
    .filter((d) => !chosen.includes(d.digit))
    .map((d) => ({ d, any: amPAny(O, [...chosen, d.digit]) }))
    .sort((x, y) => amR9(y.any) - amR9(x.any) || tie(y.d.digit) - tie(x.d.digit))[0];
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
    win: amWinSet(O, first.digit),
    tiedWithMain: details.filter((d) => amR9(d.p) === amR9(first.p)).map((d) => d.digit),
    drill: amDrill(O, first.digit, second.d.digit),
    pDouble: O.reduce((s, o) => s + (o.top[0] === o.top[1] || o.bottom[0] === o.bottom[1] ? o.w : 0), 0),
  };
}
