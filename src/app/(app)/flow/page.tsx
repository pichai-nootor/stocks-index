import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { todayThai } from "@/lib/intraday";
import { FLOW_ROUNDS, resultOf, countFlow, flowTwo, flowDrill, FLOW_DRILL_RANDOM, walkDay, backtest, RANDOM_TWO, guessLocked, nextGuessDate, scoreGuess, systemGuess, thaiHour, SYS_METHOD, type FlowResult, type FlowSlot } from "@/lib/flow";
import { flowDays, openedSlots, lockFlowSystem } from "@/lib/flow-lock";
import { deleteFlowGuess } from "@/app/actions/flow";
import { AnalyzeButton } from "./analyze-button";
import { GuessForm } from "./guess-form";
import { CopyPending } from "@/components/copy-pending";

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
  const waiting = FLOW_ROUNDS.filter((r) => !doneSlots.has(r.slot) && !isClosed(r.slot));
  const closed = FLOW_ROUNDS.filter((r) => isClosed(r.slot));

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
  for (const x of idx) { const l = hist.get(x.date) ?? []; l.push(resultOf(keySlot.get(x.key)!, x.close, x.close - x.prevClose)); hist.set(x.date, l); }
  const histDays = [...hist.values()].filter((l) => l.length >= 10).map(sortDay);
  const bt = backtest(histDays);

  const nav = (d: string) => `/flow?date=${d}`;
  const chip = (d: string, on: boolean) => <span key={d} className={on ? "rounded bg-amber-200 px-0.5 font-bold text-amber-900" : ""}>{d}</span>;
  const show = (s: string, mark: string[]) => s.split("").map((c, i) => <span key={i}>{chip(c, mark.includes(c))}</span>);
  const nowDs = now.map((x) => x.d);
  // copy เลขไหล + เจาะ ของรอบที่ยังไม่ออก (รูปแบบเดียวกับปุ่ม copy หน้า VIP/สรุป)
  const copyItem = (r: (typeof FLOW_ROUNDS)[number]) => ({ label: `${r.label} ${r.time}`, pick: nowDs.length ? nowDs : null, drill: nowDrill, status: "pending" });
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
        <h1 className="text-xl font-semibold">เลขไหล · หุ้นปกติ</h1>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link href={nav(shift(day, -1))} className="btn-ghost">← วันก่อน</Link>
          <span className="font-medium tabular-nums">{new Date(day).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</span>
          {day < today && <Link href={nav(shift(day, 1))} className="btn-ghost">วันถัดไป →</Link>}
          {day !== today && <Link href="/flow" className="btn-ghost">วันนี้</Link>}
        </div>
      </div>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-medium">เลขไหลตอนนี้</h2>
          {now.length ? (
            <span className="font-mono text-3xl font-bold text-amber-700">{nowDs.join(" ")}</span>
          ) : (
            <span className="text-sm text-slate-500">ต้องมีผลอย่างน้อย 2 รอบก่อน</span>
          )}
          {now.length > 0 && <span className="text-sm text-slate-500">{now.map((x) => `${x.d} ออก ${x.rounds}/${done.length} รอบ`).join(" · ")}</span>}
        </div>
        {nowDrill.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm">
            <span className="font-sans text-xs text-slate-500">เจาะ</span>
            {nowDrill.map((set, i) => <span key={i}>{set.join(" ")}</span>)}
          </div>
        )}
        {now.length > 0 && waiting.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>รอบที่ยังไม่ออก: {waiting.map((r) => `${r.label} ${r.time}`).join(" · ")}</span>
            <CopyPending items={waiting.map(copyItem)} title={`เลขไหล · ${dayLabel}`} />
          </div>
        )}
        {closed.length > 0 && (
          <p className="text-sm text-slate-400">ปิดวันนี้ (ไม่มีข้อมูลเปิด): {closed.map((r) => r.label).join(" · ")}</p>
        )}
        <div className="flex flex-wrap gap-1.5 font-mono text-sm">
          {counts.map((c) => (
            <span key={c.d} className={`rounded-md border px-2 py-1 ${nowDs.includes(c.d) ? "border-amber-300 bg-amber-50 font-bold text-amber-900" : c.rounds === 0 ? "border-slate-100 text-slate-300" : "border-slate-200 text-slate-700"}`}>
              {c.d} <span className="text-xs font-normal">×{c.rounds}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          เลขไหล = 2 ตัวที่ออกมาแล้วหลายรอบที่สุดของวัน (เสมอกัน → ออกรวมหลายหลักกว่า → ออกล่าสุดกว่า) · ใช้ได้ทุกหุ้นที่ยังไม่ออก · เข้า = บน 2 หรือล่าง 2 มีเลขไหลอย่างน้อย 1 ตัว · ฟันสุ่ม 2 ตัวเข้า {(RANDOM_TWO * 100).toFixed(1)}% · ดูอย่างเดียว ไม่ได้อยู่ในสูตรฟัน
        </p>
      </section>

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

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-medium">ผลวันนี้ตามเวลา</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr><th className="px-2 py-1.5 text-left">เวลา</th><th className="px-2 py-1.5 text-left">หุ้น</th><th className="px-2 py-1.5 text-center">บน</th><th className="px-2 py-1.5 text-center">ล่าง</th><th className="px-2 py-1.5 text-center">เลขไหลก่อนรอบนี้ · เจาะ</th><th className="px-2 py-1.5 text-center">เข้า</th><th className="px-2 py-1.5 text-center">เจาะ</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FLOW_ROUNDS.map((r) => {
              const w = walk.find((x) => x.r.slot === r.slot);
              return (
                <tr key={r.slot} className={w ? "" : "text-slate-300"} title={!w && isClosed(r.slot) ? "ไม่มีข้อมูลเปิด = วันนี้ตลาดปิด" : undefined}>
                  <td className="px-2 py-1 tabular-nums">{r.time}</td>
                  <td className="px-2 py-1">{r.label}</td>
                  <td className="px-2 py-1 text-center font-mono">{w ? show(w.r.top, nowDs) : isClosed(r.slot) ? "ปิด" : "—"}</td>
                  <td className="px-2 py-1 text-center font-mono">{w ? show(w.r.bottom, nowDs) : "—"}</td>
                  <td className="px-2 py-1 text-center font-mono">
                    {(() => {
                      const two = w ? w.two : nowDs, drill = w ? w.drill : nowDrill;
                      if (!two.length) return "—";
                      return (
                        <>
                          <div>{two.join(" ")}</div>
                          {drill.map((set, i) => <div key={i} className="text-xs text-slate-500">{set.join(" ")}</div>)}
                          {!w && !isClosed(r.slot) && <div className="mt-0.5"><CopyPending one items={[copyItem(r)]} /></div>}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-1 text-center">{w?.hit === true ? <span className="text-emerald-600">✓</span> : w?.hit === false ? <span className="text-rose-500">✗</span> : ""}</td>
                  <td className="px-2 py-1 text-center">{w?.drillHit === true ? <span className="text-emerald-600">✓</span> : w?.drillHit === false ? <span className="text-rose-500">✗</span> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">ไฮไลต์ = เลขไหลตอนนี้ · คอลัมน์ “เลขไหลก่อนรอบนี้” = 2 ตัวที่ไหลมากสุดจากรอบก่อนหน้า (ตอนนั้นยังไม่รู้ผลรอบนี้) · เจาะ = เลขไหลแต่ละตัวจับคู่กับเลขที่ไหลรองลงมา ชุดละ 6 (กลับได้ · ทดสอบ 625 วันเข้า 42.7% เท่าสุ่ม {(FLOW_DRILL_RANDOM * 100).toFixed(1)}%) · ดาวโจนส์ผลออก ~03:05 คืนถัดไป</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">เลขไหลเข้ากี่ % — เทียบสุ่ม {(RANDOM_TWO * 100).toFixed(1)}%</h2>
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
                <td className="px-2 py-1"><Link href={nav(r.d)} className="text-blue-700 hover:underline">{new Date(r.d).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</Link></td>
                <td className="px-2 py-1 text-center font-mono">{r.top.d} <span className="text-xs text-slate-500">×{r.top.rounds}</span></td>
                <td className="px-2 py-1 text-center">{(() => { const g = sysFor(r.d).find((x) => x.method === SYS_METHOD); return g?.sc ? <><span className="font-mono font-semibold">{g.digits.split("").join(" ")}</span> <span className="text-xs text-slate-500">{g.sc.rounds}/{g.sc.n}{g.sc.topHit ? " ✓" : ""}{g.retro ? " ·ย้อน" : ""}</span></> : "—"; })()}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.hit}/{r.n} <span className="text-xs text-slate-500">({pct(r.hit, r.n)})</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
