/**
 * สูตรของ "หุ้นจีน VIP" (เช้า 10:05 / บ่าย 14:25 ไทย) — ไฟล์นี้ใช้เฉพาะตลาดนี้ ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม = 34.4% ต่อเลข, 2 ตัว ≥1 = 59%
 *
 * วิธีคิด: โมเดลเรียนรู้ (logistic regression) ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปร
 *   (ออกใน 1–6 งวดก่อนไหม · ตำแหน่งใน 2 งวดก่อน · ความถี่ 30/100 งวด · หายกี่งวด · ตัวเลขเอง · รอบ · วัน · เลขคณิตกับงวดก่อน)
 *
 * **ฝึกใหม่ 27 ก.ย. 69 ด้วยประวัติ 2,726 งวด (25 พ.ย. 2565 → 27 ก.ย. 2569)** — เดิมฝึกถึง 23 ก.ย. และ cn.json หยุดที่ 18 ก.ย.
 * วัดผลแบบฝึกโมเดลใหม่ทุก fold (expanding window 6 ช่วง × 250 = 1,500 งวดที่โมเดลไม่เคยเห็นเลย) และวัด "ผ่านท่อสูตรจริง" คือรวมกฎรอบบ่ายด้วย:
 *   2 อันดับแรกดิบของโมเดล   ★ 35.9% · 2 ตัว 60.1%
 *   ผ่านท่อสูตรจริง          ★ 36.2% · 2 ตัว 62.8%   (เส้นสุ่มของชุดเดียวกัน ★ 33.1% · สุ่มคู่ 57.3%)
 *   → กฎรอบบ่าย (ตัดเลขที่ออกรอบเช้า + เลือกคู่ครอบคลุมกว้างสุด) เพิ่มช่อง "2 ตัว" ให้ +2.7 จุดจริง ไม่ใช่แค่ทฤษฎี
 *   **แยกรอบ: เช้า ★ 39.1% · 2 ตัว 62.4%  |  บ่าย ★ 33.3% (เท่าสุ่ม) · 2 ตัว 63.2%**
 *     รอบบ่ายตัว ★ ไม่ได้เปรียบเพราะ widestPair ตั้งใจแลกความแม่นของตัวแรกไปเพิ่มโอกาสของคู่ → รอบบ่ายให้เล่นทั้งสองตัว อย่ายึด ★
 *   500 งวดล่าสุดยังอยู่ทรงเดิม ★ 35.2% · 2 ตัว 63.4% (ต่างจากฮั่งเส็งที่ขอบบางลง)
 *   "งวดแข็ง" ของจีนยังไม่นิ่ง จึงยังไม่แสดงป้าย: เกณฑ์ ≥40% ติด 29% ของงวด ★ 36.4% แต่แต่ละช่วงทดสอบได้ 27 / 40 / 39 / 31 / 37 / 43%
 *   ขั้นตอนฝึกตรวจแล้วตรงกับ ml4.py เดิม: ฝึกด้วยข้อมูลถึง 23 ก.ย. เท่ากัน ได้เวกเตอร์น้ำหนัก cosine 0.980 กับโมเดลเก่า
 * สิ่งที่โมเดลพบ: เลขที่เป็นหลักสิบของล่างใน 1–2 งวดก่อน และหลักหน่วยของบน/ล่างงวดก่อน จะออกน้อยลง (เครื่องเลี่ยงซ้ำตามตำแหน่ง) ·
 *   7 และ 4 ออกน้อยถาวร (29–30%)
 * สิ่งที่ลองแล้วไม่ดีกว่านี้: เลขร้อน (30–33% แย่กว่าสุ่ม), เลขเย็น (32–36%), หายนาน (33%), อัตราสูงสุด (34%), ตัวเปิด (ผลไม่ตรงกฎ ปิด − เปิด)
 * เลข 2 ตัว: เครื่องเลี่ยงเบิ้ล (163 vs 270), ล่างหยิบหลักจากบน (416/424 vs 270), ไม่ซ้ำเลขงวดก่อน (0/5 vs 27), การกระจายเอียงถาวร chi² 133
 *   → เจาะ = เลขที่มีหลักที่ฟัน เรียงตามความเอียง ตัดเบิ้ล ตัดเลขงวดก่อน (12 เลขเอียงสุดมาอย่างน้อย 1 = 47% vs สุ่ม 42%)
 * น้ำหนักโมเดลอยู่ใน src/data/vip-history/cn-model.json (ฝึกใหม่ด้วยสคริปต์ ml4.py เมื่อประวัติเพิ่ม)
 */
import model from "@/data/vip-history/cn-model.json";
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const CN_MIN_HISTORY = 100;
export const CN_DRILL_PER_DIGIT = 6;
/** ทุกตัวเลขจากการทดสอบนอกตัวอย่าง 1,500 งวด (ฝึกโมเดลใหม่ทุก fold) วัดผ่านท่อสูตรจริง — ดูหัวไฟล์ */
export const CN_BASE = { star: 0.362, any: 0.628, amStar: 0.391, amAny: 0.624, pmStar: 0.333, pmAny: 0.632, randomStar: 0.331, randomAny: 0.573, recentStar: 0.352, recentAny: 0.634 } as const;

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
export function cnScores(history: VipDraw[], round = 2, weekday = 1): { digit: string; p: number }[] {
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


/**
 * D สดของหุ้นจีน VIP — ฟีดให้ ราคา กับ diff ทุกนาที · (ราคา − diff) = ราคาอ้างอิงของวัน ซึ่งคงที่ทั้งวัน
 *   ตรวจจากฟีดรายนาทีของหุ้นจีน VIPเอง 23 ก.ย. 69: ค่านี้คงที่ 173/174 จุด
 *   และผลรอบเช้าวันนั้นตรงกับโครงสร้างเป๊ะ (บน 60 → ล่าง = (60 − 36) mod 100 = 24? ดูบันทึกในหน้า /vip)
 * ผล VIP มาจากราคาโดยตรง → ล่าง = (บน − D) mod 100 ถ้าราคาปิดเหนืออ้างอิง, (D − บน) mod 100 ถ้าต่ำกว่า
 * รู้ D ก่อนหวยออก = รู้ว่าบนกับล่างผูกกันยังไง → เลือก "คู่ผูก" ที่ต้องมาด้วยกันได้ (สุ่มได้ 10%)
 */
export const cnLiveD = (price: number, diff: number) => Math.round(Math.abs(Math.round((price - diff) * 100))) % 100;

export function cnPairFromD(D: number): { digits: [string, string]; pBoth: number } {
  const sets: Set<string>[] = [];
  for (let t = 0; t < 100; t++) for (const up of [true, false]) {
    const b = up ? ((t - D) % 100 + 100) % 100 : ((D - t) % 100 + 100) % 100;
    sets.push(new Set(String(t).padStart(2, "0") + String(b).padStart(2, "0")));
  }
  let best: { digits: [string, string]; pBoth: number } | null = null;
  for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
    const A = String(a), B = String(b);
    const both = sets.filter((s) => s.has(A) && s.has(B)).length / sets.length;
    if (!best || both > best.pBoth) best = { digits: [A, B], pBoth: both };
  }
  return best!;
}


/**
 * เลือก "คู่เลข" ให้ครอบคลุมผลได้กว้างที่สุด แทนการหยิบ 2 อันดับแรกของโมเดล
 *   เหตุผล: ผลของตลาดนี้มีเลขซ้ำกันเองบ่อย (ล่างใช้เลขร่วมกับบน ~55%) สองอันดับแรกของโมเดลจึงมักเป็นเลขที่ "มาด้วยกัน"
 *   = ฟันไป 2 ตัวแต่คุมได้เท่าตัวเดียว · เลือกคู่ที่มาด้วยกันน้อย จะคุมผลได้กว้างกว่า
 *   วัดจาก จีนเอง (400 งวด, วัด "ผลปิดมีเลขที่ฟันอย่างน้อย 1 ตัว"): รอบบ่าย 59.5% → 63.3% · รอบเช้าแย่ลง (64.3 → 63.8) จึงใช้เฉพาะรอบบ่าย
 */
function widestPair(scores: { digit: string; p: number }[], history: VipDraw[]): [{ digit: string; p: number }, { digit: string; p: number }] {
  const recent = history.slice(-600).map((h) => new Set(resultDigits(h.top, h.bottom)));
  const together = (a: string, b: string) => (recent.length ? recent.filter((s) => s.has(a) && s.has(b)).length / recent.length : 0);
  let best: { a: { digit: string; p: number }; b: { digit: string; p: number }; u: number } | null = null;
  for (let x = 0; x < 6; x++) for (let y = x + 1; y < 6; y++) {
    const u = scores[x].p + scores[y].p - together(scores[x].digit, scores[y].digit);
    if (!best || u > best.u) best = { a: scores[x], b: scores[y], u };
  }
  return [best!.a, best!.b];
}

function pickCn(history: VipDraw[], _open?: number | null, forRound?: number, live?: { price?: number | null; diff?: number | null }): VipPick | null {
  if (history.length < CN_MIN_HISTORY) return null;
  const guess = nextRoundInfo(history as (VipDraw & Draw)[]);
  // รอบที่หน้าจอถามมาสำคัญกว่าการเดา: ตอนผลเช้ายังไม่ออก ประวัติจะชี้ว่า "งวดถัดไป = เช้า" ทั้งสองแผง
  const round = forRound ?? guess.round;
  const weekday = forRound && forRound !== guess.round ? weekdayOf(history[history.length - 1] as Draw) : guess.weekday;
  let s = cnScores(history, round, weekday);
  /**
   * รอบบ่ายต้อง "อ่านผลรอบเช้าของวันเดียวกัน" ไม่ใช่ฟันเลขเดิม
   * สถิติของจีนเอง: เลขที่ออกรอบเช้า กลับมาออกรอบบ่ายแค่ 29.9–31.0% ส่วนเลขที่ไม่ออกเช้าได้ 34.1–34.6%
   * ทดสอบ 400 งวดรอบบ่าย: ตัดเลขที่ออกเช้าออก → จีน ★ 35.0→36.5% / 2 ตัว 59.5→62.5% · นิเคอิ 2 ตัว 61.8→63.3%
   */
  let amNote = "";
  if (round === 2) {
    const last = history[history.length - 1] as VipDraw & Draw;
    const lastDate = last?.date ? new Date(last.date).toISOString().slice(0, 10) : null;
    if (last && (last as Draw).round === 1) {
      const am = new Set(resultDigits(last.top, last.bottom));
      const keep = s.filter((x) => !am.has(x.digit));
      if (keep.length >= 2) {
        const dropped = s.slice(0, 2).filter((x) => am.has(x.digit)).map((x) => x.digit);
        s = [...keep, ...s.filter((x) => am.has(x.digit))];
        const [wa, wb] = widestPair(s, history);
        s = [wa, wb, ...s.filter((x) => x.digit !== wa.digit && x.digit !== wb.digit)];
        amNote = ` · รอบบ่าย: ตัดเลขที่ออกรอบเช้าวันนี้ (${[...am].sort().join(",")}) ออกก่อน แล้วเลือกคู่ให้ครอบคลุมกว้างสุด${dropped.length ? ` — เลิกใช้ ${dropped.join(",")} ที่โมเดลให้สูงแต่เพิ่งออกเช้า` : ""}`;
      }
      void lastDate;
    }
  }
  // (24 ก.ย. 69) ถอดกฎ "ใช้ D สดเลือกตัวรอง" ออก — D เปลี่ยนตามราคาทุกนาที ทำให้เลขที่ฟันไม่นิ่งภายในวันเดียว
  //   และไม่มีผลทดสอบย้อนหลังรองรับ (ไม่มี D ย้อนหลังให้ทดสอบ) · เก็บ liveD ไว้ใช้เลือกเลขเจาะอย่างเดียว
  const liveD: number | null = live && live.price != null && live.diff != null ? cnLiveD(live.price, live.diff) : null; // ใช้เฉพาะเลือกเลขเจาะ
  const second = s[1];
  // ความคาดหวังของรอบนี้จากการทดสอบนอกตัวอย่าง — รอบบ่ายตัว ★ ไม่ได้เปรียบ (widestPair แลกความแม่นตัวแรกไปเพิ่มโอกาสของคู่)
  const expected = round === 1
    ? ` · รอบเช้าทดสอบนอกตัวอย่างได้ ★ ${(100 * CN_BASE.amStar).toFixed(1)}% · 2 ตัว ${(100 * CN_BASE.amAny).toFixed(1)}%`
    : ` · รอบบ่ายทดสอบนอกตัวอย่างได้ 2 ตัว ${(100 * CN_BASE.pmAny).toFixed(1)}% (สุ่มคู่ ${(100 * CN_BASE.randomAny).toFixed(1)}%) แต่ตัว ★ ได้ ${(100 * CN_BASE.pmStar).toFixed(1)}% เท่าสุ่ม — รอบบ่ายให้เล่นทั้งสองตัว อย่ายึด ★`;
  return { liveD, formula: "cn-model", label: "สูตรจีน VIP", digits: [s[0].digit, second.digit], note: `โมเดลให้ ${s[0].digit}: ${(100 * s[0].p).toFixed(1)}% · ${s[1].digit}: ${(100 * s[1].p).toFixed(1)}% (สุ่ม ${(100 * CN_BASE.randomStar).toFixed(1)}%) · อันดับถัดไป ${s.slice(2, 5).map((x) => `${x.digit} ${(100 * x.p).toFixed(0)}%`).join(", ")}${expected}${amNote}` };
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

function drillCn(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  // ถ้ารู้ D สดของวันนั้น: เลือกเลข 2 ตัวจาก "กรณีที่เป็นไปได้จริง" (บน 00–99 × ขึ้น/ลง = 200 กรณี)
  //   เลือกแบบไล่ทีละตัวให้ครอบคลุมกรณีใหม่มากสุด — ดีกว่าการเรียงตามความถี่ซึ่งพิสูจน์แล้วว่าเป็น noise
  if (pick.liveD != null) {
    const cases: { top: string; bottom: string }[] = [];
    for (let t = 0; t < 100; t++) for (const up of [true, false]) {
      const b = up ? ((t - pick.liveD) % 100 + 100) % 100 : ((pick.liveD - t) % 100 + 100) % 100;
      cases.push({ top: String(t).padStart(2, "0"), bottom: String(b).padStart(2, "0") });
    }
    const hit = (c: { top: string; bottom: string }, m: string) => c.top === m || c.top === m[1] + m[0] || c.bottom === m || c.bottom === m[1] + m[0];
    const pickRow = (d: string, taken: string[]) => {
      const cands: string[] = [];
      for (let i = 0; i < 100; i++) { const m = String(i).padStart(2, "0"); if (m.includes(d) && !taken.includes(m) && !taken.includes(m[1] + m[0])) cands.push(m); }
      const chosen: string[] = [];
      const covered = new Set<number>();
      for (let k = 0; k < CN_DRILL_PER_DIGIT; k++) {
        let best: { m: string; gain: number } | null = null;
        for (const m of cands) {
          if (chosen.includes(m)) continue;
          let gain = 0;
          cases.forEach((c, i) => { if (!covered.has(i) && hit(c, m)) gain++; });
          if (!best || gain > best.gain) best = { m, gain };
        }
        if (!best) break;
        chosen.push(best.m);
        cases.forEach((c, i) => { if (hit(c, best!.m)) covered.add(i); });
      }
      return chosen.map((m) => (m[0] === d ? m : m[1] + m[0]));
    };
    const [a, b] = pick.digits;
    const rowA = pickRow(a, []);
    const rowB = pickRow(b, rowA);
    return [{ digit: a, numbers: rowA }, { digit: b, numbers: rowB }];
  }
  const ranking = biasRanking(history);
  const [a, b] = pick.digits;
  const rowA = ranking.filter((m) => m.includes(a)).slice(0, CN_DRILL_PER_DIGIT);
  const rowB = ranking.filter((m) => m.includes(b) && !rowA.includes(m)).slice(0, CN_DRILL_PER_DIGIT);
  const front = (d: string) => (m: string) => (m[0] === d ? m : m[1] + m[0]);
  return [{ digit: a, numbers: rowA.map(front(a)) }, { digit: b, numbers: rowB.map(front(b)) }];
}

export const cnFormula: MarketFormula = {
  name: "สูตรจีน VIP — โมเดลเรียนรู้จาก 2,726 งวด (45 ตัวแปร) ฝึกใหม่ 27 ก.ย. 69",
  evidence: "โมเดล logistic ให้คะแนนเลข 0–9 ทุกงวดจาก 45 ตัวแปร (ออกใน 1–6 งวดก่อน, ตำแหน่งใน 2 งวดก่อน, ความถี่ 30/100 งวด, หายกี่งวด, ตัวเลขเอง, รอบ, วัน, เลขคณิตกับงวดก่อน) · **ฝึกใหม่ 27 ก.ย. 69 ด้วย 2,726 งวด (เดิมหยุดที่ 23 ก.ย. ประวัติแนบมาหยุด 18 ก.ย.)** · วัดแบบฝึกโมเดลใหม่ทุก fold 1,500 งวดที่ไม่เคยเห็น **ผ่านท่อสูตรจริง: ★ 36.2% / 2 ตัว 62.8%** (สุ่ม 33.1 / 57.3) — เทียบกับเอา 2 อันดับแรกดิบ ★ 35.9% / 2 ตัว 60.1% คือกฎรอบบ่าย (ตัดเลขรอบเช้า + เลือกคู่ครอบคลุมกว้างสุด) เพิ่มช่อง 2 ตัวให้ +2.7 จุดจริง · **แยกรอบ: เช้า ★ 39.1% / 2 ตัว 62.4% · บ่าย ★ 33.3% (เท่าสุ่ม) / 2 ตัว 63.2%** → รอบบ่ายอย่ายึดตัว ★ ให้เล่นทั้งคู่ เพราะสูตรตั้งใจแลกความแม่นของตัวแรกไปเพิ่มโอกาสของคู่ · 500 งวดล่าสุดยังอยู่ทรง ★ 35.2% / 2 ตัว 63.4% · ยังไม่แสดงป้าย 'งวดแข็ง' เพราะยังไม่นิ่ง (เกณฑ์ ≥40% แต่ละช่วงทดสอบได้ 27/40/39/31/37/43%) · โมเดลพบว่าเลขที่เป็นหลักสิบของล่างใน 1–2 งวดก่อนจะออกน้อยลงมากสุด (น้ำหนัก −0.29 / −0.25) และ 7 ออกน้อยถาวร (−0.20) · เลขร้อน/เย็น/ตัวเปิด ลองแล้วไม่ดีกว่านี้ · ชุดเลข 2 ตัวตามนิสัยเครื่องมาอย่างน้อย 1 = 47% (สุ่ม 42%)",
  pick: pickCn,
  drill: drillCn,
  noManualOpen: true, // ถอดสูตรทดลอง B (จากทศนิยมราคาเปิด) 13 ต.ค. 69 — แพ้สูตรหลัก และผล VIP ไม่ผูกกับราคาเปิด · ระบบยังเก็บราคาเปิดเองจากฟีด
  minHistory: CN_MIN_HISTORY,
};
