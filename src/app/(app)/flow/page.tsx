import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { todayThai } from "@/lib/intraday";
import { FLOW_ROUNDS, resultOf, countFlow, flowTwo, flowDrill, walkDay, flowMoney, flowSlotOf, flowModel, flowStreak, FOLLOW_STREAK, type RoundEst, backtest, RANDOM_TWO, guessLocked, nextGuessDate, scoreGuess, systemGuess, thaiHour, thaiHHMM, SYS_METHOD, type FlowResult, type FlowSlot } from "@/lib/flow";
import { flowDays, openedSlots, lockFlowSystem } from "@/lib/flow-lock";
import { deleteFlowGuess } from "@/app/actions/flow";
import { AnalyzeButton } from "./analyze-button";
import { GuessForm } from "./guess-form";
import { AutoRefresh } from "./auto-refresh";
import { RangePicker } from "@/components/range-picker";
import { CopyPending } from "@/components/copy-pending";
import { BET, STAKES, parseStake, betCost, betResult } from "@/lib/bet";

const BET_STAKE = BET.stake;

/** วันที่ผลออกเกือบครบ (≥8 รอบ) ถึงนับเข้าสถิติเลขทาย — กันวันที่ผลยังไม่ครบไปถ่วงคะแนน */
const FULL_DAY = 8;
const rankOf = (m: string) => (m === SYS_METHOD ? 0 : m.startsWith(SYS_METHOD) ? 1 : 2);

const shift = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const pct = (h: number, n: number) => (n ? `${((100 * h) / n).toFixed(1)}%` : "—");
const ORDER = new Map(FLOW_ROUNDS.map((r, i) => [r.slot, i]));
const sortDay = (l: FlowResult[]) => l.sort((a, b) => ORDER.get(a.slot)! - ORDER.get(b.slot)!);

/**
 * เลขไหล (หุ้นปกติ · ผู้ใช้ขอ 22 ต.ค. 69) — ดูอย่างเดียว ไม่อยู่ในสูตรฟัน ไม่ล็อกเลข
 *   ผลรายวันเรียงตามเวลา + 2 ตัวที่ไหลอยู่ ณ ตอนนี้ (ใช้กับรอบที่ยังไม่ออก) + นับผลจริงทุกวันเทียบสุ่ม 59%
 *   ทดสอบก่อนทำ: ไหลทั้งวัน/ไหลสั้น/คู่ไหล/ข้ามวัน ≈ สุ่มทั้งหมด → หน้านี้ให้ผลจริงเป็นตัวตัดสินต่อ
 */
export default async function FlowPage({ searchParams }: PageProps<"/flow">) {
  const { userId } = await requireUser();
  const today = todayThai();
  const sp = await searchParams;
  const asked = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const day = asked > today ? today : asked;
  const stake = parseStake(sp.stake);
  const tab = sp.tab === "buy" || sp.tab === "lab" ? sp.tab : "today";
  // ช่วงที่ดูในส่วนการเข้าซื้อ (?from=&to= · ผู้ใช้ 29 ต.ค. 69: Date Range Picker) — ไม่ได้เลือก = 1 ของเดือน → วันที่เลือก
  const isYmd = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const picked = isYmd(sp.from) && isYmd(sp.to) && sp.from <= sp.to ? { from: sp.from, to: sp.to > today ? today : sp.to } : null;

  // ผลจริงของผู้ใช้ → วัน → รอบ
  const stocks = await prisma.stock.findMany({ where: { userId }, include: { records: true } });
  const byDay = flowDays(stocks);
  const lock = await lockFlowSystem(userId, byDay, openedSlots(stocks)); // ระบบคิด + ล็อกเลขไหลของวันทำการถัดไป (ครั้งเดียว ก่อน 09:30)

  const done = byDay.get(day) ?? [];
  const doneSlots = new Set<FlowSlot>(done.map((r) => r.slot));
  const walk = walkDay(done);
  const counts = countFlow(done);
  const now = flowTwo(done);
  const nowDrill = now.length ? flowDrill(done) : [];
  // ไม่มีข้อมูลเปิด = วันนั้นปิด (ตัดสินได้เมื่อวันผ่านไปแล้ว หรือหลัง 16:00 ไทย · ดาวโจนส์เปิด 20:30 → รอจนวันผ่าน)
  const openedToday = openedSlots(stocks).get(day) ?? new Set<FlowSlot>();
  const hourNow = thaiHour();
  const isClosed = (slot: FlowSlot) => !openedToday.has(slot) && (day < today || (hourNow >= 16 && slot !== "dj"));

  // ผลจริงทุกวันที่มีในระบบ (ใหม่ → เก่า)
  const realDays = [...byDay].filter(([, l]) => l.length >= 3).sort((a, b) => b[0].localeCompare(a[0]));
  const realRows = realDays.map(([d, l]) => {
    const w = walkDay(l).filter((x) => x.hit !== null);
    return { d, n: w.length, hit: w.filter((x) => x.hit).length, top: countFlow(l).sort((a, b) => b.rounds - a.rounds)[0] };
  });
  const real = realRows.reduce((a, r) => ({ n: a.n + r.n, hit: a.hit + r.hit }), { n: 0, hit: 0 });
  const real30 = realRows.slice(0, 30).reduce((a, r) => ({ n: a.n + r.n, hit: a.hit + r.hit }), { n: 0, hit: 0 });

  // ทดสอบย้อนหลังจากราคารายวัน (IndexDay) · วันที่มีรอบเช้าครบ (ต.ค. 66 →)
  const idx = await prisma.indexDay.findMany({ where: { key: { in: FLOW_ROUNDS.map((r) => r.key) } } });
  const keySlot = new Map<string, FlowSlot>(FLOW_ROUNDS.map((r) => [r.key, r.slot]));
  const hist = new Map<string, FlowResult[]>();
  // ราคาปิดเมื่อวาน วัน|หุ้น: ของผู้ใช้ (เปิด − เปลี่ยนตอนเปิด · รู้ก่อนผลออก) ก่อน · ไม่มีใช้ราคาทางการ
  const prevClose = new Map<string, number>();
  for (const x of idx) { const l = hist.get(x.date) ?? []; l.push(resultOf(keySlot.get(x.key)!, x.close, x.close - x.prevClose)); hist.set(x.date, l); prevClose.set(`${x.date}|${keySlot.get(x.key)}`, x.prevClose); }
  for (const st of stocks) { const slot = flowSlotOf(st.symbol); if (slot) for (const r of st.records) prevClose.set(`${r.date.toISOString().slice(0, 10)}|${slot}`, r.openValue - r.openChange); }
  const histDays = [...hist.values()].filter((l) => l.length >= 10).map(sortDay);
  const bt = backtest(histDays);

  // ถ้าแทงเลขไหลทุกรอบ: ผลจริงของผู้ใช้ (วันที่ผลออก ≥3 รอบ) + ย้อนหลังจากราคารายวัน
  // หุ้นแนะนำรายวัน: คะแนนจากผลครบวัน (ราคารายวัน) ก่อนวันนั้นเท่านั้น
  const histFull = [...hist.entries()].filter(([, l]) => l.length >= 10).map(([d, l]) => [d, sortDay(l)] as const);
  const model = flowModel(histFull);
  /** วิเคราะห์รอบ: เลขไหลของวันนั้นก่อนรอบนี้ + สถิติก่อนวันนั้น */
  const estOf = (d: string, slot: FlowSlot, done: FlowResult[]) => model(d)(slot, done, prevClose.get(`${d}|${slot}`));
  // การเข้าซื้อเลขไหล = 3 หุ้นหลัก + หุ้นอื่นในวันที่เลขไหลน่าไปหุ้นนั้น
  const moneyReal = flowMoney(realDays, stake, (w, d, l) => !!estOf(d, w.r.slot, l.slice(0, w.i))?.play);
  // ทุกเดือนย้อนหลัง (ผู้ใช้ 29 ต.ค. 69: "อยากเห็นทุกเดือน ว่ามันโอเคไหม") — วิธีเดียวกัน แต่ผลจากราคาปิดรายวัน (IndexDay ต.ค. 66 →) · แต่ละวันใช้สถิติก่อนวันนั้นเท่านั้น
  const moneyHist = flowMoney(histFull, stake, (w, d, l) => !!estOf(d, w.r.slot, l.slice(0, w.i))?.play);
  /** รายวัน ใหม่ → เก่า พร้อมกำไรสะสม (นับจากวันแรก) */
  const dailyOf = (m: ReturnType<typeof flowMoney>) => [...m.rows].sort((a, b) => a.d.localeCompare(b.d)).reduce<((typeof m.rows)[number] & { cum: number })[]>((l, r) => [...l, { ...r, cum: (l.at(-1)?.cum ?? 0) + r.win - r.cost }], []).reverse();
  // วันที่เลือก: เงินแต่ละรอบ (แทงเลขไหล + เจาะ ก่อนรอบนั้น)
  const betOf = (w: (typeof walk)[number]) => (w.two.length ? betResult(w.two, w.drill.flat(), w.r.top, w.r.bottom, stake) : null);
  // รวมวันนี้ = เฉพาะรอบที่แนะนำ (ผู้ใช้ 29 ต.ค. 69) · รอบอื่นแสดงจาง ๆ ไว้ดูเฉย ๆ
  const playedOf = (w: (typeof walk)[number]) => !!estOf(day, w.r.slot, done.slice(0, w.i))?.play;
  const dayBets = walk.filter(playedOf).map(betOf).filter((b): b is NonNullable<typeof b> => !!b);
  const dayMoney = { rounds: dayBets.length, cost: dayBets.reduce((a, b) => a + b.cost, 0), win: dayBets.reduce((a, b) => a + b.win, 0) };
  /** ต่อเดือน: กำไรเฉลี่ย · ทุนเฉลี่ย · เดือนกำไร · เดือนแย่/ดีสุด */
  const monthStatOf = (m: ReturnType<typeof flowMoney>) => {
    const p = m.months.map((x) => x.win - x.cost), n = p.length;
    return { n, plus: p.filter((x) => x > 0).length, avg: n ? Math.round(p.reduce((a, b) => a + b, 0) / n) : 0, cost: n ? Math.round(m.total.cost / n) : 0, worst: Math.min(0, ...p), best: Math.max(0, ...p) };
  };
  /** ตารางรายปี → รายเดือน (ใหม่ → เก่า) */
  const monthTable = (m: ReturnType<typeof flowMoney>) => (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs text-slate-500">
        <tr><th className="px-2 py-1.5 text-left">เดือน</th><th className="px-2 py-1.5 text-right">แนะนำ</th><th className="px-2 py-1.5 text-right">เข้า</th><th className="px-2 py-1.5 text-right">ซื้อ</th><th className="px-2 py-1.5 text-right">ได้</th><th className="px-2 py-1.5 text-right">กำไร</th></tr>
      </thead>
      {[...m.years].reverse().map((y) => {
        const ms = m.months.filter((x) => x.m.startsWith(y.y));
        return (
          <tbody key={y.y} className="divide-y divide-slate-100 border-t-2 border-slate-200">
            <tr className="bg-slate-50 font-semibold">
              <td className="px-2 py-1.5">สรุปปี {+y.y + 543} <span className="text-xs font-normal text-slate-500">เดือนกำไร {ms.filter((x) => x.win > x.cost).length}/{ms.length}</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{y.rounds}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{y.hits} <span className="text-xs font-normal text-slate-500">({Math.round((100 * y.hits) / y.rounds)}%)</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{y.cost.toLocaleString("th-TH")}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{y.win.toLocaleString("th-TH")}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${tone(y.win - y.cost)}`}>{baht(y.win - y.cost)}</td>
            </tr>
            {[...ms].reverse().map((x) => (
              <tr key={x.m} className={x.m >= rFrom.slice(0, 7) && x.m <= rTo.slice(0, 7) ? "bg-amber-50" : ""}>
                <td className="px-2 py-1 pl-4"><Link href={navM(x.m)} scroll={false} className="text-blue-700 hover:underline">{new Date(`${x.m}-01`).toLocaleDateString("th-TH", { month: "long" })}</Link></td>
                <td className="px-2 py-1 text-right tabular-nums">{x.rounds}</td>
                <td className="px-2 py-1 text-right tabular-nums">{x.hits} <span className="text-xs text-slate-500">({Math.round((100 * x.hits) / x.rounds)}%)</span></td>
                <td className="px-2 py-1 text-right tabular-nums">{x.cost.toLocaleString("th-TH")}</td>
                <td className="px-2 py-1 text-right tabular-nums">{x.win.toLocaleString("th-TH")}</td>
                <td className={`px-2 py-1 text-right font-medium tabular-nums ${tone(x.win - x.cost)}`}>{baht(x.win - x.cost)}</td>
              </tr>
            ))}
          </tbody>
        );
      })}
    </table>
  );
  const rFrom = picked?.from ?? `${day.slice(0, 7)}-01`, rTo = picked?.to ?? day;
  const rangeStat = (m: ReturnType<typeof flowMoney>) => {
    const l = m.rows.filter((r) => r.d >= rFrom && r.d <= rTo).sort((a, b) => a.d.localeCompare(b.d));
    const p = l.map((r) => r.win - r.cost);
    const items = l.flatMap((r) => r.items);
    // แยกตามหุ้นที่แนะนำ: กี่รอบ · เลขไหลเข้ากี่รอบ · ได้/เสีย (เรียงตามเวลาออกผล)
    const bySlot = FLOW_ROUNDS.map((r) => { const x = items.filter((i) => i.slot === r.slot); return { r, n: x.length, hit: x.filter((i) => i.hit).length, profit: x.reduce((a, i) => a + i.profit, 0) }; }).filter((x) => x.n);
    return { days: l.length, rounds: items.length, hits: items.filter((i) => i.hit).length, plusRounds: items.filter((i) => i.profit > 0).length, bySlot, cost: l.reduce((a, r) => a + r.cost, 0), win: l.reduce((a, r) => a + r.win, 0), plus: p.filter((x) => x > 0).length, worst: Math.min(0, ...p), best: Math.max(0, ...p), last: l.at(-1)?.d };
  };
  const thDate = (d: string, year = true) => new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", ...(year ? { year: "2-digit" } : {}) });
  const rangeName = rFrom === rTo ? thDate(rFrom) : `${thDate(rFrom, rFrom.slice(0, 4) !== rTo.slice(0, 4))} – ${thDate(rTo)}`;
  // ผลจริงมีตั้งแต่ ส.ค. 69 · วันก่อนนั้นใช้ย้อนหลังจากราคาปิด (ช่วงเดียวกันไม่นับซ้ำ)
  const firstReal = moneyReal.rows.map((r) => r.d).sort()[0] ?? "9999-12-31";
  const moneyAll = { ...moneyReal, rows: [...moneyHist.rows.filter((r) => r.d < firstReal), ...moneyReal.rows] };
  const rangeHasHist = rFrom < firstReal && moneyHist.rows.some((r) => r.d >= rFrom && r.d <= rTo && r.d < firstReal);
  const firstDay = moneyAll.rows.map((r) => r.d).sort()[0] ?? rFrom;

  const nav = (d: string, st = stake, t: string = tab) => `/flow?date=${d}${st !== BET_STAKE ? `&stake=${st}` : ""}${t !== "today" ? `&tab=${t}` : ""}${picked ? `&from=${picked.from}&to=${picked.to}` : ""}`;
  /** เปลี่ยนช่วงในส่วนการเข้าซื้อ — วันที่และสัญญาณด้านบนคงเดิม */
  const navBase = `/flow?date=${day}${stake !== BET_STAKE ? `&stake=${stake}` : ""}&tab=buy`;
  const navM = (m: string) => `${navBase}&from=${m}-01&to=${shift(`${shift(`${m}-01`, 31).slice(0, 7)}-01`, -1)}#buy`; // ทั้งเดือน (+31 วัน = เดือนถัดไปเสมอ → ถอย 1 วัน)
  const baht = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("th-TH")}`;
  const tone = (x: number) => (x > 0 ? "text-emerald-600" : x < 0 ? "text-rose-600" : "");
  const chip = (d: string, on: boolean) => <span key={d} className={on ? "rounded bg-amber-200 px-0.5 font-bold text-amber-900" : ""}>{d}</span>;
  const show = (s: string, mark: string[]) => s.split("").map((c, i) => <span key={i}>{chip(c, mark.includes(c))}</span>);
  const nowDs = now.map((x) => x.d);
  // copy เลขไหล + เจาะ ของรอบที่ยังไม่ออก (รูปแบบเดียวกับปุ่ม copy หน้า VIP/สรุป)
  const copyItem = (r: (typeof FLOW_ROUNDS)[number]) => ({ label: `${r.label} ${r.time}`, pick: nowDs.length ? nowDs : null, drill: nowDrill, status: "pending" });
  // สัญญาณเล่น: ทุกหุ้นที่ยังเปิด · หุ้นหลัก + หุ้นที่เลขไหลวันนี้น่าไป (รอบก่อนหน้ายังไม่ครบ = อาจเปลี่ยน)
  const hhmm = thaiHHMM();
  const labelOf = (slot: FlowSlot) => FLOW_ROUNDS.find((x) => x.slot === slot)!.label;
  const rounds = FLOW_ROUNDS.filter((r) => !isClosed(r.slot)).map((r) => {
    const w = walk.find((x) => x.r.slot === r.slot);
    const before = w ? done.slice(0, w.i) : done;
    const est = estOf(day, r.slot, before);
    const picked = !!est?.play;
    const t = flowTwo(before);
    const waitFor = FLOW_ROUNDS.slice(0, ORDER.get(r.slot)).filter((x) => !isClosed(x.slot) && !doneSlots.has(x.slot));
    // ดาวโจนส์ผลออก 03:05 คืนถัดไป → วันเดียวกันไม่นับว่าเลยเวลา
    const late = r.slot !== "dj" && hhmm >= r.time;
    const hasFlow = !!est;
    const state = w ? (!w.two.length ? "nodata" : picked ? "done" : "passed")
      : day < today ? "nodata" : late ? "late" : !hasFlow ? "early" : waitFor.length ? (picked ? "wait" : "watch") : picked ? "play" : "skip";
    return { r, w, est, picked, hasFlow, t, n: before.length, waitFor, state };
  });
  const signals = rounds.filter((x) => ["play", "wait", "done"].includes(x.state));
  // สรุปวันนี้: เลขไหลตอนนี้แรงแค่ไหน + เข้าติดกันกี่รอบ
  const nowMood = rounds.find((x) => !x.w && x.est)?.est?.mood ?? null;
  const nowStreak = flowStreak(done);
  /** เหตุผลจากตลาดวันนั้น */
  const why = (x: { t: ReturnType<typeof flowTwo>; n: number; est: RoundEst | null }) => (x.t.length && x.est ? `วันนี้ออกแล้ว ${x.n} รอบ: เลข ${x.t[0].d} ออก ${x.t[0].rounds} รอบ (${Math.round(x.est.mood.ratio * 100)}% ไหล${x.est.mood.strength}) · เลข ${x.t[1].d} ออก ${x.t[1].rounds} รอบ` : "");
  /** เลขไหลแบบวันนี้ เคยไหลไปหุ้นนี้แล้วได้ไหม */
  const past = (e: RoundEst | null) => e ? `ในอดีตตอนเลขไหล${e.mood.strength}${e.mood.lead ? "และตัวแรกนำ" : "และเสมอกัน"} หุ้นนี้ ${e.cellN} รอบ ซื้อ 100 ได้คืน ${e.cellRet === null ? "—" : (e.cellRet * 100).toFixed(0)}` : "";
  // ประวัติสัญญาณ: วันที่มีผลจริง (ใหม่ → เก่า) · รอบที่แนะนำ ณ ตอนนั้น = เลขไหลที่จะเล่น ผล เข้าไหม กำไร
  const signalHistory = realDays.slice(0, 30).map(([d, l]) => {
    const cells = walkDay(l).filter((w) => w.two.length && estOf(d, w.r.slot, l.slice(0, w.i))?.play).map((w) => ({ slot: w.r.slot, w, b: betOf(w)! }));
    return { d, cells, profit: cells.reduce((a, c) => a + c.b.profit, 0), played: cells.length };
  });
  const dayLabel = new Date(day).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" });

  // เลขไหลที่ผู้ใช้ทายล่วงหน้า → ให้คะแนนกับผลจริงของวันนั้น
  const guesses = (await prisma.flowGuess.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { method: "asc" }] })).map((g) => {
    const res = byDay.get(g.date) ?? [];
    return { ...g, locked: guessLocked(g.date), sc: res.length ? scoreGuess(g.digits.split(""), res) : null };
  });
  // ระบบขึ้นก่อน แล้ววิธีเทียบ แล้ววิธีที่ผู้ใช้กรอกเอง
  const methods = [...new Set([SYS_METHOD, ...guesses.map((g) => g.method)])].sort((a, b) => rankOf(a) - rankOf(b));
  const sysNext = lock?.ready ? guesses.find((g) => g.date === lock.date && g.method === SYS_METHOD) : null;
  // เลขของระบบของวันใดก็ได้: มีล็อก → ใช้ที่ล็อก · ไม่มี (ก่อนระบบเริ่ม 23 ต.ค. 69) → คิดย้อนหลังด้วยสูตรเดียวกันจากผลวันก่อน (ป้าย "คิดย้อนหลัง" · ไม่นับคะแนน)
  const dayKeys = [...byDay.keys()].sort();
  const sysFor = (d: string) => {
    const locked = guesses.filter((g) => g.date === d);
    if (locked.some((g) => g.method.startsWith(SYS_METHOD))) return locked.map((g) => ({ ...g, retro: false }));
    const prev = dayKeys.filter((k) => k < d).at(-1);
    const res = byDay.get(d) ?? [];
    const retro = (prev && systemGuess(byDay.get(prev)!)) || [];
    return [
      ...retro.map((x) => ({ id: `retro-${x.method}`, date: d, method: x.method, digits: x.digits.join(""), locked: true, retro: true, sc: res.length ? scoreGuess(x.digits, res) : null })),
      ...locked.map((g) => ({ ...g, retro: false })),
    ];
  };
  const viewRows = sysFor(day);
  const sysToday = viewRows.find((g) => g.method === SYS_METHOD);
  const board = methods.map((m) => {
    const l = guesses.filter((g) => g.method === m && g.sc && g.sc.n >= FULL_DAY);
    return {
      m, days: l.length,
      hit: l.reduce((a, g) => a + g.sc!.rounds, 0), n: l.reduce((a, g) => a + g.sc!.n, 0),
      top: l.filter((g) => g.sc!.topHit).length, topExp: l.reduce((a, g) => a + g.sc!.topChance, 0),
    };
  });
  const guessDay = lock?.date ?? nextGuessDate();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">เลขไหล</h1>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link href={nav(shift(day, -1))} className="btn-ghost border border-slate-200 px-2">‹</Link>
          <span className="min-w-28 text-center font-medium tabular-nums">{dayLabel}</span>
          {day < today ? <Link href={nav(shift(day, 1))} className="btn-ghost border border-slate-200 px-2">›</Link> : <span className="btn-ghost border border-slate-100 px-2 text-slate-300">›</span>}
          {day !== today && <Link href={nav(today)} className="btn-ghost text-blue-700">วันนี้</Link>}
        </div>
      </div>
      {/* แท็บ (ผู้ใช้ 29 ต.ค. 69: "ปรับ UI ให้เข้าใจง่าย ใช้ง่าย") — วันนี้ = เล่นอะไร · ผลการเข้าซื้อ = ได้/เสีย · ล่วงหน้า & ทดสอบ = ข้อมูลตรวจระบบ */}
      <nav className="flex gap-1 border-b border-slate-200 text-sm">
        {([["today", "📍 วันนี้"], ["buy", "💰 ผลการเข้าซื้อ"], ["lab", "🔬 ล่วงหน้า & ทดสอบ"]] as const).map(([t, name]) => (
          <Link key={t} href={nav(day, stake, t)} className={`-mb-px border-b-2 px-3 py-2 ${tab === t ? "border-blue-600 font-semibold text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{name}</Link>
        ))}
      </nav>
      {tab === "today" && (
        <>
          {day === today && <AutoRefresh />}
          {/* 1) เลขไหลตอนนี้ + ทำอะไรต่อ */}
          <div className="grid gap-3 lg:grid-cols-5">
            <section className="card space-y-2 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">เลขไหลตอนนี้</h2>
                {nowMood && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${nowMood.strength === "แรง" ? "bg-emerald-100 text-emerald-800" : nowMood.strength === "กลาง" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>ไหล{nowMood.strength}</span>}
              </div>
              {now.length ? (
                <>
                  <div className="font-mono text-5xl font-bold tracking-widest text-amber-600">{nowDs.join(" ")}</div>
                  <div className="text-sm text-slate-600">เลข {now[0].d} ออก {now[0].rounds}/{done.length} รอบ · เลข {now[1].d} ออก {now[1].rounds} รอบ</div>
                  {nowStreak > 0 && <div className={`text-sm ${nowStreak >= FOLLOW_STREAK ? "font-medium text-emerald-700" : "text-slate-600"}`}>🔥 เลขไหลเข้าติดกัน {nowStreak} รอบ{nowStreak >= FOLLOW_STREAK && " → ตามต่อทุกหุ้น"}</div>}
                  <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm">
                    <span className="mr-2 font-sans text-xs text-slate-500">เจาะ</span>
                    {nowDrill.map((set, i) => <div key={i}>{set.join(" ")}</div>)}
                  </div>
                  {rounds.some((x) => !x.w) && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      copy ทุกหุ้นที่ยังไม่ออก <CopyPending items={rounds.filter((x) => !x.w).map((x) => copyItem(x.r))} title={`เลขไหล · ${dayLabel}`} />
                    </div>
                  )}
                </>
              ) : <div className="py-4 text-sm text-slate-500">ยังไม่มีเลขไหล — ต้องมีผลออกก่อนอย่างน้อย 2 รอบ</div>}
              <div className="flex flex-wrap gap-1 font-mono text-xs">
                {counts.map((c) => (
                  <span key={c.d} className={`rounded px-1.5 py-0.5 ${nowDs.includes(c.d) ? "bg-amber-200 font-bold text-amber-900" : c.rounds === 0 ? "text-slate-300" : "bg-slate-100 text-slate-600"}`}>{c.d}<span className="font-normal opacity-70">×{c.rounds}</span></span>
                ))}
              </div>
            </section>

            <section className="card space-y-3 lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">ควรทำอะไรตอนนี้</h2>
                <span className="text-xs text-slate-400">{day === today ? `${hhmm} · รีเฟรชเองทุก 1 นาที` : `ย้อนดู ${dayLabel}`}</span>
              </div>
              {(() => {
                const go = rounds.filter((x) => x.state === "play"), wait = rounds.filter((x) => x.state === "wait");
                if (go.length) return (
                  <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4">
                    <div className="text-sm font-semibold text-emerald-700">▶ เล่นได้เลย</div>
                    {go.map((x) => (
                      <div key={x.r.slot} className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xl font-semibold">{x.r.label}</span>
                        <span className="text-sm text-slate-600">แทงก่อน {x.r.time}</span>
                        <span className="font-mono text-xl font-bold text-amber-600">{nowDs.join(" ")}</span>
                        <CopyPending one items={[copyItem(x.r)]} />
                      </div>
                    ))}
                    <div className="mt-1 text-xs text-slate-600">เลขนิ่งแล้ว (รอบก่อนหน้าออกครบ)</div>
                  </div>
                );
                if (wait.length) return (
                  <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-800">⏳ รอก่อน</div>
                    <div className="mt-1 text-lg">ถัดไปน่าเล่น <span className="font-semibold">{wait.map((x) => `${x.r.label} ${x.r.time}`).join(" · ")}</span></div>
                    <div className="text-sm text-slate-600">รอ {wait[0].waitFor.map((y) => `${y.label} ${y.time}`).join(", ")} ออกก่อน — เลขอาจเปลี่ยน</div>
                  </div>
                );
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                    {!rounds.length ? "วันนี้ตลาดปิดทั้งหมด" : !now.length ? "รอผล 2 รอบแรกออกก่อน แล้วระบบจะบอกว่าเล่นหุ้นไหน" : rounds.some((x) => !x.w && x.state !== "late") ? "ตอนนี้ไม่มีหุ้นที่น่าเล่น — รอดูรอบถัดไป" : "วันนี้ไม่เหลือรอบให้เล่นแล้ว"}
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">แนะนำวันนี้</div><div className="text-xl font-semibold">{signals.length} <span className="text-sm font-normal">รอบ</span></div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">เข้าแล้ว</div><div className="text-xl font-semibold">{signals.filter((x) => x.w?.hit).length}/{signals.filter((x) => x.w).length}</div></div>
                <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">กำไรวันนี้ (เลขละ {stake})</div><div className={`text-xl font-semibold tabular-nums ${tone(dayMoney.win - dayMoney.cost)}`}>{dayMoney.rounds ? baht(dayMoney.win - dayMoney.cost) : "—"}</div></div>
              </div>
              {rounds.some((x) => x.state === "play" || x.state === "wait") && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  copy ทุกหุ้นที่แนะนำ <CopyPending items={rounds.filter((x) => x.state === "play" || x.state === "wait").map((x) => copyItem(x.r))} title={`เลขไหล · ${dayLabel}`} />
                </div>
              )}
            </section>
          </div>

          {/* 2) ทุกหุ้นวันนี้: คำแนะนำ + ผล ในตารางเดียว */}
          <section className="card space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">ทุกหุ้นวันนี้</h2>
              <span className="text-xs text-slate-500">กด “ทำไม” เพื่อดูเหตุผล · ไฮไลต์ = เลขไหล</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr><th className="px-2 py-1.5 text-left">เวลา</th><th className="px-2 py-1.5 text-left">หุ้น</th><th className="px-2 py-1.5 text-left">คำแนะนำ</th><th className="px-2 py-1.5 text-center">เลขไหล · เจาะ</th><th className="px-2 py-1.5 text-center">ผล บน/ล่าง</th><th className="px-2 py-1.5 text-right">กำไร</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FLOW_ROUNDS.map((r) => {
                    const x = rounds.find((y) => y.r.slot === r.slot), w = walk.find((y) => y.r.slot === r.slot);
                    const b = w && betOf(w), played = !!w && playedOf(w);
                    const st = x?.state;
                    const pill = !x ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">ปิด</span>
                      : st === "play" ? <span className="animate-pulse rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">▶ เล่นได้เลย</span>
                      : st === "wait" ? <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">⏳ น่าเล่น · รอ</span>
                      : st === "done" ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">✅ เล่น</span>
                      : st === "passed" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">ไม่ได้เล่น</span>
                      : st === "early" || st === "nodata" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">รอเลขไหล</span>
                      : st === "late" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">รอผล</span>
                      : <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-600">✕ ข้าม</span>;
                    const e = x?.est;
                    const short = !e ? "" : e.play ? (e.base ? "หุ้นหลัก" : e.follow ? `ตามไหล ${e.streak} รอบติด` : "เลขไหลน่าไปหุ้นนี้") : e.tight ? "ราคาปิดเมื่อวานไม่เอื้อ" : "ไม่น่าไหลไป";
                    const two = w ? w.two : x?.hasFlow ? nowDs : [], drill = w ? w.drill : x?.hasFlow ? nowDrill : [];
                    return (
                      <tr key={r.slot} className={st === "play" ? "bg-emerald-50" : played ? "bg-emerald-50/40" : !x ? "text-slate-300" : ""}>
                        <td className="px-2 py-1.5 align-top tabular-nums">{r.time}</td>
                        <td className="px-2 py-1.5 align-top whitespace-nowrap font-medium">{r.label}</td>
                        <td className="px-2 py-1.5 align-top">
                          <div className="flex flex-wrap items-center gap-1">{pill}{short && <span className="text-xs text-slate-500">{short}</span>}</div>
                          {st === "wait" && <div className="text-[11px] text-amber-700">รอ {x!.waitFor.map((y) => y.label).join(", ")}</div>}
                          {e && (
                            <details className="text-xs text-slate-500">
                              <summary className="cursor-pointer text-blue-700">ทำไม</summary>
                              <div className="mt-1 max-w-sm">{why(x!)}{e.streak > 0 && ` · เข้าติดกัน ${e.streak} รอบ`}<br />{past(e)}</div>
                            </details>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center align-top font-mono">
                          {two.length ? (
                            <>
                              <div className="font-semibold">{two.join(" ")}</div>
                              <div className="text-[11px] leading-tight text-slate-400">{drill.map((set, i) => <div key={i}>{set.join(" ")}</div>)}</div>
                              {x && !w && <div className="mt-0.5"><CopyPending one items={[copyItem(r)]} /></div>}
                            </>
                          ) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-center align-top font-mono">
                          {w ? (
                            <>
                              <div>{show(w.r.top, w.two)} / {show(w.r.bottom, w.two)}</div>
                              {w.two.length > 0 && <div className="font-sans text-[11px]">{w.hit ? <span className="text-emerald-600">เข้า</span> : <span className="text-rose-500">ไม่เข้า</span>}{w.drillHit && <span className="text-emerald-600"> · เจาะเข้า</span>}</div>}
                            </>
                          ) : <span className="text-slate-300">{x ? "ยังไม่ออก" : "ปิด"}</span>}
                        </td>
                        <td className={`px-2 py-1.5 text-right align-top tabular-nums ${b ? (played ? `font-semibold ${tone(b.profit)}` : "text-slate-300") : ""}`} title={b && !played ? "ไม่ได้แนะนำ — ไม่นับในรวม" : undefined}>{b ? baht(b.profit) : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {dayMoney.rounds > 0 && (
                  <tfoot className="border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={5} className="px-2 py-1.5 text-right text-xs text-slate-500">รวมเฉพาะที่แนะนำ {dayMoney.rounds} รอบ · ซื้อ {dayMoney.cost.toLocaleString("th-TH")} · ได้ {dayMoney.win.toLocaleString("th-TH")}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${tone(dayMoney.win - dayMoney.cost)}`}>{baht(dayMoney.win - dayMoney.cost)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">วิธีเลือกหุ้น และวิธีซื้อ</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>เลขไหล = 2 ตัวที่ออกมาแล้วหลายรอบที่สุดของวัน · เจาะ = เลขไหลจับคู่กับเลขที่ไหลรองลงมา ชุดละ 6</li>
                <li>หุ้นหลัก (ฮั่งเส็งเช้า · นิเคอิบ่าย · ฮั่งเส็งบ่าย) เล่นทุกวัน · หุ้นอื่นเพิ่มเมื่อเลขไหลวันนั้นน่าไป · เลขไหลเข้าติดกัน {FOLLOW_STREAK} รอบขึ้นไป = ตามต่อทุกหุ้น</li>
                <li>ข้ามหุ้นที่ราคาปิดเมื่อวานไม่เอื้อเลขไหล (เลขบนผูกกับเลขล่างด้วยราคาปิดเมื่อวาน)</li>
                <li>▶ เล่นได้เลย = รอบก่อนหน้าออกครบ เลขไม่เปลี่ยนแล้ว · ⏳ รอ = ยังมีรอบก่อนหน้าไม่ออก เลขอาจเปลี่ยน</li>
                <li>ซื้อ: รูด 2 ตัว + เจาะ 12 ตัว ทั้งบนและล่าง {betCost(2, 12, stake).toLocaleString("th-TH")} บาทต่อรอบ (เลขละ {stake}) · ได้เปรียบน้อย เริ่มเงินน้อยก่อน · ดาวโจนส์ผลออก ~03:05 คืนถัดไป</li>
              </ul>
            </details>
          </section>
        </>
      )}
      {tab === "buy" && (
        <>
      <section id="buy" className="card scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">การเข้าซื้อเลขไหล</h2>
          <RangePicker
            from={rFrom}
            to={rTo}
            min={firstDay}
            max={today}
            base={navBase}
            dayProfit={Object.fromEntries(moneyAll.rows.map((r) => [r.d, r.win - r.cost]))}
          />
          <div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
            <span className="text-slate-500">เลขละ</span>
            {STAKES.map((st) => (
              <Link key={st} href={nav(day, st)} className={`rounded-md border px-2 py-0.5 tabular-nums ${st === stake ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>{st}</Link>
            ))}
            <span className="text-slate-500">บาท</span>
          </div>
        </div>
        {(() => {
          const ms = monthStatOf(moneyReal), mm = rangeStat(moneyAll);
          return (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-xs text-slate-500">
                {rangeName} · หุ้นหลัก + หุ้นที่เลขไหลน่าไป เลขละ {stake}
                {rangeHasHist && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">ก่อน {thDate(firstReal)} ใช้ย้อนหลังจากราคาปิด — ยังไม่มีผลจริงในระบบ</span>}
              </div>
              {mm.days ? (
                <>
                  <div className={`text-2xl font-semibold tabular-nums ${tone(mm.win - mm.cost)}`}>{baht(mm.win - mm.cost)} <span className="text-base font-normal">บาท</span></div>
                  <div className="mt-1 text-sm">
                    แนะนำให้เข้า <span className="font-semibold">{mm.rounds} รอบ</span> · เลขไหลเข้า <span className="font-semibold text-emerald-700">{mm.hits} รอบ ({Math.round((100 * mm.hits) / mm.rounds)}%)</span> · ได้กำไร <span className="font-semibold">{mm.plusRounds} รอบ</span> · เสีย {mm.rounds - mm.plusRounds} รอบ
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {mm.bySlot.map((x) => (
                      <span key={x.r.slot} className="rounded border border-slate-200 bg-white px-1.5 py-0.5">
                        {x.r.label} แนะนำ {x.n} · เข้า {x.hit} <span className={`tabular-nums ${tone(x.profit)}`}>{baht(x.profit)}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ซื้อ {mm.cost.toLocaleString("th-TH")} · ได้ {mm.win.toLocaleString("th-TH")} · {mm.days} วัน · วันกำไร {mm.plus}/{mm.days} · วันแย่สุด {baht(mm.worst)} · ดีสุด {baht(mm.best)}
                  </div>
                </>
              ) : <div className="py-1 text-sm text-slate-400">ช่วงนี้ยังไม่มีรอบที่ซื้อ</div>}
              {ms.n > 0 && (
                <div className="mt-1 border-t border-slate-200 pt-1 text-xs text-slate-400">
                  ทุกเดือน ({ms.n}): เฉลี่ย {baht(ms.avg)}/เดือน · เดือนกำไร {ms.plus}/{ms.n} · รวม {baht(moneyReal.total.win - moneyReal.total.cost)} · ทรุดลึกสุด −{moneyReal.drawdown.toLocaleString("th-TH")}
                </div>
              )}
            </div>
          );
        })()}
        {moneyReal.years.length > 0 && monthTable(moneyReal)}
        {(() => {
          const daily = dailyOf({ ...moneyAll, rows: moneyAll.rows.filter((r) => r.d >= rFrom && r.d <= rTo) });
          return daily.length > 0 && (
          <details open={!!picked} className="text-sm">
            <summary className="cursor-pointer text-xs text-slate-500">ดูรายวัน · {rangeName} ({daily.length} วัน · สะสมนับจากวันแรกของช่วง)</summary>
            <table className="mt-2 w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr><th className="px-2 py-1.5 text-left">วัน</th><th className="px-2 py-1.5 text-right">แนะนำ</th><th className="px-2 py-1.5 text-right">เข้า</th><th className="px-2 py-1.5 text-right">ซื้อ</th><th className="px-2 py-1.5 text-right">กำไร</th><th className="px-2 py-1.5 text-right">สะสม</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daily.map((r) => (
                  <tr key={r.d} className={r.d === day ? "bg-amber-50" : ""}>
                    <td className="px-2 py-1"><Link href={nav(r.d, stake, "today")} className="text-blue-700 hover:underline">{new Date(r.d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</Link></td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.rounds}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.hits}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{r.cost.toLocaleString("th-TH")}</td>
                    <td className={`px-2 py-1 text-right font-medium tabular-nums ${tone(r.win - r.cost)}`}>{baht(r.win - r.cost)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${tone(r.cum)}`}>{baht(r.cum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          );
        })()}
        <p className="text-xs text-slate-500">
          ซื้อหุ้นหลัก 3 ตัว + หุ้นที่เลขไหลวันนั้นน่าไป: รูดเลขไหล 2 ตัว (19 ประตู) + เจาะ 12 ตัว (กลับ) ทั้งบนและล่าง · {betCost(2, 12, stake).toLocaleString("th-TH")} บาทต่อรอบ · จ่ายบาทละ {BET.payout} ·
          คิดจากผลที่บันทึกในระบบ (ยังไม่ได้ล็อกเลขไว้ก่อนผลออก)
        </p>
        {moneyHist.years.length > 0 && (() => {
          const hs = monthStatOf(moneyHist);
          const worstM = moneyHist.months.reduce((a, x) => (x.win - x.cost < a.win - a.cost ? x : a), moneyHist.months[0]);
          return (
            <details open className="space-y-2 border-t border-slate-200 pt-3">
              <summary className="cursor-pointer font-medium">ทุกเดือนย้อนหลัง {hs.n} เดือน — ถ้าเล่นแบบนี้มาตลอด</summary>
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div>
                  รวม <span className={`font-semibold tabular-nums ${tone(moneyHist.total.win - moneyHist.total.cost)}`}>{baht(moneyHist.total.win - moneyHist.total.cost)}</span> ·
                  เฉลี่ย <span className={`tabular-nums ${tone(hs.avg)}`}>{baht(hs.avg)}</span>/เดือน ·
                  เดือนกำไร <span className="font-semibold">{hs.plus}/{hs.n}</span> ·
                  เดือนแย่สุด <span className="tabular-nums text-rose-600">{baht(worstM.win - worstM.cost)}</span> ({new Date(`${worstM.m}-01`).toLocaleDateString("th-TH", { month: "short", year: "2-digit" })}) ·
                  ขาดทุนสะสมลึกสุด <span className="tabular-nums text-rose-600">−{moneyHist.drawdown.toLocaleString("th-TH")}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  ผลจริงในระบบเพิ่งมีตั้งแต่ ส.ค. 69 เลยใช้ผลจากราคาปิดตลาดรายวัน (ต.ค. 66 →) มาแทน · แต่ละวันระบบรู้แค่ข้อมูลก่อนวันนั้น เหมือนเล่นจริงทุกวัน ·
                  ราคาปิดบางวันไม่ตรงเลขที่ออกจริง (เช่น ฮั่งเส็งบ่าย) ตัวเลขจึงคลาดได้บ้าง — ใช้ดูว่าระยะยาวได้หรือเสีย และช่วงแย่ ๆ ลึกแค่ไหน
                </div>
              </div>
              {monthTable(moneyHist)}
            </details>
          );
        })()}
      </section>
          <section className="card space-y-2">
            <h2 className="font-medium">ประวัติคำแนะนำ {signalHistory.length} วันล่าสุด <span className="text-xs font-normal text-slate-500">(เลขละ {stake} · กดวันเพื่อดูวันนั้น)</span></h2>
          {signalHistory.length > 0 && (
            <div className="text-sm">
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr><th className="px-2 py-1.5 text-left">วัน</th><th className="px-2 py-1.5 text-left">หุ้นที่เล่น → เลขไหล · ผล · กำไร</th><th className="px-2 py-1.5 text-right">กำไรวันนั้น</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {signalHistory.map((h) => (
                      <tr key={h.d} className={h.d === day ? "bg-amber-50" : ""}>
                        <td className="px-2 py-1"><Link href={nav(h.d, stake, "today")} className="text-blue-700 hover:underline">{new Date(h.d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</Link></td>
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap gap-1.5">
                            {h.cells.map((c) => (
                              <span key={c.slot} className="rounded border border-slate-200 px-1.5 py-0.5 text-xs">
                                {labelOf(c.slot)} <span className="font-mono font-semibold">{c.w.two.join(" ")}</span> → {c.w.r.top}/{c.w.r.bottom}{" "}
                                {c.w.hit ? <span className="text-emerald-600">✓</span> : <span className="text-rose-500">✗</span>}{" "}
                                <span className={`tabular-nums ${tone(c.b.profit)}`}>{baht(c.b.profit)}</span>
                              </span>
                            ))}
                            {!h.cells.length && <span className="text-xs text-slate-300">ไม่มีรอบที่เล่นได้</span>}
                          </div>
                        </td>
                        <td className={`px-2 py-1 text-right font-medium tabular-nums ${tone(h.profit)}`}>{h.played ? baht(h.profit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </section>
        </>
      )}
      {tab === "lab" && (
        <>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">เลขไหลล่วงหน้า · ระบบวิเคราะห์</h2>
          <AnalyzeButton />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-800">{lock ? new Date(lock.date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" }) : "วันทำการถัดไป"}</div>
            {sysNext ? (
              <>
                <div className="font-mono text-3xl font-bold text-amber-700">{sysNext.digits.split("").join(" ")}</div>
                <div className="text-xs text-amber-900">{lock?.ready && lock.why} · ล็อกแล้ว (จากผลวันที่ {lock?.prevDate})</div>
              </>
            ) : (
              <div className="space-y-2 py-2 text-sm text-slate-600">
                <div>{lock && !lock.ready ? `รอผลของวันที่ ${lock.prevDate ?? "ก่อนหน้า"} ให้ครบ (หลัง 16:00 · ตัวที่ไม่มีข้อมูลเปิด = วันนั้นปิด ไม่ต้องรอ) — หรือกดปุ่ม “วิเคราะห์เลย” ด้านบน` : "ยังคิดไม่ได้"}</div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">เลขไหลของระบบ · {new Date(day).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}{sysToday?.retro && <span className="ml-1 rounded bg-slate-100 px-1 text-slate-500">คิดย้อนหลัง ไม่ได้ล็อก</span>}</div>
            {sysToday ? (
              <>
                <div className="font-mono text-3xl font-bold">{sysToday.digits.split("").join(" ")}</div>
                <div className="text-xs text-slate-600">{sysToday.sc ? `เข้า ${sysToday.sc.rounds}/${sysToday.sc.n} รอบ · ${sysToday.sc.perDigit.map((x) => `${x.d}×${x.rounds}`).join(" ")} · ไหลสุดของวัน ${sysToday.sc.tops.join(",")}×${sysToday.sc.max}${sysToday.sc.topHit ? " ✓ โดน" : ""}` : sysToday.locked ? "รอผล" : "ยังไม่ถึง 09:30"}</div>
              </>
            ) : <div className="py-2 text-sm text-slate-400">ไม่มีผลของวันก่อนหน้าให้คิด</div>}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          วิธีคิด (จากผลรอบปิดวันของวันก่อน): ตัวที่ 1 = เลขที่ออกน้อยสุด (ค้างนานสุด) +7 · ตัวที่ 2 = บนจีนบ่าย หลักสิบ+หลักหน่วย +3 (ซ้ำ → เลขค้างถัดไป +7) ·
          ทดสอบ: คัดจากสูตร 521 แบบบนปี 59–66 แล้วตรวจกับ ต.ค. 66–69 ที่ไม่ได้ใช้คัด → เข้า 61.0% ของรอบ (สุ่ม 59.0%) · โดนเลขไหลสุดของวัน 138/415 วัน (สุ่ม ≈129) — ดีกว่าสุ่มนิดเดียว ยังอาจบังเอิญ ให้ผลจริงด้านล่างตัดสิน ·
          ล็อกอัตโนมัติก่อน 09:30 ไม่เขียนทับ · “ระบบ: เลขค้าง” = วิธีเทียบ (ทดสอบแล้วเท่าสุ่ม) · นับคะแนนเฉพาะวันที่ผลออก ≥{FULL_DAY} รอบ
        </p>
        {board.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-2 py-1.5 text-left">วิธี</th><th className="px-2 py-1.5 text-right">วัน</th><th className="px-2 py-1.5 text-right">รอบที่เข้า (สุ่ม {(RANDOM_TWO * 100).toFixed(0)}%)</th><th className="px-2 py-1.5 text-right">โดนเลขไหลสุดของวัน</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {board.map((b) => (
                <tr key={b.m}>
                  <td className="px-2 py-1">{b.m}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{b.days}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{b.hit}/{b.n} <span className="font-medium">({pct(b.hit, b.n)})</span></td>
                  <td className="px-2 py-1 text-right tabular-nums">{b.top}/{b.days} วัน <span className="text-xs text-slate-500">(สุ่มควรได้ ≈{b.topExp.toFixed(1)})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {viewRows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="px-2 py-1.5 text-left">วัน</th><th className="px-2 py-1.5 text-left">วิธี</th><th className="px-2 py-1.5 text-center">ทาย</th><th className="px-2 py-1.5 text-left">ผลจริง</th><th className="px-2 py-1.5"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {viewRows.map((g) => (
                <tr key={g.id}>
                  <td className="px-2 py-1"><Link href={nav(g.date)} className="text-blue-700 hover:underline">{new Date(g.date).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</Link></td>
                  <td className="px-2 py-1">{g.method}{g.retro && <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-500">คิดย้อนหลัง</span>}</td>
                  <td className="px-2 py-1 text-center font-mono font-semibold">{g.digits.split("").join(" ")}</td>
                  <td className="px-2 py-1 text-xs">
                    {!g.locked ? <span className="text-slate-400">ยังไม่ล็อก</span> : !g.sc ? <span className="text-slate-400">รอผล</span> : (
                      <>
                        เข้า {g.sc.rounds}/{g.sc.n} รอบ · {g.sc.perDigit.map((x) => `${x.d}×${x.rounds}`).join(" ")} · ไหลสุด {g.sc.tops.join(",")}×{g.sc.max}{" "}
                        {g.sc.topHit ? <span className="text-emerald-600">✓ โดน</span> : <span className="text-rose-500">✗</span>}
                        {g.sc.n < FULL_DAY && <span className="text-slate-400"> (ผลยังไม่ครบ)</span>}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {!g.locked && !g.method.startsWith(SYS_METHOD) && <form action={deleteFlowGuess}><input type="hidden" name="id" value={g.id} /><button className="text-xs text-rose-600 hover:underline">ลบ</button></form>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-slate-500">ทายเองเพิ่ม (ไม่บังคับ) — เทียบกับระบบได้</summary>
          <div className="mt-2"><GuessForm date={guessDay} methods={methods.filter((m) => !m.startsWith(SYS_METHOD))} /></div>
        </details>
      </section>
      {/* ข้อมูลทดสอบ (เข้า % เทียบสุ่ม) — ผู้ใช้ 29 ต.ค. 69 ถามว่ายังต้องโชว์ไหม → พับไว้ล่างสุด ไม่ใช้ตัดสินซื้อ */}
      <details open className="card space-y-3">
        <summary className="cursor-pointer font-medium">ข้อมูลทดสอบ: เลขไหลเข้ากี่ % — เทียบสุ่ม {(RANDOM_TWO * 100).toFixed(1)}% <span className="text-xs font-normal text-slate-500">(ไว้ตรวจระบบ · ไม่ต้องใช้ตอนซื้อ)</span></summary>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">ผลจริง 30 วันล่าสุด</div><div className="text-2xl font-semibold tabular-nums">{pct(real30.hit, real30.n)}</div><div className="text-xs text-slate-500">{real30.hit}/{real30.n} รอบ</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">ผลจริงทั้งหมดในระบบ</div><div className="text-2xl font-semibold tabular-nums">{pct(real.hit, real.n)}</div><div className="text-xs text-slate-500">{real.hit}/{real.n} รอบ · {realRows.length} วัน</div></div>
          <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">ย้อนหลัง {histDays.length} วัน (ราคารายวัน)</div><div className="text-2xl font-semibold tabular-nums">{pct(bt.all.hit, bt.all.n)}</div><div className="text-xs text-slate-500">ตอนไหลแรง (≥3 รอบ) {pct(bt.strong.hit, bt.strong.n)} · {bt.strong.n} รอบ</div></div>
        </div>
        <p className="text-xs text-slate-500">ถ้าเลขไหลใช้ได้จริง ตัวเลขต้องสูงกว่า {(RANDOM_TWO * 100).toFixed(1)}% ชัดๆ และนานพอ (หลายร้อยรอบ) — ทดสอบก่อนทำเมนูแล้ว ไหลทั้งวัน / ไหลสั้น 2–4 รอบติด / คู่ไหล / ไหลข้ามวัน ออกมาเท่าสุ่มทั้งหมด</p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-2 py-1.5 text-left">วัน</th><th className="px-2 py-1.5 text-center">ไหลมากสุดของวัน</th><th className="px-2 py-1.5 text-center">เลขระบบ (เข้า)</th><th className="px-2 py-1.5 text-right">เลขไหลระหว่างวันเข้า</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {realRows.slice(0, 30).map((r) => (
              <tr key={r.d} className={r.d === day ? "bg-amber-50" : ""}>
                <td className="px-2 py-1"><Link href={nav(r.d, stake, "today")} className="text-blue-700 hover:underline">{new Date(r.d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</Link></td>
                <td className="px-2 py-1 text-center font-mono">{r.top.d} <span className="text-xs text-slate-500">×{r.top.rounds}</span></td>
                <td className="px-2 py-1 text-center">{(() => { const g = sysFor(r.d).find((x) => x.method === SYS_METHOD); return g?.sc ? <><span className="font-mono font-semibold">{g.digits.split("").join(" ")}</span> <span className="text-xs text-slate-500">{g.sc.rounds}/{g.sc.n}{g.sc.topHit ? " ✓" : ""}{g.retro ? " ·ย้อน" : ""}</span></> : "—"; })()}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.hit}/{r.n} <span className="text-xs text-slate-500">({pct(r.hit, r.n)})</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
        </>
      )}
    </div>
  );
}
