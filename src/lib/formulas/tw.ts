/**
 * สูตรของ "หุ้นไต้หวัน VIP" (ออกวันละรอบ 11:35 ไทย) — วิเคราะห์จากพฤติกรรมการออกของไต้หวัน VIP เองเท่านั้น
 *   ไม่ใช้ข้อมูล/โมเดลของตลาดอื่น และไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม ≈ 33% ต่อเลข, 2 ตัว ≥1 ≈ 58%
 *
 * **ปรับ 11 ต.ค. 69**
 *   เลขที่ล็อกจริง 18 งวด (24 ก.ย.–11 ต.ค.) ได้ ★ 3/18 · 2 ตัว 7/18 — ระบบฟันจากประวัติในฐานข้อมูลแค่ 16–33 งวด
 *   → แนบประวัติ 1,378 งวด (25 พ.ย. 65–11 ต.ค. 69, raakaadee.com ตรงกับ API 15/15 และฐานข้อมูล 33/33) ใน vip-history/tw.json
 *     และไม่ฟันจนกว่าจะมีประวัติ TW_MIN_HISTORY งวด
 *
 * พฤติกรรมของไต้หวัน VIP (จากประวัติของมันเอง):
 *   ▸ "เลขที่ออกเมื่อวาน" ไม่คงที่ — ปี 66 กลับมา 34.8% vs 31.9% · ปี 67 ตรงข้าม 31.4% vs 34.0% · ปี 68 เท่ากัน · ปี 69 กลับมา 35.8% vs 32.4%
 *   ▸ ล่างไม่เคยซ้ำล่างเมื่อวาน (0 ครั้งตั้งแต่ปี 67) · เลข 6, 7 ออกน้อยกว่าเลขอื่นเล็กน้อยเกือบทุกปี
 *   ▸ เลขที่ออกน้อยใน 100 งวดล่าสุดมีโอกาสมากกว่า (ถ่วงดุลระยะกลาง) — ส่วนเลขที่หายนานสุดกลับแย่ (29.6%)
 *
 * วิธี (MEGA, 11 ต.ค. 69) = รวมอันดับ 2 ตัว:
 *   (1) "รวมสูตรความน่าจะเป็น" 37 ตัวแปร ทุกตัวคำนวณจากเลขที่ออกของไต้หวันเอง แล้วให้ logistic ชั่งน้ำหนักจาก 500 งวดล่าสุด (ฝึกใหม่ทุก 100 งวด):
 *       ออกใน 1–6 งวดก่อน · ตำแหน่งในผลเมื่อวาน · ความถี่ 10/30/100/300/ตลอดกาล · ตัวเลขเอง ·
 *       โอกาสตามระยะหาย (hazard) · โอกาสตามการมาติด · มาร์คอฟ "เมื่อวานออก x → วันนี้ออก d" · มาร์คอฟรายตำแหน่ง (5 ตำแหน่ง) ·
 *       วันในสัปดาห์ · โหวตจาก "สูตรหวยหุ้น" 89 สูตร (เลขงวดก่อน ±, เงา +5, บวก/ลบหลัก, ผลรวม) ทั้งดิบและถ่วงตามความแม่นสะสม
 *   (2) เลขเย็น: ออกน้อยสุดใน 100 งวดล่าสุด
 *   ทดสอบ walk-forward 878 งวด (★ / 2 ตัว): **รวม 38.5 / 62.2 · ปี 69: 41.5 / 64.4 · 60 งวดล่าสุด 43.3 / 68.3** (สุ่ม 33.3 / 57.7)
 *     เทียบสูตรก่อน (โมเดล 44 ตัวแปร 500 งวด + เย็น): รวม 39.3 / 62.6 · ปี 69 40.1 / 61.6 · 60 งวดล่าสุด 38.3 / 60.0
 *     → ระยะยาวพอ ๆ กัน (ต่างกันไม่เกินช่วงแกว่ง) แต่ MEGA ดีกว่าชัดในช่วงล่าสุด จึงเปลี่ยน
 *     ที่ลองแล้วไม่ดีกว่า: MEGA อย่างเดียว 32.5–34.7 / 59.6–60.3 · MEGA + สูตรก่อน (+เย็น) 35.8–37.4 / 62.1–62.9 ·
 *     เพิ่มสัญญาณ "มาติด 2 วัน/มาถี่เกิน" เข้าโมเดลเดิม 39.0 / 62.1 · จูน 48 แบบ · แนวนิเคอิ 37.6 / 61.2 · สูตรหวยหุ้นเดี่ยว ๆ ดีสุด 36.0% (ปี 69 35.9%)
 *   ราคาเปิด/ปิดตรวจแล้วช่วยไม่ได้: เว็บขยับ diff แถวผล −77…+61 สตางค์ และทศนิยมราคาปิดสุ่มเท่ากันทุกค่า
 * ฟัน 2 ตัวเท่านั้น (ผู้ใช้ไม่ต้องการฟันเพิ่ม 11 ต.ค. 69)
 * เลขเจาะ (2 ชุด × 6): คู่เลข (เลขที่ฟัน + อีกตัว) ที่ออกเป็น 2 ตัวบน/ล่างบ่อยสุดใน 300 งวด ตัดเบิ้ล ตัดคู่ของเมื่อวาน (ล่างไม่เคยซ้ำล่างเมื่อวาน)
 *   ทดสอบ 878 งวดกับเลขฟัน MEGA: 46.8% (60 งวดล่าสุด 53.3%) vs สุ่มคู่ 45.7% · มาร์คอฟ "เมื่อวานออก x → คู่ไหน" 46.6–46.8% · ตามอันดับ MEGA 46.1%
 *   ⚠ ได้เปรียบแค่ ~1 จุด — เลขเจาะของไต้หวันขึ้นกับเลขฟันเป็นหลัก ไม่มีพฤติกรรมระดับคู่ที่แรง
 */
import { DIGITS10, canon2, resultDigits, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const TW_MIN_HISTORY = 250;
export const TW_DRILL_PER_DIGIT = 6;
/** ฝึกจากกี่งวดล่าสุด · ฝึกใหม่ทุกกี่งวด · นับเลขเย็นย้อนกี่งวด · งวดแรกที่เริ่มคิดคุณสมบัติ */
const TW_TRAIN_WINDOW = 500, TW_RETRAIN_EVERY = 100, TW_COLD_WINDOW = 100, TW_START = 120;
/** ตัวเลขจากการทดสอบ walk-forward 878 งวด — ดูหัวไฟล์ */
export const TW_BASE = { star: 0.385, any: 0.622, star2026: 0.415, any2026: 0.644, last60Star: 0.433, last60Any: 0.683, randomStar: 0.333, randomAny: 0.577 } as const;

type Draw = { date?: Date | string; weekday?: number };
/** วันในสัปดาห์แบบ python (จันทร์ = 0) */
const weekdayOf = (d: Draw) => d.weekday ?? (d.date ? (new Date(d.date).getUTCDay() + 6) % 7 : 0);
const sigOf = (h: VipDraw) => `${(h as Draw).date ? new Date((h as Draw).date!).toISOString().slice(0, 10) : ""}|${h.top}|${h.bottom}`;
type Cell = [number, number]; // [ครั้งที่มา, ครั้งที่ลุ้น] — เริ่มที่ 1/3 (ค่าสุ่ม) กันตัวอย่างน้อย
const cells = (n: number): Cell[] => Array.from({ length: n }, () => [1, 3] as Cell);
const rate = (c: Cell) => c[0] / c[1];

/**
 * "สูตรหวยหุ้น" แบบคำนวณจากผลงวดก่อน 89 สูตร — ใช้เป็นคะแนนโหวต (ทั้งโหวตดิบ และโหวตถ่วงตามความแม่นสะสมของแต่ละสูตร)
 * ตำแหน่ง 0–4 = หลักร้อยบน, หลักสิบบน, หลักหน่วยบน, หลักสิบล่าง, หลักหน่วยล่าง
 */
const TIPS: ((p: number[][], i: number) => number)[] = [];
for (const lag of [1, 2]) for (let k = 0; k < 5; k++) for (const t of [0, 5, 1, 9, 7]) TIPS.push((p, i) => (p[i - lag][k] + t) % 10);
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
  TIPS.push((p, i) => (p[i - 1][a] + p[i - 1][b]) % 10, (p, i) => Math.abs(p[i - 1][a] - p[i - 1][b]), (p, i) => (p[i - 1][a] + p[i - 1][b] + 5) % 10);
}
TIPS.push((p, i) => (p[i - 1][0] + p[i - 1][1] + p[i - 1][2]) % 10, (p, i) => p[i - 1].reduce((s, v) => s + v, 0) % 10);

/**
 * สถานะสะสมของ "สูตรความน่าจะเป็น" ทั้งหมด — เดินหน้าทีละงวด (คุณสมบัติของงวด i ใช้เฉพาะงวดก่อน i)
 * แคชข้ามการเรียก: หน้า /vip เรียกสูตรทุกงวดย้อนหลังด้วยประวัติชุดเดียวกันที่สั้นยาวต่างกัน
 */
type Engine = {
  sigs: string[]; sets: Set<string>[]; pos: number[][]; feats: number[][][]; upto: number;
  gap: Cell[]; streak: Cell[]; markov: Cell[][]; posMk: Cell[][][]; wday: Cell[][]; tips: Cell[]; total: number[];
};
let engine: Engine | null = null;
const newEngine = (): Engine => ({
  sigs: [], sets: [], pos: [], feats: [], upto: 0,
  gap: cells(61), streak: cells(6), markov: Array.from({ length: 10 }, () => cells(10)),
  posMk: Array.from({ length: 5 }, () => Array.from({ length: 10 }, () => cells(10))), wday: Array.from({ length: 7 }, () => cells(10)),
  tips: cells(TIPS.length), total: new Array(10).fill(0),
});

/** คุณสมบัติ 37 ตัวของเลข 0–9 ณ งวด i (จากงวดก่อน i เท่านั้น) */
function featuresAt(e: Engine, i: number, weekday: number): number[][] {
  const { sets, pos } = e;
  const cnt = (d: string, w: number) => { let c = 0; for (let j = 1; j <= w && j <= i; j++) c += +sets[i - j].has(d); return c; };
  const gapOf = (d: string) => { let g = 0; while (g < 60 && i - g - 1 >= 0 && !sets[i - g - 1].has(d)) g++; return g; };
  const strOf = (d: string) => { let s = 0; while (s < 5 && i - s - 1 >= 0 && sets[i - s - 1].has(d)) s++; return s; };
  const yd = [...sets[i - 1]];
  const tipDigit = TIPS.map((t) => t(pos, i));
  return DIGITS10.map((d, di) => {
    const f: number[] = [];
    for (let j = 1; j <= 6; j++) f.push(+sets[i - j].has(d));                            // ออกใน 1–6 งวดก่อน
    for (let k = 0; k < 5; k++) f.push(+(pos[i - 1][k] === di));                          // อยู่ตำแหน่งไหนของผลเมื่อวาน
    for (const w of [10, 30, 100, 300]) f.push(cnt(d, w) / (w * 0.333) - 1);              // ความถี่หลายช่วง
    f.push(e.total[di] / (i * 0.333) - 1);                                                // ความถี่ตลอดกาล
    for (let x = 0; x < 10; x++) f.push(+(x === di));                                     // ตัวเลขเอง
    f.push((rate(e.gap[gapOf(d)]) - 0.333) * 10);                                         // โอกาสตามระยะหาย
    f.push((rate(e.streak[strOf(d)]) - 0.333) * 10);                                      // โอกาสตามการมาติด
    f.push((yd.reduce((s, x) => s + rate(e.markov[+x][di]), 0) / yd.length - 0.333) * 10); // มาร์คอฟ: เลขเมื่อวาน → เลขนี้
    for (let k = 0; k < 5; k++) f.push((rate(e.posMk[k][pos[i - 1][k]][di]) - 0.333) * 10); // มาร์คอฟรายตำแหน่ง
    f.push((rate(e.wday[weekday][di]) - 0.333) * 10);                                     // วันในสัปดาห์
    let votes = 0, wvotes = 0;
    tipDigit.forEach((t, k) => { if (t === di) { votes++; wvotes += rate(e.tips[k]) - 0.333; } });
    f.push(votes / 5, wvotes * 10);                                                       // โหวตจากสูตรหวยหุ้น 89 สูตร
    return f;
  });
}

/** เดิน engine ให้ถึงงวด n (คุณสมบัติของงวด n = งวดที่จะฟัน) — ต่อจากของเดิมถ้าประวัติเป็นชุดเดียวกัน ไม่งั้นเริ่มใหม่ */
function advance(history: VipDraw[], nextWeekday: number): Engine {
  const n = history.length;
  let e = engine;
  const same = e && history.slice(0, Math.min(e.upto, n)).every((h, k) => e!.sigs[k] === sigOf(h));
  if (!e || !same) { e = newEngine(); engine = e; }
  // ประวัติสั้นกว่าที่เดินไว้: คุณสมบัติของงวด n คำนวณไว้แล้วตอนเดินผ่าน (ด้วยสถิติ ณ ตอนนั้น ไม่เห็นงวดหลังจากนั้น)
  if (e.upto > n) return e;
  for (let i = e.upto; i <= n; i++) {
    if (i < n) { const h = history[i]; e.sigs[i] = sigOf(h); e.sets[i] = new Set(resultDigits(h.top, h.bottom)); e.pos[i] = [h.top[0], h.top[1], h.top[2], h.bottom[0], h.bottom[1]].map(Number); }
    if (i >= TW_START) e.feats[i] = featuresAt(e, i, i < n ? weekdayOf(history[i] as Draw) : nextWeekday);
    if (i === n) break;
    // อัปเดตสถิติด้วยผลงวด i (ใช้กับงวดถัดไปเท่านั้น)
    if (i >= 2) {
      const gapOf = (d: string) => { let g = 0; while (g < 60 && i - g - 1 >= 0 && !e!.sets[i - g - 1].has(d)) g++; return g; };
      const strOf = (d: string) => { let s = 0; while (s < 5 && i - s - 1 >= 0 && e!.sets[i - s - 1].has(d)) s++; return s; };
      const wd = weekdayOf(history[i] as Draw);
      for (const d of DIGITS10) {
        const di = +d, hit = +e.sets[i].has(d);
        const add = (c: Cell) => { c[0] += hit; c[1]++; };
        add(e.gap[gapOf(d)]); add(e.streak[strOf(d)]); add(e.wday[wd][di]);
        for (const x of e.sets[i - 1]) add(e.markov[+x][di]);
        for (let k = 0; k < 5; k++) add(e.posMk[k][e.pos[i - 1][k]][di]);
      }
      TIPS.forEach((t, k) => { e!.tips[k][0] += +e!.sets[i].has(String(t(e!.pos, i))); e!.tips[k][1]++; });
    }
    for (const d of e.sets[i]) e.total[+d]++;
    e.upto = i + 1;
  }
  return e;
}

/** ฝึก logistic (L2 0.01) ที่ "ชั่งน้ำหนักทุกสูตร" จาก TW_TRAIN_WINDOW งวดล่าสุดก่อน cutoff */
const modelCache = new Map<string, { w: Float64Array; b: number }>();
function trainedModel(e: Engine, cutoff: number) {
  const key = `${cutoff}|${e.sigs[cutoff - 1]}`;
  const hit = modelCache.get(key);
  if (hit) return hit;
  const lo = Math.max(TW_START, cutoff - TW_TRAIN_WINDOW), nf = e.feats[lo][0].length;
  const w = new Float64Array(nf); let b = 0;
  for (let it = 0; it < 400; it++) {
    const g = new Float64Array(nf); let gb = 0, n = 0;
    for (let i = lo; i < cutoff; i++) for (let di = 0; di < 10; di++) {
      const x = e.feats[i][di]; let z = b;
      for (let j = 0; j < nf; j++) z += w[j] * x[j];
      const err = 1 / (1 + Math.exp(-z)) - +e.sets[i].has(DIGITS10[di]);
      gb += err; n++;
      for (let j = 0; j < nf; j++) g[j] += err * x[j];
    }
    for (let j = 0; j < nf; j++) w[j] -= 0.3 * (g[j] / n + 0.01 * w[j]);
    b -= 0.3 * gb / n;
  }
  const m = { w, b };
  if (modelCache.size > 200) modelCache.clear();
  modelCache.set(key, m);
  return m;
}

function pickTw(history: VipDraw[]): VipPick | null {
  if (history.length < TW_MIN_HISTORY) return null;
  const n = history.length;
  const e = advance(history, (weekdayOf(history[n - 1] as Draw) + 1) % 7); // วันละงวด → งวดถัดไป = พรุ่งนี้
  const { w, b } = trainedModel(e, n - (n % TW_RETRAIN_EVERY));
  const model = DIGITS10.map((d, di) => { const z = e.feats[n][di].reduce((s, v, j) => s + v * w[j], b); return { digit: d, p: 1 / (1 + Math.exp(-z)) }; })
    .sort((a, c) => c.p - a.p || a.digit.localeCompare(c.digit));
  const count = Object.fromEntries(DIGITS10.map((d) => [d, e.sets.slice(n - TW_COLD_WINDOW, n).filter((s) => s.has(d)).length])) as Record<string, number>;
  const cold = [...DIGITS10].sort((a, c) => count[a] - count[c] || a.localeCompare(c));
  const rank: Record<string, number> = {};
  model.forEach((x, k) => (rank[x.digit] = k));
  cold.forEach((d, k) => (rank[d] += k));
  const s = [...DIGITS10].sort((a, c) => rank[a] - rank[c] || a.localeCompare(c));
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  const why = (d: string) => `${d} (รวมสูตร ${(100 * model.find((x) => x.digit === d)!.p).toFixed(0)}% · ออก ${count[d]}/${TW_COLD_WINDOW} งวด)`;
  return {
    order: s, formula: "tw-mega", label: "สูตรไต้หวัน VIP", digits: [s[0], s[1]],
    note: `รวมสูตรความน่าจะเป็น 37 ตัวแปร (ความถี่ · ระยะหาย · มาติด · มาร์คอฟ · มาร์คอฟรายตำแหน่ง · วัน · โหวตสูตรหวยหุ้น 89 สูตร) ชั่งน้ำหนักจาก ${TW_TRAIN_WINDOW} งวดล่าสุด + เลขเย็น ${TW_COLD_WINDOW} งวด: ${why(s[0])}, ${why(s[1])} · อันดับถัดไป ${s.slice(2, 5).join(", ")} · ทดสอบ 878 งวด ★ ${pct(TW_BASE.star)} · 2 ตัว ${pct(TW_BASE.any)} · ปี 69 ★ ${pct(TW_BASE.star2026)} · 2 ตัว ${pct(TW_BASE.any2026)} (สุ่ม ${pct(TW_BASE.randomStar)} / ${pct(TW_BASE.randomAny)})`,
  };
}

/** เลขเจาะ: คู่ (เลขที่ฟัน + อีกตัว) ที่ออกเป็น 2 ตัวบน/ล่างบ่อยสุดใน 300 งวด ตัดเบิ้ล และตัดคู่ของเมื่อวาน */
function drillTw(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const pairCount: Record<string, number> = {};
  for (const h of history.slice(-300)) for (const m of [canon2(h.top.slice(-2)), canon2(h.bottom)]) pairCount[m] = (pairCount[m] ?? 0) + 1;
  const prev = history[history.length - 1];
  const skip = prev ? [canon2(prev.top.slice(-2)), canon2(prev.bottom)] : [];
  const row = (d: string, taken: string[]) => DIGITS10.filter((x) => x !== d && !taken.includes(canon2(d + x)))
    .sort((x, y) => (pairCount[canon2(d + y)] ?? 0) - (pairCount[canon2(d + x)] ?? 0) || x.localeCompare(y))
    .slice(0, TW_DRILL_PER_DIGIT).map((x) => d + x);
  const [a, b] = pick.digits;
  const rowA = row(a, skip);
  const rowB = row(b, [...skip, ...rowA.map(canon2)]);
  return [{ digit: a, numbers: rowA }, { digit: b, numbers: rowB }];
}

export const twFormula: MarketFormula = {
  name: "สูตรไต้หวัน VIP — รวมสูตรความน่าจะเป็น 37 ตัวแปร (MEGA) + เลขเย็น 100 งวด (ปรับ 11 ต.ค. 69)",
  evidence: "**วิเคราะห์จากเลขที่ออกของไต้หวัน VIP เองเท่านั้น** · MEGA (11 ต.ค. 69): รวมสูตรความน่าจะเป็น 37 ตัวแปร — ความถี่ 10/30/100/300/ตลอดกาล, โอกาสตามระยะหาย, โอกาสตามการมาติด, มาร์คอฟ 'เมื่อวานออก x → วันนี้ออก d', มาร์คอฟรายตำแหน่ง, วันในสัปดาห์, โหวตจากสูตรหวยหุ้น 89 สูตร — ชั่งน้ำหนักจาก 500 งวดล่าสุด (ฝึกใหม่ทุก 100 งวด) + เลขเย็น 100 งวด · ทดสอบ walk-forward 878 งวด: ★ 38.5% · 2 ตัว 62.2% · ปี 69 ★ 41.5% · 2 ตัว 64.4% · 60 งวดล่าสุด 43.3% / 68.3% (สุ่ม 33.3 / 57.7) · สูตรก่อนหน้าระยะยาวพอ ๆ กัน (39.3 / 62.6) แต่ช่วงล่าสุดแพ้ (38.3 / 60.0) · ราคาเปิด/ปิดช่วยไม่ได้ (ราคาวิ่งเฉลี่ย 57 จุด/วัน ผลต้องแม่นระดับสตางค์ และเว็บขยับ diff แถวผล) · เลขเจาะ: คู่ที่ออกบ่อยใน 300 งวด ตัดเบิ้ล ตัดคู่ของเมื่อวาน 46.8% (สุ่มคู่ 45.7%) · ได้เปรียบสุ่มราว 5–8 จุด ผลรายวันยังแกว่ง พลาด 3 วันติดเกิดได้ราว 1 ครั้งต่อ 40 วัน",
  pick: (history) => pickTw(history),
  drill: drillTw,
  noManualOpen: true, // ถอดสูตรทดลอง B (จากทศนิยมราคาเปิด) 13 ต.ค. 69 — แพ้สูตรหลัก และผล VIP ไม่ผูกกับราคาเปิด · ระบบยังเก็บราคาเปิดเองจากฟีด
  minHistory: TW_MIN_HISTORY,
  lockedFrom: "2026-10-12", // เลขที่ล็อกก่อน 12 ต.ค. 69 ฟันจากประวัติแค่ 16–33 งวด
  drillRandom: 0.457, // เจาะ 12 ตัวแบบสุ่มคู่ จากเลขฟัน MEGA ชุดเดียวกัน 878 งวด
};
