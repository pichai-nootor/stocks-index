/**
 * ย้อนหลังของหุ้น VIP ยุโรป (ผู้ใช้ขอ 29 ต.ค. 69: "3 หุ้นนี้ขอดูย้อนหลังด้วย") — แยกจากรายงานผลจริง
 *   แต่ละงวดฟันด้วยสูตรปัจจุบันของตลาดนั้นจากงวดก่อนหน้าเท่านั้น (walk-forward) · สูตรถูกเลือกจากข้อมูลชุดนี้ ผลจึงสูงเกินจริงได้
 *   ซื้อแบบเดียวกับรายงาน: รูดเลขฟัน 2 ตัว + เจาะ 12 ตัว (bet.ts)
 */
import { prisma } from "@/lib/prisma";
import { formulaFor } from "@/lib/formulas";
import { resultDigits, drillHit } from "@/lib/formulas/types";
import { betResult } from "@/lib/bet";
import type { VIP_MARKETS } from "@/lib/vip";

export type BackDraw = { d: string; top: string; bottom: string; pick: [string, string]; drill: string[][]; star: boolean; any: boolean; drillHits: string[]; cost: number; win: number; profit: number };
export type BackMarket = {
  code: string; label: string; draws: BackDraw[];
  n: number; star: number; any: number; drill: number; cost: number; win: number; profit: number; drawdown: number;
  months: { m: string; n: number; profit: number }[];
};

/** from–to = YYYY-MM-DD (รวมทั้งสองวัน) · ประวัติก่อน from ยังใช้ฟันได้ แต่ไม่นับ */
export async function europeBack(userId: string, markets: readonly (typeof VIP_MARKETS)[number][], from: string, to: string, stake: number): Promise<BackMarket[]> {
  const out: BackMarket[] = [];
  for (const m of markets) {
    const F = formulaFor(m.code);
    const all = await prisma.vipResult.findMany({ where: { userId, market: m.code, NOT: { top: "" } }, orderBy: [{ date: "asc" }, { round: "asc" }] });
    const draws: BackDraw[] = [];
    let cum = 0, peak = 0, drawdown = 0;
    all.forEach((row, i) => {
      const d = row.date.toISOString().slice(0, 10);
      if (d < from || d > to) return;
      const hist = all.slice(0, i), p = F.pick(hist, row.open, row.round);
      if (!p) return;
      const drill = F.drill(p, hist).map((x) => x.numbers), top = row.top.slice(-2), dg = resultDigits(row.top, row.bottom);
      const b = betResult(p.digits, drill.flat(), top, row.bottom, stake);
      draws.push({ d, top: row.top, bottom: row.bottom, pick: p.digits, drill, star: dg.includes(p.digits[0]), any: p.digits.some((x) => dg.includes(x)), drillHits: drill.flat().filter((x) => drillHit(x, row.top, row.bottom)), cost: b.cost, win: b.win, profit: b.profit });
      cum += b.profit; peak = Math.max(peak, cum); drawdown = Math.max(drawdown, peak - cum);
    });
    const months = [...new Set(draws.map((x) => x.d.slice(0, 7)))].map((mk) => { const l = draws.filter((x) => x.d.startsWith(mk)); return { m: mk, n: l.length, profit: l.reduce((a, x) => a + x.profit, 0) }; });
    const sum = (k: "cost" | "win" | "profit") => draws.reduce((a, x) => a + x[k], 0);
    out.push({
      code: m.code, label: m.label, draws: draws.reverse(), months, drawdown,
      n: draws.length, star: draws.filter((x) => x.star).length, any: draws.filter((x) => x.any).length, drill: draws.filter((x) => x.drillHits.length).length,
      cost: sum("cost"), win: sum("win"), profit: sum("profit"),
    });
  }
  return out;
}
