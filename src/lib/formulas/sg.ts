/**
 * สูตรของ "หุ้นสิงคโปร์ VIP" (ออกผล 17:05 ไทย รอบเดียว ทุกวัน) — วิเคราะห์จากเลขที่ออกของสิงคโปร์ VIP เองเท่านั้น ไม่ import สูตรตลาดอื่น
 * เลขที่ "ออก" = เลขโดดใน 2 ตัวบน + 2 ตัวล่าง (หลักร้อยไม่นับ) → สุ่ม ≈ 33% ต่อเลข, 2 ตัว ≥1 ≈ 57%
 *
 * ประวัติ 1,377 งวด (25 พ.ย. 65 → 11 ต.ค. 69) ใน vip-history/sg.json:
 *   raakaadee.com ถึง 21 ส.ค. 69 (หลังจากนั้นเว็บไม่อัปเดต) + exphuay.com/backward/sgx-vip 16 พ.ค.–11 ต.ค. 69
 *   สองแหล่งทับกัน 95 งวด ตรงกันทุกงวด · exphuay ตรงกับ API stocks-vip.com 15/15 · ขาด 16 ก.พ.–27 มี.ค. 66 (ไม่มีทั้งสองแหล่ง)
 *
 * ทดสอบ walk-forward 18 วิธี (ครึ่ง A = ถึง 10 ม.ค. 68 · B = หลังจากนั้น · ★ / 2 ตัว · สุ่ม A 32.9/57.1 · B 33.0/57.2):
 *   ▸ "เลขที่ออกน้อยช่วงหลัง" ชนะสุ่มทั้งสองครึ่งในทุกช่วงนับ 30–75 งวด (★ A 34.3–37.3 · B 34.0–38.3) — เครื่องถ่วงดุล
 *     ช่วงเดียวที่ดีสุด (30 งวด) A 35.0 / B 38.3 · ปีล่าสุด 42.7 แต่เลือกช่วงเดียวเสี่ยงบังเอิญ (บทเรียนอินเดีย)
 *     → ใช้ "รวมช่วง" 30+40+50+60 งวด (ความถี่ต่องวดรวมกัน): A ★37.1 / 2 ตัว 58.3 · B 36.2 / 59.5 · ปีล่าสุด 39.7 / 62.2
 *     ผู้ใช้ให้ยึดสูตรเดียว (13 ต.ค. 69) — ไม่มีช่องทดลอง (เย็น 30 งวดช่วงเดียว ช่วงข้างเคียงไม่นิ่ง)
 *     ★ ปีล่าสุดกระจาย 4: 76 · 0: 68 · 7: 65 · เลขอื่น 11–34 วัน — ไม่ติดเลขเดียว
 *   ▸ ไม่ชนะสุ่ม: เลขร้อน 10/30 งวด (29.6–32.1) · เลขเมื่อวาน 32.4–32.8 · หายนานสุด 29.0–29.4 · เย็น 10/15/20 งวด ·
 *     ถ่วงดุล (ตัดเลขเมื่อวาน) 100 งวด A 36.2 แต่ B 32.6 · เลขร้อน 100/300/ทั้งหมด และมาร์คอฟ กลับทิศกันระหว่างสองครึ่ง
 * **ปรับ 13 ต.ค. 69 — กันติดเลขเดิม**: ผู้ใช้เห็นสูตรฟัน 0-4 ซ้ำ 5 วัน (8–12 ต.ค.) หลุด 4 วันติด — เลขที่ไม่ออกจะยิ่ง "เย็น" แล้วถูกเลือกซ้ำไม่จบ
 *   กฎเพิ่ม: เลขที่หายไปเกิน SG_MAX_GAP (6) งวดติด ลดไปท้ายอันดับ (เครื่องกำลังกดเลขนั้นอยู่) · ทดสอบช่วงข้างเคียงด้วย:
 *     เดิม           A ★37.1 / 2 ตัว 58.3 · B 36.2 / 59.5 · ปีล่าสุด 40.0 / 62.5 · หลุดติดยาวสุด 12 งวด · ฟันซ้ำวันก่อน 61%
 *     หายเกิน 6      A 36.8 / 59.7 · B 38.6 / 62.5 · ปีล่าสุด 41.9 / 64.1 · หลุดติดยาวสุด 6 งวด · ฟันซ้ำวันก่อน 51%  ← ใช้
 *     หายเกิน 7/8/9/10 ไปทางเดียวกัน (2 ตัวดีขึ้นทั้งสองครึ่ง หลุดติดยาวสุด 6) · หายเกิน 5 ★ ครึ่งแรกตก (35.3) → ไม่ต่ำกว่า 6
 *     กฎ "ข้ามเลขที่ฟันพลาด 2–4 ครั้งติด" ไม่นิ่ง (ครึ่งหนึ่งดี อีกครึ่งแย่) → ไม่ใช้
 * เลขเจาะ 2 ชุด × 6: ไม่มีวิธีไหนชนะสุ่มนิ่ง (คู่ออกบ่อย 100/300/ทั้งหมด 44.0–46.0 · คู่ออกน้อย 42.1–45.5 · คู่ตามอันดับเย็น 44.0–44.8 · สุ่มคู่ 44.2–46.3)
 *   → ใช้คู่ที่ออกบ่อยใน 300 งวด ตัดเบิ้ล ตัดคู่ของเมื่อวาน (A 45.8 · B 44.6) — ถือว่าเท่าสุ่ม
 */
import { DIGITS10, resultDigits, canon2, type MarketFormula, type VipDraw, type VipPick, type VipDrillSet } from "./types";

export const SG_MIN_HISTORY = 60;
/** เลขที่หายเกินกี่งวดติดให้ลดไปท้ายอันดับ (กันฟันเลขเดิมซ้ำตอนเครื่องกดเลขนั้น) */
const SG_MAX_GAP = 6;
const SG_WINDOWS = [30, 40, 50, 60] as const;
const SG_DRILL_PER_DIGIT = 6;
export const SG_BASE = { starA: 0.368, anyA: 0.597, starB: 0.386, anyB: 0.625, starYear: 0.419, anyYear: 0.641, randomStar: 0.33, randomAny: 0.572 } as const;

/** คะแนนเย็น: ความถี่ต่องวดรวมทุกช่วง (น้อย = เย็น = มาก่อน) */
function coldScores(history: VipDraw[], windows: readonly number[]) {
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const per = (d: string, w: number) => sets.slice(-w).filter((s) => s.has(d)).length;
  return Object.fromEntries(DIGITS10.map((d) => [d, { score: windows.reduce((s, w) => s + per(d, w) / w, 0), counts: windows.map((w) => per(d, w)) }])) as Record<string, { score: number; counts: number[] }>;
}

function pickSg(history: VipDraw[], windows: readonly number[] = SG_WINDOWS, label = "สูตรสิงคโปร์ VIP"): VipPick | null {
  if (history.length < SG_MIN_HISTORY) return null;
  const c = coldScores(history, windows);
  const sets = history.map((h) => new Set(resultDigits(h.top, h.bottom)));
  const gap = (d: string) => { let k = 0; for (let i = sets.length - 1; i >= 0 && !sets[i].has(d); i--) k++; return k; };
  const away = (d: string) => (gap(d) > SG_MAX_GAP ? 1 : 0); // หายนานเกิน → ไปท้ายอันดับ
  const order = [...DIGITS10].sort((a, b) => away(a) - away(b) || c[a].score - c[b].score || Number(b) - Number(a));
  const skipped = DIGITS10.filter((d) => away(d)).map((d) => `${d} (หาย ${gap(d)} งวด)`);
  const why = (d: string) => `${d} (ออก ${windows.map((w, k) => `${c[d].counts[k]}/${w}`).join(" · ")})`;
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  return {
    order, formula: windows.length > 1 ? "sg-cold-ens" : `sg-cold${windows[0]}`, label, digits: [order[0], order[1]],
    note: `เลขที่ออกน้อยช่วงหลัง (รวม ${windows.join("/")} งวด): ${why(order[0])}, ${why(order[1])} · อันดับถัดไป ${order.slice(2, 5).join(", ")}${skipped.length ? ` · ลดอันดับเลขที่หายเกิน ${SG_MAX_GAP} งวด: ${skipped.join(", ")}` : ""} · ทดสอบ 1,278 งวด ★ ${pct(SG_BASE.starA)} / ${pct(SG_BASE.starB)} ทั้งสองครึ่ง · ปีล่าสุด ★ ${pct(SG_BASE.starYear)} · 2 ตัว ${pct(SG_BASE.anyYear)} (สุ่ม ${pct(SG_BASE.randomStar)} / ${pct(SG_BASE.randomAny)})`,
  };
}

/** เลขเจาะ: คู่ (เลขที่ฟัน + อีกตัว) ที่ออกเป็น 2 ตัวบน/ล่างบ่อยสุดใน 300 งวด ตัดเบิ้ล ตัดคู่ของเมื่อวาน */
function drillSg(pick: VipPick, history: VipDraw[]): VipDrillSet[] {
  const pairCount: Record<string, number> = {};
  for (const h of history.slice(-300)) for (const m of [canon2(h.top.slice(-2)), canon2(h.bottom)]) pairCount[m] = (pairCount[m] ?? 0) + 1;
  const prev = history[history.length - 1];
  const skip = prev ? [canon2(prev.top.slice(-2)), canon2(prev.bottom)] : [];
  const row = (d: string, taken: string[]) => DIGITS10.filter((x) => x !== d && !taken.includes(canon2(d + x)))
    .sort((x, y) => (pairCount[canon2(d + y)] ?? 0) - (pairCount[canon2(d + x)] ?? 0) || x.localeCompare(y))
    .slice(0, SG_DRILL_PER_DIGIT).map((x) => d + x);
  const [a, b] = pick.digits;
  const rowA = row(a, skip);
  const rowB = row(b, [...skip, ...rowA.map(canon2)]);
  return [{ digit: a, numbers: rowA }, { digit: b, numbers: rowB }];
}

export const sgFormula: MarketFormula = {
  name: "สูตรสิงคโปร์ VIP — เลขที่ออกน้อยช่วงหลัง (รวม 30/40/50/60 งวด) + กันติดเลขที่หายนาน",
  evidence: "**วิเคราะห์จากเลขที่ออกของสิงคโปร์ VIP เองเท่านั้น** (1,377 งวด 25 พ.ย. 65–11 ต.ค. 69 จาก raakaadee + exphuay ทับกัน 95 งวดตรงทุกงวด) · เครื่องของสิงคโปร์ถ่วงดุล: เลขที่ออกน้อยในช่วง 30–75 งวดมีโอกาสมากกว่า ชนะสุ่มทั้งสองครึ่งทุกช่วงนับ จึงรวม 4 ช่วงกันการเลือกช่วงที่บังเอิญดี · ทดสอบ walk-forward: ครึ่งแรก ★ 36.8% / 2 ตัว 59.7% · ครึ่งหลัง 38.6% / 62.5% · ปีล่าสุด 41.9% / 64.1% (สุ่ม 33.0 / 57.2) · (13 ต.ค. 69) เพิ่มกฎลดอันดับเลขที่หายเกิน 6 งวด หลังเห็นฟัน 0-4 ซ้ำ 5 วัน — หลุดติดยาวสุดจาก 12 เหลือ 6 งวด · เลขร้อน เลขเมื่อวาน หายนานสุด มาร์คอฟ ไม่ชนะสุ่ม · เลขเจาะไม่มีวิธีไหนชนะสุ่มนิ่ง (~45%) · ได้เปรียบสุ่มราว 3–4 จุด ผลรายวันยังแกว่ง",
  pick: (history) => pickSg(history),
  drill: drillSg,
  noManualOpen: true, // สูตรไม่ใช้ราคาเปิด — ระบบเก็บเองจากฟีดถ้าทัน ไม่ต้องกรอก
  minHistory: SG_MIN_HISTORY,
  since: "2026-10-13", // วันที่สูตรปัจจุบันเริ่มใช้ (ปรับ 13 ต.ค. 69) — ไว้บอกในหมายเหตุของงวดที่ไม่มีเลขล็อก
  drillRandom: 0.452,
};
