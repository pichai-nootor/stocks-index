/**
 * สนามทดลองสูตร: ให้ผู้ใช้ประกอบสูตรจาก "ตัวเปิด" เอง แล้ววัดกับประวัติจริงทันที
 * (ข้อมูลของหุ้นที่บันทึกไว้ + SENSEX 10 ปีที่แนบมากับแอป) เพื่อดูว่าสูตรนั้นเหนือสุ่มไหม
 */
import { top2, bottom2, uniqueDigits, randomAtLeastOne } from "./digits";
import type { RecordLike } from "./stats";

export const TERMS = {
  oT1: "บน หลักสิบ (ทศนิยมตัวแรกของดัชนีเปิด)",
  oT2: "บน หลักหน่วย (ทศนิยมตัวที่สองของดัชนีเปิด)",
  oB1: "ล่าง หลักสิบ (ทศนิยมตัวแรกของจุดที่เปลี่ยน)",
  oB2: "ล่าง หลักหน่วย (ทศนิยมตัวที่สองของจุดที่เปลี่ยน)",
  D1: "D หลักสิบ (ทศนิยมปิดเมื่อวาน)",
  D2: "D หลักหน่วย (ทศนิยมปิดเมื่อวาน)",
  oUnit: "หลักหน่วยของดัชนีเปิด (74,24[9])",
  oTen: "หลักสิบของดัชนีเปิด (74,2[4]9)",
  oHun: "หลักร้อยของดัชนีเปิด (74,[2]49)",
  ocUnit: "หลักหน่วยของจุดที่เปลี่ยน (24[5])",
  ocTen: "หลักสิบของจุดที่เปลี่ยน (2[4]5)",
  ocHun: "หลักร้อยของจุดที่เปลี่ยน ([2]45)",
  pT1: "ปิดเมื่อวาน บน หลักสิบ",
  pT2: "ปิดเมื่อวาน บน หลักหน่วย",
  pB1: "ปิดเมื่อวาน ล่าง หลักสิบ",
  pB2: "ปิดเมื่อวาน ล่าง หลักหน่วย",
} as const;
export type Term = keyof typeof TERMS;

export const OPS = {
  pick: "เอาเลขเหล่านี้มาฟันตรง ๆ (โผล่อย่างน้อย 1)",
  sum: "บวกกันแล้ว mod 10 → ได้ 1 เลข",
  diff: "ลบกัน (ค่าสัมบูรณ์ของ 2 ตัวแรก) → ได้ 1 เลข",
  prod: "คูณกันแล้ว mod 10 → ได้ 1 เลข",
  plus5: "ตัวแรก +5 mod 10 → ได้ 1 เลข",
  minus9: "9 − ตัวแรก → ได้ 1 เลข",
} as const;
export type Op = keyof typeof OPS;

const intDigit = (x: number, pos: number) => Math.floor(Math.abs(x) / 10 ** pos) % 10;

function termValue(t: Term, r: RecordLike, prev: RecordLike | null): number | null {
  const oT = top2(r.openValue), oB = bottom2(r.openChange);
  const D = top2(r.openValue - r.openChange);
  switch (t) {
    case "oT1": return Number(oT[0]); case "oT2": return Number(oT[1]);
    case "oB1": return Number(oB[0]); case "oB2": return Number(oB[1]);
    case "D1": return Number(D[0]); case "D2": return Number(D[1]);
    case "oUnit": return intDigit(r.openValue, 0); case "oTen": return intDigit(r.openValue, 1); case "oHun": return intDigit(r.openValue, 2);
    case "ocUnit": return intDigit(r.openChange, 0); case "ocTen": return intDigit(r.openChange, 1); case "ocHun": return intDigit(r.openChange, 2);
    case "pT1": return prev ? Number(top2(prev.closeValue)[0]) : null;
    case "pT2": return prev ? Number(top2(prev.closeValue)[1]) : null;
    case "pB1": return prev ? Number(bottom2(prev.closeChange)[0]) : null;
    case "pB2": return prev ? Number(bottom2(prev.closeChange)[1]) : null;
  }
}

/** เลขที่สูตรให้สำหรับวันนั้น (null = คำนวณไม่ได้ เช่น ไม่มีเมื่อวาน) */
export function applyRule(terms: Term[], op: Op, r: RecordLike, prev: RecordLike | null): string[] | null {
  const vals = terms.map((t) => termValue(t, r, prev));
  if (!vals.length || vals.some((v) => v === null)) return null;
  const v = vals as number[];
  switch (op) {
    case "pick": return [...new Set(v.map(String))];
    case "sum": return [String(v.reduce((a, b) => a + b, 0) % 10)];
    case "diff": return v.length >= 2 ? [String(Math.abs(v[0] - v[1]))] : null;
    case "prod": return [String(v.reduce((a, b) => a * b, 1) % 10)];
    case "plus5": return [String((v[0] + 5) % 10)];
    case "minus9": return [String(9 - v[0])];
  }
}

export type LabResult = {
  n: number;
  hits: number;        // วันที่โผล่อย่างน้อย 1
  rate: number;
  random: number;      // สุ่มเลขจำนวนเท่ากัน
  avgDigits: number;   // สูตรให้กี่เลขต่อวัน
  firstHalf: number;   // อัตราครึ่งแรก / ครึ่งหลัง (ดูว่าเสถียรไหม)
  secondHalf: number;
  recent: { date: Date; predicted: string[]; actual: string[]; hit: boolean }[];
};

export function evaluateRule(terms: Term[], op: Op, records: RecordLike[]): LabResult {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const rows: { date: Date; predicted: string[]; actual: string[]; hit: boolean }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = applyRule(terms, op, sorted[i], i ? sorted[i - 1] : null);
    if (!p) continue;
    const actual = uniqueDigits(top2(sorted[i].closeValue) + bottom2(sorted[i].closeChange));
    rows.push({ date: sorted[i].date, predicted: p, actual, hit: p.some((d) => actual.includes(d)) });
  }
  const n = rows.length, hits = rows.filter((x) => x.hit).length;
  const half = Math.floor(n / 2);
  const rateOf = (xs: typeof rows) => (xs.length ? xs.filter((x) => x.hit).length / xs.length : 0);
  // สุ่ม: เฉลี่ยตามจำนวนเลขที่สูตรให้ในแต่ละวัน
  const random = n ? rows.reduce((s, x) => s + randomAtLeastOne([x.actual.length], x.predicted.length), 0) / n : 0;
  return {
    n, hits, rate: n ? hits / n : 0, random,
    avgDigits: n ? rows.reduce((s, x) => s + x.predicted.length, 0) / n : 0,
    firstHalf: rateOf(rows.slice(0, half)), secondHalf: rateOf(rows.slice(half)),
    recent: rows.slice(-10).reverse(),
  };
}

/** SENSEX 10 ปีที่แนบมากับแอป ([date, open, openChange, close, closeChange]) */
import raw from "@/data/sensex-10y.json";
export const SENSEX_10Y: RecordLike[] = (raw as [string, number, number, number, number][]).map(([d, o, oc, c, cc]) => ({ date: new Date(d), openValue: o, openChange: oc, closeValue: c, closeChange: cc }));
