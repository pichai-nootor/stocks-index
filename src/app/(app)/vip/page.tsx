import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { VIP_MARKETS, isVipMarket, vipMarket, roundLabel, roundCloseThai, pastCloseThai, fetchVipToday, vipDigits, type VipMarket } from "@/lib/vip";
import { formulaFor, hasOwnFormula } from "@/lib/formulas";
import { gradeFormula, resultDigits as vipResultDigits, drillHit as vipDrillHit, RANDOM_ONE as VIP_RANDOM_ONE, RANDOM_TWO as VIP_RANDOM_TWO, type VipPick, type VipDraw } from "@/lib/formulas/types";
import cnHistory from "@/data/vip-history/cn.json";
import hkHistory from "@/data/vip-history/hk.json";
import krHistory from "@/data/vip-history/kr.json";
import twHistory from "@/data/vip-history/tw.json";
import sgHistory from "@/data/vip-history/sg.json";
import ukHistory from "@/data/vip-history/uk.json";
import jpHistory from "@/data/vip-history/jp.json";
import { fmtNum, fmtChange } from "@/lib/stats"; // แค่ฟอร์แมตตัวเลข — การวิเคราะห์ VIP ใช้ src/lib/formulas/vip.ts เท่านั้น
import { todayThai } from "@/lib/intraday";
import { Digits } from "@/components/digit-badges";
import { PickDigits, DrillChips, HitBadge, PickRow } from "@/components/pick-view";
import { StatCard } from "@/components/stat-card";
import { paginate, Pagination } from "@/components/pagination";
import { VipImportButton, VipManualForm, VipDeleteButton, VipOpenForm, VipBundledButton } from "./vip-forms";
import { rememberVipOpen } from "@/app/actions/vip";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const thDate = (d: Date) => d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" });

/** เลขที่ฟัน 2 ตัว (★ ตัวแรก) + เลขเจาะ — ระบายสีตามผลถ้ามี */
function PickBlock({ pick, drill, result, size = "sm", row = false, muted = false }: { pick: VipPick; drill: { digit: string; numbers: string[] }[]; result?: { top: string; bottom: string } | null; size?: "sm" | "lg"; row?: boolean; muted?: boolean }) {
  const digits = result ? vipResultDigits(result.top, result.bottom) : null;
  if (row) return <PickRow digits={pick.digits} hit={digits} drill={drill} isHit={result ? (m) => vipDrillHit(m, result.top, result.bottom) : undefined} muted={muted} />;
  return (
    <div className={muted ? "opacity-60 grayscale-[40%]" : ""}>
      <PickDigits digits={pick.digits} hit={digits} size={muted ? "xs" : size} />
      <DrillChips sets={drill} isHit={result ? (m) => vipDrillHit(m, result.top, result.bottom) : undefined} size={size} />
    </div>
  );
}

/** ชื่อสั้นในแท็บ: "หุ้นอินเดีย VIP" → "อินเดีย" */
const shortLabel = (label: string) => label.replace(/^หุ้น/, "").replace(/ VIP$/, "");

/**
 * หุ้น VIP (stocks-vip.com) — เก็บผลรายวันต่อตลาด + ฟันด้วยสูตรของ VIP เอง (src/lib/formulas/vip.ts)
 * ราคาเปิดของวันถูกเก็บอัตโนมัติทุกครั้งที่เปิดหน้านี้ ผลดึงจากเว็บด้วยปุ่มเดียว — ผู้ใช้ไม่ต้องกรอกอะไรเว้นแต่วันที่เว็บไม่มีแล้ว
 */
export default async function VipPage({ searchParams }: PageProps<"/vip">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const market: VipMarket = typeof sp.market === "string" && isVipMarket(sp.market) ? sp.market : "in";
  const page = Number(sp.page ?? 1) || 1;
  const info = vipMarket(market);
  const thai = todayThai();
  const F = formulaFor(market); // สูตรของตลาดนี้ (src/lib/formulas/<market>.ts)
  const bundledCount = market === "cn" ? (cnHistory as unknown[]).length : market === "hk" ? (hkHistory as unknown[]).length : market === "kr" ? (krHistory as unknown[]).length : market === "jp" ? (jpHistory as unknown[]).length : market === "tw" ? (twHistory as unknown[]).length : market === "sg" ? (sgHistory as unknown[]).length : market === "uk" ? (ukHistory as unknown[]).length : 0;

  const today = await fetchVipToday(market);
  if (today) await rememberVipOpen(userId, market, today); // เก็บราคาเปิดวันนี้อัตโนมัติ (แถวรอผล)
  const all = await prisma.vipResult.findMany({ where: { userId, market }, orderBy: [{ date: "desc" }, { round: "desc" }] });
  // แผน C ของอินเดีย: ใช้ผลหุ้นอินเดียปกติ (SENSEX) ของวันเดียวกัน — ตลาดอื่นไม่โหลด
  const regularByDate = new Map<string, { top: string; bottom: string }>();
  if (market === "in") {
    const sx = await prisma.stock.findFirst({ where: { userId, symbol: "BSE SENSEX" }, include: { records: { where: { closeValue: { not: null } }, orderBy: { date: "desc" }, take: 120 } } });
    const two = (v: number) => String(Math.round(Math.abs(v) * 100) % 100).padStart(2, "0");
    for (const r of sx?.records ?? []) regularByDate.set(r.date.toISOString().slice(0, 10), { top: two(r.closeValue!), bottom: two(r.closeChange!) });
  }
  const pendingRow = all.find((r) => r.top === "") ?? null;
  const rows = all.filter((r) => r.top !== "");
  const counts = await prisma.vipResult.groupBy({ by: ["market"], where: { userId, NOT: { top: "" } }, _count: { _all: true } });
  const countOf = (m: string) => counts.find((c) => c.market === m)?._count._all ?? 0;

  // ฟันย้อนหลังทุกงวด (walk-forward) — งวดที่ i ใช้เฉพาะงวดก่อนหน้า · เฉพาะหน้าที่แสดง (คำนวณทั้งประวัติเฉพาะคะแนนรวม)
  const asc: VipDraw[] = [...rows].reverse();
  // เลขที่ล็อกก่อน F.lockedFrom มาจากสูตรเก่า → ใช้เลขของสูตรปัจจุบันแทน (เก็บเลขเก่าไว้โชว์เป็นหมายเหตุ)
  const lockedByCurrent = (date: Date) => !F.lockedFrom || date.toISOString().slice(0, 10) >= F.lockedFrom;
  const paged = paginate(rows, page);
  const judged = new Map(paged.items.map((r) => {
    const i = asc.length - 1 - rows.indexOf(r); const hist = asc.slice(0, i);
    const computedA = F.pick(hist, r.open);
    const lockedA = lockedByCurrent(r.date) ? r.pick?.split("-") : undefined;
    const a = computedA && lockedA?.length === 2 ? { ...computedA, digits: [lockedA[0], lockedA[1]] as [string, string] } : computedA;
    const b = F.experimental ? F.experimental.pick(r.open, hist) : null;
    const c = F.experimental2 ? F.experimental2.pick(regularByDate.get(r.date.toISOString().slice(0, 10))) : null;
    return [r.id, { a: a ? { pick: a, drill: F.drill(a, hist) } : null, b: b ? { pick: b, drill: F.drill(b, hist) } : null, c: c ? { pick: c, drill: F.drill(c, hist) } : null }] as const;
  }));
  const g = gradeFormula(F, asc);
  // คะแนนของ "เลขที่ล็อกไว้จริง" — นับเฉพาะงวดที่ระบบฟันไว้ก่อนหวยออกแล้วเก็บเลขนั้นไว้ (เชื่อถือได้ 100% ไม่ถูกคำนวณใหม่)
  const lockedRows = rows.filter((r) => r.pick && r.top !== "" && lockedByCurrent(r.date));
  const lockedScore = lockedRows.reduce((acc, r) => {
    const d = vipResultDigits(r.top, r.bottom);
    const pick = r.pick!.split("-");
    return { n: acc.n + 1, star: acc.star + (d.includes(pick[0]) ? 1 : 0), any: acc.any + (pick.some((x) => d.includes(x)) ? 1 : 0) };
  }, { n: 0, star: 0, any: 0 });
  const grade = { hot: g.main, open: g.experimental };
  const drillScore = g.drill;

  // งวดถัดไป
  const nextOpen = today && !today.closed ? today.open : pendingRow?.open ?? null;
  // ราคาปิดงวดล่าสุดก่อนวันนี้ (ไว้แสดง "เปิดวันนี้เทียบปิดวันก่อน" — VIP เปิดใกล้ปิดวันก่อนมาก ต่างกันไม่ถึง 1 จุด จึงไม่มีทิศทางให้ใช้แบบ SENSEX)
  const prevClose = rows.find((r) => r.close !== null && (!today || r.date.toISOString().slice(0, 10) < today.date))?.close ?? null;
  const nextDate = today ? today.date : pendingRow ? pendingRow.date.toISOString().slice(0, 10) : thai;

  const digits10 = "0123456789".split("");
  const freq = Object.fromEntries(digits10.map((d) => [d, 0])) as Record<string, number>;
  const lastSeen: Record<string, number> = {};
  rows.forEach((r, i) => { for (const d of vipDigits(r.top, r.bottom)) { freq[d]++; lastSeen[d] ??= i; } });
  const hot = [...digits10].sort((a, b) => freq[b] - freq[a] || a.localeCompare(b));
  const cold = [...digits10].sort((a, b) => (lastSeen[b] ?? 99) - (lastSeen[a] ?? 99));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{info.label}</h1>
            <p className="text-sm text-slate-500">ผลจาก <a href="https://stocks-vip.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">stocks-vip.com</a> · บน 3 หลัก / ล่าง 2 หลัก · ออกผล {info.rounds.map((r) => roundCloseThai(market, r)).join(" / ")} น. ไทย</p>
          </div>
        </div>
        {/* แท็บตลาด — เลื่อนซ้ายขวาได้บนมือถือ */}
        <nav className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {VIP_MARKETS.map((m) => (
            <Link key={m.code} href={`/vip?market=${m.code}`} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${m.code === market ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
              {shortLabel(m.label)}
              <span className={`ml-1.5 text-[11px] tabular-nums ${m.code === market ? "text-blue-100" : "text-slate-400"}`}>{countOf(m.code).toLocaleString()}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* งวดวันนี้ — แยกแผงต่อรอบ: รอผล (เลขที่ฟัน) → ผลออกแล้ว (ปุ่มดึง) → ผล + คะแนน */}
      <section className="card border-amber-200 bg-gradient-to-br from-amber-50/60 to-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">งวด {new Date(nextDate).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</h2>
            <p className="text-xs text-slate-500">
              {today ? <>
                {today.open !== null
                  ? <>ราคาเปิด <span className="tabular-nums">{fmtNum(today.open)}</span>{prevClose !== null && <span className="text-slate-400"> (เทียบปิดวันก่อน {fmtChange(Math.round((today.open - prevClose) * 100) / 100)})</span>}</>
                  : <span className="text-slate-400">ฟีดตลาดนี้ไม่มีราคาเปิด — เก็บราคาปิด + diff ของแต่ละรอบไว้แทน</span>}
                {" · "}ล่าสุด <span className="tabular-nums">{fmtNum(today.last)}</span> <span className={today.diff < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(today.diff)}</span> · เว็บอัปเดต {today.updatedAt}
              </> : "ดึงราคาวันนี้จากเว็บไม่ได้ — ลองกดดึงอีกครั้ง"}
            </p>
          </div>
          {/* ปุ่มเดียวใช้ได้ทุกเวลา: ดึงราคาเปิด/ล่าสุด + ผลทุกรอบที่ออกแล้ว */}
          <VipImportButton market={market} label="ดึงข้อมูลจากเว็บตอนนี้" />
        </div>
        <div className={`mt-3 grid gap-4 ${info.rounds.length > 1 ? "md:grid-cols-2" : ""}`}>
          {info.rounds.map((round) => {
            const rowOf = rows.find((x) => x.date.toISOString().slice(0, 10) === nextDate && x.round === round) ?? null;
            const closed = today ? pastCloseThai(market, nextDate, new Date(), round) || (round === Math.max(...info.rounds) && today.closed) : false;
            const feedReady = today ? (today.rounds.some((x) => x.round === round) || (round === Math.max(...info.rounds) && today.feedDone)) : false;
            const title = info.rounds.length > 1 ? `รอบ${round === 1 ? "เช้า" : "บ่าย"} · ออกผล ${roundCloseThai(market, round)} น.` : `ออกผล ${roundCloseThai(market, round)} น. ไทย`;
            // เลขที่ฟันสำหรับรอบนี้: ใช้ทุกงวดก่อนหน้ารอบนี้ (รอบบ่ายรวมผลรอบเช้าของวันเดียวกัน)
            const histBefore = rowOf ? asc.slice(0, asc.length - 1 - rows.indexOf(rowOf)) : asc;
            // ส่งราคาสด (ราคา + diff) ให้สูตรด้วย — ตลาดที่หา "D สด" ได้จะคำนวณคู่ผูกจากโครงสร้างราคา
            const liveNow = today && !rowOf ? { price: today.last, diff: today.diff } : null;
            const computed = F.pick(histBefore, rowOf ? rowOf.open : nextOpen, round, liveNow ?? undefined);
            // ถ้าเคยล็อกเลขไว้ (ตอนกดดึงข้อมูลก่อนหวยออก) ให้ยึดเลขนั้นเสมอ — ผลย้อนหลังจะได้ไม่เปลี่ยนตามสูตรที่แก้ทีหลัง
            const lockedRow = rowOf ?? pendingRow;
            const locked = lockedRow?.pick && lockedByCurrent(lockedRow.date) && lockedRow.date.toISOString().slice(0, 10) === (rowOf ? rowOf.date.toISOString().slice(0, 10) : nextDate) && lockedRow.round === round ? lockedRow.pick.split("-") : null;
            const p = computed && locked && locked.length === 2 ? { ...computed, digits: [locked[0], locked[1]] as [string, string], note: `${computed.note} · (เลขนี้ล็อกไว้ตอนดึงข้อมูลก่อนหวยออก)` } : computed;
            const drill = p ? F.drill(p, histBefore) : [];
            const bp = F.experimental ? F.experimental.pick(rowOf ? rowOf.open : nextOpen, histBefore) : null;
            const bDrill = bp ? F.drill(bp, histBefore) : [];
            const cp = F.experimental2 ? F.experimental2.pick(regularByDate.get(rowOf ? rowOf.date.toISOString().slice(0, 10) : nextDate)) : null;
            const cDrill = cp ? F.drill(cp, histBefore) : [];
            const planCBlock = cp ? (
              <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                <p className="text-xs text-slate-500">{F.experimental2!.name} <span className="text-slate-400">(แค่เก็บคะแนนเทียบ)</span></p>
                <div className="mt-1"><PickBlock pick={cp} drill={cDrill} result={rowOf} muted /></div>
                <p className="mt-1 text-[10px] text-slate-400">{cp.note}</p>
              </div>
            ) : null;
            const expBlock = bp ? (
              <div className="mt-3 border-t border-dashed border-slate-200 pt-2">
                <p className="text-xs text-slate-500">{F.experimental!.name} <span className="text-slate-400">(แค่เก็บคะแนนเทียบ)</span></p>
                <div className="mt-1"><PickBlock pick={bp} drill={bDrill} result={rowOf} muted /></div>
              </div>
            ) : null;
            if (rowOf) {
              const digits = vipResultDigits(rowOf.top, rowOf.bottom);
              const hit = p ? p.digits.filter((d) => digits.includes(d)) : [];
              const dh = drill.flatMap((s) => s.numbers).filter((m) => vipDrillHit(m, rowOf.top, rowOf.bottom));
              return (
                <div key={round} className="rounded-xl border border-emerald-200 bg-white/80 p-3">
                  <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-medium text-emerald-900">{title}</p><span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">ผลออกแล้ว</span></div>
                  <div className="mt-2 flex flex-wrap items-start gap-5">
                    <div>
                      <p className="text-xs text-slate-500">ผล บน / ล่าง</p>
                      <div className="mt-1 flex items-center gap-2"><Digits value={rowOf.top} hilite={p ? p.digits : []} tone="blue" /> <Digits value={rowOf.bottom} hilite={p ? p.digits : []} tone="blue" /></div>
                      {rowOf.close !== null && <p className="mt-1 text-xs tabular-nums text-slate-500">ราคา {fmtNum(rowOf.close)} <span className={(rowOf.diff ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(rowOf.diff ?? 0)}</span></p>}
                    </div>
                    {p && (
                      <div>
                        <p className="text-xs text-slate-500">ที่ฟันไว้</p>
                        <div className="mt-1"><PickBlock pick={p} drill={drill} result={rowOf} /></div>
                        <div className="mt-2"><HitBadge pick={p.digits} hits={hit} drillHits={dh} /></div>
                      </div>
                    )}
                  </div>
                  {expBlock}
                  {planCBlock}
                </div>
              );
            }
            if (closed) {
              return (
                <div key={round} className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3">
                  <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-medium text-emerald-900">{title}</p><span className="rounded bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-900">ผลออกแล้ว — ยังไม่ได้ดึง</span></div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <VipImportButton market={market} label={info.rounds.length > 1 ? `ดึงผลรอบ${round === 1 ? "เช้า" : "บ่าย"}` : "ดึงผลปิดงวดนี้"} big />
                    <span className="text-xs text-slate-600">{feedReady ? "กดครั้งเดียว ระบบบันทึกผล ให้คะแนนเลขที่ฟัน และเตรียมรอบถัดไป" : "เว็บยังส่งราคาไม่ถึงแถวสุดท้าย — ถ้ากดตอนนี้จะยังไม่ได้ผล รออีกสักครู่แล้วกดใหม่"}</span>
                  </div>
                  {p && <div className="mt-3"><p className="text-xs text-slate-500">ที่ฟันไว้</p><div className="mt-1"><PickBlock pick={p} drill={drill} /></div></div>}
                  {expBlock}
                  {planCBlock}
                </div>
              );
            }
            // รอบหลังของวัน: รอผลรอบก่อนหน้าก่อน (สูตรใช้ผลรอบก่อนเป็น "งวดก่อน") — ไม่โชว์เลขล่วงหน้าให้สับสน
            const earlierPending = info.rounds.some((r2) => r2 < round && !rows.some((x) => x.date.toISOString().slice(0, 10) === nextDate && x.round === r2));
            if (earlierPending) {
              return (
                <div key={round} className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-3">
                  <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-medium text-slate-600">{title}</p><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">รอผลรอบก่อน</span></div>
                  <p className="mt-2 text-sm text-slate-500">จะฟันรอบนี้หลังดึงผลรอบเช้า — สูตรคำนวณใหม่โดยใช้ผลรอบเช้าเป็นงวดล่าสุด</p>
                </div>
              );
            }
            return (
              <div key={round} className="rounded-xl border border-amber-200 bg-white/80 p-3">
                <div className="flex items-baseline justify-between gap-2"><p className="text-sm font-medium text-amber-900">{title}</p><span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">รอผล</span></div>
                {p ? (
                  <div className="mt-3">
                    <p className="mb-2 text-xs text-slate-500">เลขฟัน (★ = ตัวเด่น) · เลขเจาะ 2 ชุด กลับได้</p>
                    <PickBlock pick={p} drill={drill} size="lg" />
                    <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer text-blue-600">ทำไมเลขนี้</summary><p className="mt-1">{p.note}</p></details>
                  </div>
                ) : <p className="mt-2 text-sm text-slate-500">ยังฟันไม่ได้ — ต้องมีผลอย่างน้อย {F.minHistory} งวด</p>}
                {expBlock}
                {planCBlock}
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">ผลจริง (เลขที่ล็อกก่อนผลออก{F.lockedFrom ? ` ตั้งแต่ ${F.lockedFrom}` : ""})</p>
            {lockedScore.n > 0 ? <p className="mt-0.5 text-sm"><b>{lockedScore.n}</b> งวด · ★ <b>{pct(lockedScore.star / lockedScore.n)}</b> · 2 ตัว <b>{pct(lockedScore.any / lockedScore.n)}</b></p> : <p className="mt-0.5 text-sm text-slate-400">ยังไม่มีงวดที่ล็อกแล้วออกผล</p>}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
            <p className="text-[11px] font-medium text-slate-500">ทดสอบย้อนหลัง {grade.hot.n.toLocaleString()} งวด <span className="text-slate-400">(สุ่ม ★ {pct(VIP_RANDOM_ONE)} · 2 ตัว {pct(VIP_RANDOM_TWO)} · เจาะ ~{F.drillRandom ? pct(F.drillRandom) : "42%"})</span></p>
            <p className="mt-0.5 text-sm">★ <b>{grade.hot.n ? pct(grade.hot.star / grade.hot.n) : "-"}</b> · 2 ตัว <b>{grade.hot.n ? pct(grade.hot.any / grade.hot.n) : "-"}</b> · เจาะ <b>{drillScore.n ? pct(drillScore.hit / drillScore.n) : "-"}</b></p>
          </div>
        </div>
        {F.experimental && (
          <details className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-3 text-sm">
            <summary className="cursor-pointer text-slate-600">{F.experimental.name} — วิธีคิดและข้อจำกัด (เลขที่ฟันอยู่ในแผงของแต่ละรอบ) · ย้อนหลัง {grade.open.n} งวด: ★ {grade.open.n ? pct(grade.open.star / grade.open.n) : "-"} · ≥1 {grade.open.n ? pct(grade.open.any / grade.open.n) : "-"}</summary>
            <p className="mt-2 text-xs text-slate-500"><b>วิธีคิด:</b> {F.experimental.how}</p>
            <p className="mt-1 text-xs text-slate-500"><b>ข้อจำกัด:</b> {F.experimental.caveat}</p>
          </details>
        )}
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">{F.name} — หลักฐานของสูตร</summary>
          <p className="mt-1">{F.evidence}{hasOwnFormula(market) ? <span className="text-slate-400"> · ไฟล์ src/lib/formulas/{market}.ts</span> : <span className="text-slate-400"> · ตลาดนี้ยังไม่มีสูตรเฉพาะ ใช้สูตรทั่วไป</span>}</p>
        </details>
        <p className="mt-2 text-xs text-slate-500"><b>ไม่ต้องกรอกอะไร:</b> ระบบเก็บราคาและล็อกเลขฟันเองทุกครั้งที่เปิดหน้านี้ · ผลออกแล้วจะมีปุ่มดึงโผล่ในแผงของรอบนั้น</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="ผลที่เก็บไว้" value={`${rows.length} งวด`} hint={rows.length ? `${thDate(rows[rows.length - 1].date)} → ${thDate(rows[0].date)}` : "ยังไม่มี — กดดึงจากเว็บ"} />
        <StatCard label="เลขออกบ่อยสุด" value={rows.length ? hot.slice(0, 3).join(" ") : "-"} hint={rows.length ? hot.slice(0, 3).map((d) => `${d}: ${freq[d]}/${rows.length}`).join(" · ") : undefined} />
        <StatCard label="เลขไม่ออกนานสุด" value={rows.length ? cold.slice(0, 3).join(" ") : "-"} hint={rows.length ? cold.slice(0, 3).map((d) => `${d}: ${lastSeen[d] === undefined ? `>${rows.length}` : lastSeen[d]} งวด`).join(" · ") : undefined} />
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">เพิ่มผล</h2>
            <p className="text-xs text-slate-500">เว็บให้ย้อนหลัง ~15 วัน — กดทุกวันหลังออกผล · วันที่เว็บไม่มีแล้วกรอกเอง (ซ้ำวันเดิม = แก้ทับ)</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {bundledCount > 0 && <VipBundledButton market={market} count={bundledCount} />}
            <VipImportButton market={market} />
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-blue-600">กรอกผลเอง</summary>
          <div className="mt-3"><VipManualForm market={market} rounds={info.rounds} today={thai} /></div>
        </details>
      </section>

      <section className="card p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <h2 className="font-medium">ประวัติ + ผลฟันรายงวด ({rows.length})</h2>
          <span className="text-xs text-slate-500">★ = ตัวเด่น · เหลือง = เลขที่ฟันแล้วออก · ขีดฆ่า = ไม่ออก · เขียว = เลขเจาะที่มา (ตรงหรือกลับ)</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">ยังไม่มีผล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">{F.noManualOpen ? "งวด" : "งวด · ราคาเปิด"}</th>
                  <th className="px-3 py-2 text-amber-800">ฟัน ({F.name.split(" — ")[0]}) + เจาะ</th>
                  {F.experimental && <th className="px-3 py-2 text-slate-400">ทดลอง (เก็บคะแนนเทียบ)</th>}
                  {F.experimental2 && <th className="px-3 py-2 text-slate-500">แผน C (จากปกติ)</th>}
                  <th className="px-3 py-2">ผล บน / ล่าง</th>
                  <th className="px-3 py-2 text-amber-800">ผลฟัน</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.items.map((r) => {
                  const j = judged.get(r.id)!;
                  const digits = vipResultDigits(r.top, r.bottom);
                  const hitA = j.a ? j.a.pick.digits.filter((d) => digits.includes(d)) : null;
                  const hitB = j.b ? j.b.pick.digits.filter((d) => digits.includes(d)) : null;
                  const hitC = j.c ? j.c.pick.digits.filter((d) => digits.includes(d)) : null;
                  return (
                    <tr key={r.id} className="transition hover:bg-slate-50/60">
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-700">
                        {thDate(r.date)}{info.rounds.length > 1 && <span className="ml-1 text-xs text-slate-500">{roundLabel(r.round, market)}</span>}
                        <div className="text-xs tabular-nums text-slate-400">{r.open !== null ? <>เปิด {fmtNum(r.open)} </> : null}{!F.noManualOpen && <VipOpenForm id={r.id} open={r.open} />}</div>
                      </td>
                      <td className="px-3 py-2">{j.a ? <><PickBlock pick={j.a.pick} drill={j.a.drill} result={r} row />{r.pick && !lockedByCurrent(r.date) && <div className="mt-1 text-[10px] text-slate-400">สูตรเดิมล็อกไว้ {r.pick}</div>}</> : <span className="text-xs text-slate-400">ยังไม่พอ {F.minHistory} งวด</span>}</td>
                      {F.experimental && <td className="px-3 py-2">{j.b ? <PickBlock pick={j.b.pick} drill={j.b.drill} result={r} row muted /> : <span className="text-xs text-slate-400">–</span>}</td>}
                      {F.experimental2 && <td className="px-3 py-2">{j.c ? <PickBlock pick={j.c.pick} drill={j.c.drill} result={r} row muted /> : <span className="text-xs text-slate-400">– ยังไม่มีผลหุ้นปกติของวันนี้</span>}</td>}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Digits value={r.top} hilite={[...(hitA ?? []), ...(hitB ?? []), ...(hitC ?? [])]} tone="blue" /> <Digits value={r.bottom} hilite={[...(hitA ?? []), ...(hitB ?? []), ...(hitC ?? [])]} tone="blue" />
                        {r.close !== null && <div className="mt-1 text-xs tabular-nums text-slate-400">ปิด {fmtNum(r.close)} <span className={(r.diff ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.diff ?? 0)}</span></div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {j.a && <HitBadge pick={j.a.pick.digits} hits={hitA} drillHits={j.a.drill.flatMap((x) => x.numbers).filter((m) => vipDrillHit(m, r.top, r.bottom))} />}
                        {hitC && <div className="mt-1"><span className="text-slate-400">แผน C</span> {hitC.length ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">✓ {hitC.join(" ")}</span> : <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">✗</span>}</div>}
                        {hitB && <div className="mt-1"><span className="text-slate-400">ทดลอง</span> {hitB.length ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">✓ {hitB.join(" ")}</span> : <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">✗</span>}</div>}
                      </td>
                      <td className="px-3 py-2 text-right"><VipDeleteButton id={r.id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination {...paged} href={(n) => `/vip?market=${market}&page=${n}`} />
          </div>
        )}
      </section>
    </div>
  );
}
