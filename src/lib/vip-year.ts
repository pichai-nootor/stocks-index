/**
 * สรุปหุ้น VIP ทั้งปี (ผู้ใช้ขอ 29 ต.ค. 69: "ถ้าเล่นมาทั้งปี ได้กำไรขาดทุนเท่าไหร่" + อยากเห็น UI สรุป)
 *   แยก 2 แบบให้เห็นชัด:
 *     จริง = เฉพาะงวดที่ล็อกเลขฟัน + เลขเจาะไว้ก่อนผลออก (เชื่อได้ · กติกาเดียวกับรายงาน)
 *     ย้อนหลัง = เอาสูตรปัจจุบันไปคิดทุกงวดย้อนหลัง 12 เดือน — สูตรถูกปรับจากข้อมูลชุดนี้เอง ผลจึงสูงเกินจริง ใช้ดูแนวโน้มเท่านั้น
 *   ซื้อแบบเดียวกับหน้าสรุป: รูดเลขฟัน 2 ตัว + เจาะ 12 ตัว (bet.ts)
 */
import { prisma } from "@/lib/prisma";
import { VIP_MARKETS } from "@/lib/vip";
import { formulaFor } from "@/lib/formulas";
import { lockedDrill } from "@/lib/formulas/types";
import { betResult } from "@/lib/bet";
import { REPORT_SKIP_VIP } from "@/lib/day-summary";

export type Money = { n: number; cost: number; win: number };
const zero = (): Money => ({ n: 0, cost: 0, win: 0 });
const add = (m: Money, r: { cost: number; win: number }) => { m.n++; m.cost += r.cost; m.win += r.win; };

export type VipYearMarket = {
  code: string; label: string; counted: boolean;
  retro: Money & { drawdown: number; months: Map<string, number> };
  real: Money & { months: Map<string, number> };
};

/** from/to = YYYY-MM-DD (รวมทั้งสองวัน) */
export async function vipYear(userId: string, from: string, to: string, stake: number) {
  const markets: VipYearMarket[] = [];
  for (const m of VIP_MARKETS) {
    const F = formulaFor(m.code);
    const all = await prisma.vipResult.findMany({ where: { userId, market: m.code, NOT: { top: "" } }, orderBy: [{ date: "asc" }, { round: "asc" }] });
    const retro = { ...zero(), drawdown: 0, months: new Map<string, number>() }, real = { ...zero(), months: new Map<string, number>() };
    let cum = 0, peak = 0;
    all.forEach((row, i) => {
      const d = row.date.toISOString().slice(0, 10);
      if (d < from || d > to) return;
      const top = row.top.slice(-2), mk = d.slice(0, 7);
      // ย้อนหลัง: สูตรปัจจุบันจากประวัติก่อนงวดนี้
      const hist = all.slice(0, i);
      const p = F.pick(hist, row.open, row.round);
      if (p) {
        const b = betResult(p.digits, F.drill(p, hist).flatMap((x) => x.numbers), top, row.bottom, stake);
        add(retro, b);
        retro.months.set(mk, (retro.months.get(mk) ?? 0) + b.profit);
        cum += b.profit; peak = Math.max(peak, cum); retro.drawdown = Math.max(retro.drawdown, peak - cum);
      }
      // จริง: เลขที่ล็อกไว้ก่อนผลออก (เลขฟัน + เลขเจาะ)
      const locked = row.pick && (!F.lockedFrom || d >= F.lockedFrom) ? row.pick.split("-") : null;
      const ld = lockedDrill(row.drill);
      if (locked?.length === 2 && ld) {
        const b = betResult(locked, ld.flatMap((x) => x.numbers), top, row.bottom, stake);
        add(real, b);
        real.months.set(mk, (real.months.get(mk) ?? 0) + b.profit);
      }
    });
    if (retro.n || real.n) markets.push({ code: m.code, label: m.label, counted: !REPORT_SKIP_VIP.includes(m.code), retro, real });
  }
  const months = [...new Set(markets.flatMap((m) => [...m.retro.months.keys(), ...m.real.months.keys()]))].sort();
  const sum = (pick: (m: VipYearMarket) => Money) => markets.filter((m) => m.counted).reduce((a, m) => { const x = pick(m); return { n: a.n + x.n, cost: a.cost + x.cost, win: a.win + x.win }; }, zero());
  return { markets, months, retro: sum((m) => m.retro), real: sum((m) => m.real) };
}
