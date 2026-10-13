/**
 * สูตรของ "หุ้นเกาหลี VIP" (ออกผล 12:35 ไทย รอบเดียว) — ไฟล์นี้ใช้เฉพาะตลาดนี้ ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม = 34.4% ต่อเลข, 2 ตัว ≥1 = 59%
 *
 * หลักฐานจากประวัติ 1,356 งวด (25 พ.ย. 2565 → 19 ก.ย. 2569, raakaadee.com ตรงกับ API ของเว็บ) ออกทุกวัน:
 *   ▸ ฟีดเกาหลีไม่มีราคาเปิด (มีแค่ราคาปิด+diff ในช่อง results) และผล VIP ทุกตลาดที่ตรวจไม่ผูกกับราคาเปิด → ไม่ใช้ตัวเปิด
 *   ▸ นิสัยเครื่องเหมือนตลาดอื่น: บนเบิ้ล 93 ครั้ง (สุ่ม 136) · ล่างหยิบหลักจากบน 202/240 (สุ่ม 136) · ไม่ซ้ำงวดก่อน (1/3 vs 14)
 *     เลขร้อน 30 งวดออกซ้ำแค่ 28.5% (แย่กว่าสุ่มมาก) — เครื่องถ่วงดุลแรง
 *   ▸ ต่างจากจีน/ฮั่งเส็ง: ไม่มีเลขที่ออกน้อย/มากถาวรชัดเจน (0 = 31%, 5/8 = 35%, สลับกันระหว่างครึ่ง) และเลข 2 ตัวไม่เอียง (chi² 59 ≈ สุ่ม 54)
 *     → เกาหลีเดาจาก "ตัวเลข" ไม่ได้ ต้องเดาจาก "พฤติกรรม" อย่างเดียว
 * วิธีคิด: โมเดล logistic 45 ตัวแปรฝึกจากประวัติเกาหลีเอง · ทดสอบ expanding window 810 งวดนอกตัวอย่าง: ★ 36.2% · 2 ตัว ≥1 60.4% (สุ่ม 34.4 / 59.0)
 *   (โมเดลรวมจีน+ฮั่งเส็งที่ไม่เคยเห็นเกาหลีเลยทายได้ 35.4% — ยืนยันว่านิสัยเครื่องเหมือนกันทุกตลาด)
 * เลข 2 ตัว: เจาะจากเลขที่ฟัน เรียงตามความถี่ ตัดเบิ้ล ตัดเลขงวดก่อน (ความเอียงของเกาหลีอ่อน จึงเป็นแค่ "ไม่แย่กว่าสุ่ม")
 * น้ำหนักโมเดลอยู่ใน src/data/vip-history/kr-model.json
 */
import model from "@/data/vip-history/kr-model.json";
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const KR_MIN_HISTORY = 100;
export const KR_DRILL_PER_DIGIT = 6;
export const KR_BASE = { star: 0.362, any: 0.604, randomStar: 0.344, randomAny: 0.59 } as const;

type Draw = { top: string; bottom: string; round?: number; weekday?: number; date?: Date | string };
const W = model.coef as number[];
const B = model.intercept as number;

/** ฟีเจอร์ 45 ตัวของเลข d ณ งวดถัดไป — ต้องเรียงเหมือน ml.py เป๊ะ */
function features(history: VipDraw[], d: string, round: number, weekday: number): number[] {
  const n = history.length;
  const at = (j: number) => history[n - j]; // j = 1 คือ งวดก่อนหน้า
  const has = (h: VipDraw, x: string) => resultDigits(h.top, h.bottom).includes(x);
  const f: number[] = [];
  for (let j = 1; j <= 6; j++) f.push(has(at(j), d) ? 1 : 0);
  for (let j = 1; j <= 2; j++) { const h = at(j); const t = h.top.slice(-2), b = h.bottom; f.push(h.top[0] === d ? 1 : 0, t[0] === d ? 1 : 0, t[1] === d ? 1 : 0, b[0] === d ? 1 : 0, b[1] === d ? 1 : 0); }
  let c30 = 0, c100 = 0;
  for (let j = 1; j <= 100 && j <= n; j++) { if (has(at(j), d)) { c100++; if (j <= 30) c30++; } }
  f.push(c30, c100);
  let gap = 0;
  for (let j = 1; j < 200; j++) { if (j > n || has(at(j), d)) break; gap++; }
  f.push(Math.min(gap, 50));
  for (const x of DIGITS10) f.push(x === d ? 1 : 0);
  f.push(round);
  for (let w = 0; w < 7; w++) f.push(weekday === w ? 1 : 0);
  const p = at(1); const pt = p.top.slice(-2), pb = p.bottom; const di = Number(d);
  const n0 = (x: number) => ((x % 10) + 10) % 10;
  f.push(di === n0(Number(pt[0]) + Number(pt[1])) ? 1 : 0, di === n0(Number(pb[0]) + Number(pb[1])) ? 1 : 0, di === Math.abs(Number(pt[0]) - Number(pt[1])) ? 1 : 0, di === Math.abs(Number(pb[0]) - Number(pb[1])) ? 1 : 0,
    di === n0(Number(pt[1]) + 1) ? 1 : 0, di === n0(Number(pt[1]) - 1) ? 1 : 0, di === n0(Number(pb[1]) + 1) ? 1 : 0, di === n0(Number(pb[1]) - 1) ? 1 : 0);
  return f;
}

/** ค่าพยากรณ์ 0–1 ของเลข 0–9 สำหรับงวดถัดไป (เรียงมาก→น้อย) */
export function krScores(history: VipDraw[], round = 2, weekday = 1): { digit: string; p: number }[] {
  return DIGITS10.map((d) => { const x = features(history, d, round, weekday); const z = x.reduce((s, v, i) => s + v * W[i], B); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; }).sort((a, b) => b.p - a.p || b.digit.localeCompare(a.digit));
}

/** วันในสัปดาห์แบบ python (จันทร์ = 0) จากแถวประวัติ */
const weekdayOf = (d: Draw) => d.weekday ?? (d.date ? (new Date(d.date).getUTCDay() + 6) % 7 : 1);

/** งวดถัดไป: ถ้างวดสุดท้ายเป็นรอบเช้า → รอบบ่าย วันเดียวกัน; ถ้ารอบบ่าย → รอบเช้า วันถัดไป */
function nextRoundInfo(history: (VipDraw & Draw)[]): { round: number; weekday: number } {
  const last = history[history.length - 1] as Draw;
  const round = last.round === 1 ? 2 : 1;
  const wd = weekdayOf(last);
  return { round, weekday: last.round === 1 ? wd : (wd + 1) % 7 };
}

function pickKr(history: VipDraw[]): VipPick | null {
  if (history.length < KR_MIN_HISTORY) return null;
  const { round, weekday } = nextRoundInfo(history as (VipDraw & Draw)[]);
  const s = krScores(history, round, weekday);
  return { order: s.map((x) => x.digit), formula: "kr-model", label: "สูตรเกาหลี VIP", digits: [s[0].digit, s[1].digit], note: `โมเดลให้ ${s[0].digit}: ${(100 * s[0].p).toFixed(1)}% · ${s[1].digit}: ${(100 * s[1].p).toFixed(1)}% (สุ่ม 34.4%) · อันดับถัดไป ${s.slice(2, 5).map((x) => `${x.digit} ${(100 * x.p).toFixed(0)}%`).join(", ")}` };
}

/** เลข 2 ตัวเรียงตามที่เครื่องออกบ่อยสุด — ตัดเบิ้ล, ตัดเลขของงวดก่อน */
function biasRanking(history: VipDraw[]): string[] {
  const count: Record<string, number> = {};
  for (const h of history) { const t = canon2(h.top.slice(-2)), b = canon2(h.bottom); count[t] = (count[t] ?? 0) + 1; count[b] = (count[b] ?? 0) + 1; }
  const prev = history[history.length - 1];
  const excl = new Set(prev ? [canon2(prev.top.slice(-2)), canon2(prev.bottom)] : []);
  const cands: string[] = [];
  for (let i = 0; i < 100; i++) { const m = String(i).padStart(2, "0"); if (m === canon2(m) && m[0] !== m[1] && !excl.has(m)) cands.push(m); }
  return cands.sort((a, b) => (count[b] ?? 0) - (count[a] ?? 0) || a.localeCompare(b));
}

function drillKr(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const ranking = biasRanking(history);
  const [a, b] = pick.digits;
  const rowA = ranking.filter((m) => m.includes(a)).slice(0, KR_DRILL_PER_DIGIT);
  const rowB = ranking.filter((m) => m.includes(b) && !rowA.includes(m)).slice(0, KR_DRILL_PER_DIGIT);
  const front = (d: string) => (m: string) => (m[0] === d ? m : m[1] + m[0]);
  return [{ digit: a, numbers: rowA.map(front(a)) }, { digit: b, numbers: rowB.map(front(b)) }];
}

export const krFormula: MarketFormula = {
  name: "สูตรเกาหลี VIP — โมเดลเรียนรู้จาก 1,356 งวด (45 ตัวแปร)",
  evidence: "โมเดล logistic ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปรพฤติกรรม (ออกใน 1–6 งวดก่อน, ตำแหน่งใน 2 งวดก่อน, ความถี่ 30/100 งวด, หายกี่งวด, ตัวเลขเอง, วัน, เลขคณิตกับงวดก่อน) · ทดสอบกับ 810 งวดที่โมเดลไม่เคยเห็น: ★ 36.2% / 2 ตัว 60.4% (สุ่ม 34.4 / 59.0) · เกาหลีไม่มีเลขที่ออกมาก/น้อยถาวรและเลข 2 ตัวไม่เอียง (chi² 59 ≈ สุ่ม) จึงอ่านได้แต่พฤติกรรม: เครื่องถ่วงดุลแรง (เลขร้อน 30 งวดออกซ้ำ 28.5%), เลี่ยงเบิ้ล, ล่างหยิบหลักจากบน, ไม่ซ้ำงวดก่อน · ไม่มีราคาเปิดในฟีด · **ฝึกใหม่ 23 ก.ย. 69** จาก 1,360 งวด (ถึง 23 ก.ย.) · ทดสอบนอกตัวอย่าง 409 งวด: ★ 35.7% / 2 ตัว 59.4% (สุ่ม 33.1%) — งวดที่ใช้วัดผลต่อจากนี้ต้องเป็นงวดหลัง 23 ก.ย. เท่านั้น",
  pick: pickKr,
  drill: drillKr,
  minHistory: KR_MIN_HISTORY,
  since: "2026-09-23", // วันที่สูตรปัจจุบันเริ่มใช้ (ฝึกใหม่ 23 ก.ย. 69) — ไว้บอกในหมายเหตุของงวดที่ไม่มีเลขล็อก
};
