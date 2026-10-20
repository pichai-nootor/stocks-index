import Link from "next/link";
import { Fragment } from "react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RefreshButton } from "./refresh-button";
import { BTC, RANGE, btcLiveRead, btc15Live, zonePlans, zoneTimeline, btcSnapshot, isBtcDrop, isRangeLevel, btcRangeTrades, syncBtc, syncBtcFlow, btcFlowSummary, btcBars, btcLivePrice, btcTrades, btcStats, btcBaseline, change24, lockBtcSignals, type BtcMode, type BtcStats } from "@/lib/btc";

const thai = (ms: number) => new Date(ms).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const usd = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 1 });
const pct = (x: number, d = 2) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(d)}%`;
const Pct = ({ v, d = 2 }: { v: number; d?: number }) => <span className={`tabular-nums ${v > 0 ? "text-emerald-700" : v < 0 ? "text-red-600" : "text-slate-500"}`}>{pct(v, d)}</span>;

/** สัญญาณที่ทดสอบแล้วไม่ได้เงินหลังหักค่าธรรมเนียม (17 ต.ค. 69 · ทิศชั่วโมงถัดไป · ครึ่ง A / B) — ดูหัวไฟล์ lib/btc.ts */
const FAILED = [
  { name: "สวนแรง 1 ชม. (ลง → Long, ขึ้น → Short)", a: "53.2% · +0.000%", b: "52.5% · +0.005%" },
  { name: "ตามแรง 24 ชม.", a: "47.8% · +0.002%", b: "48.0% · −0.001%" },
  { name: "เหนือ/ใต้ EMA 168 ชม.", a: "49.7% · +0.009%", b: "49.3% · +0.002%" },
  { name: "Funding rate สวนทาง", a: "50.5% · +0.012%", b: "50.1% · +0.004%" },
  { name: "ชั่วโมงของวัน (เรียนจากครึ่ง A)", a: "51.0% · +0.022%", b: "50.0% · +0.002%" },
  { name: "ขึ้น ≥5% ใน 24 ชม. → Short", a: "50.6% · −0.018%", b: "51.2% · −0.000%" },
];

/**
 * BTC ฟิวเจอร์ — สัญญาณ Long หลังลงแรง 24 ชม. (ตัวเดียวที่ผ่านการทดสอบทั้งสองครึ่ง) · ที่เหลือ = รอ
 *   + จุดเข้าตามราคา: limit Long ต่ำกว่าจุดต่ำสุด 24 ชม. ?k=2|2.5|3 % (ค่าเริ่มต้น 2.5) ถือ 1 ชม. — ไม่มีจุดเข้า Short (ทดสอบแล้วไม่ผ่าน)
 *   ?d=3|5|7 เกณฑ์ลง (ค่าเริ่มต้น 5%) · ?m=limit เข้าด้วย limit −1% (ค่าเริ่มต้น = ราคาปิด) · ผลจริงนับจากไม้ที่ล็อกตั้งแต่วันเปิดเมนู
 */
export default async function BtcPage({ searchParams }: PageProps<"/btc">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const dq = Number(sp.d);
  const drop = isBtcDrop(dq) ? dq : BTC.defaultDrop;
  const mode: BtcMode = sp.m === "limit" ? "limit" : "close";
  const kq = Number(sp.k);
  const level = isRangeLevel(kq) ? kq : RANGE.defaultLevel;
  const href = (d: number, m: BtcMode, k: number = level) => { const q = [d !== BTC.defaultDrop && `d=${d}`, m === "limit" && "m=limit", k !== RANGE.defaultLevel && `k=${k}`].filter(Boolean).join("&"); return q ? `/btc?${q}` : "/btc"; };

  await Promise.all([syncBtc(), syncBtcFlow()]);
  const [bars, live, flow, snap, bars15] = await Promise.all([btcBars(), btcLivePrice(), btcFlowSummary(), btcSnapshot(), btc15Live()]);
  if (bars.length < 200) return <div className="card text-sm text-slate-600">ยังดึงข้อมูล BTC จาก Binance ไม่ได้ — ลองรีเฟรชอีกครั้ง</div>;

  const { trades, pending } = btcTrades(bars, drop, mode);
  const other = btcTrades(bars, drop, mode === "close" ? "limit" : "close").trades;
  await lockBtcSignals(userId, trades, drop, mode);
  const real = await prisma.btcSignal.findMany({ where: { userId, drop, mode }, orderBy: { entryAt: "desc" } });
  // จุดเข้าตามราคา — ล็อกผลจริงเป็น mode "range" · drop = ระดับ ×10 (25 = 2.5%)
  const range = btcRangeTrades(bars, level);
  await lockBtcSignals(userId, range.trades, level * 10, "range");

  const mid = Math.floor(bars.length / 2), midT = bars[mid].t, yearAgo = bars[bars.length - 1].t - 365 * 24 * 3600000;
  const rows: { label: string; s: BtcStats; base: { hit: number; avg: number } }[] = [
    { label: `ครึ่งแรก (ถึง ${thai(midT).split(" ").slice(0, 3).join(" ")})`, s: btcStats(trades.filter((t) => t.entryAt <= midT)), base: btcBaseline(bars, BTC.look, mid) },
    { label: "ครึ่งหลัง", s: btcStats(trades.filter((t) => t.entryAt > midT)), base: btcBaseline(bars, mid, bars.length) },
    { label: "1 ปีล่าสุด", s: btcStats(trades.filter((t) => t.entryAt > yearAgo)), base: btcBaseline(bars, bars.findIndex((b) => b.t > yearAgo), bars.length) },
    { label: "ทั้งหมด", s: btcStats(trades), base: btcBaseline(bars, BTC.look, bars.length) },
  ];
  const rangeOpen = range.trades.at(-1)?.exit === null ? range.trades.at(-1)! : null;
  // เทียบสองวิธีเข้า (ครึ่งแรก / ครึ่งหลัง / ทั้งหมด)
  const [closeT, limitT] = mode === "close" ? [trades, other] : [other, trades];
  const cmp = (["close", "limit"] as const).map((m) => {
    const t = m === "close" ? closeT : limitT;
    return { m, a: btcStats(t.filter((x) => x.entryAt <= midT)), b: btcStats(t.filter((x) => x.entryAt > midT)), all: btcStats(t) };
  });
  const worstAll = Math.min(btcStats(closeT).worst, btcStats(limitT).worst), worstYear = btcStats(trades.filter((t) => t.entryAt > yearAgo)).worst;

  // สถานะตอนนี้
  const last = bars.length - 1, now = bars[last].t + 3600000; // "ตอนนี้" = ปิดแท่งล่าสุด (คลาดไม่เกิน 1 ชม.)
  const open = trades.at(-1) && trades.at(-1)!.exit === null ? trades.at(-1)! : null;
  const ch = change24(bars, last);
  const price = live ?? bars[last].c;
  // วิเคราะห์ตอนนี้ใช้แท่ง 15 นาที (ผู้ใช้ขอ) · ดึงไม่ได้ → ใช้แท่ง 1 ชม.
  const read = bars15 ? btcLiveRead(bars15, price, snap, flow, 4) : btcLiveRead(bars, price, snap, flow);
  // ทุน × เลเวอเรจ (?cap=USDT · ?lev=เท่า · ผู้ใช้: ทุน 10K × 10) — ทุกจุดเข้าแสดงกำไร/ขาดทุนเป็น USDT หลังหักค่าธรรมเนียมไป-กลับ
  const cq = Number(sp.cap), lq = Number(sp.lev);
  const cap = Number.isFinite(cq) && cq > 0 ? cq : 10000, lev = Number.isFinite(lq) && lq >= 1 && lq <= 125 ? Math.round(lq) : 10;
  const notional = cap * lev;
  const pnl = (side: "S" | "L", entry: number, exit: number) => notional * ((side === "L" ? exit / entry : entry / exit) - 1 - BTC.fee);
  // ราคาล้างพอร์ตโดยประมาณ (Isolated · maintenance margin ~0.4%)
  const liqPrice = (side: "S" | "L", entry: number) => (side === "L" ? entry * (1 - 1 / lev + 0.004) : entry * (1 + 1 / lev - 0.004));
  const money = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const plans = zonePlans(read);
  const sPlan = plans.find((p) => p.side === "S");
  const timeline = bars15 ? zoneTimeline(bars15, 24) : [];
  const tlDone = timeline.flatMap((r) => [r.S, r.L]).filter((x): x is NonNullable<typeof x> => x?.ret != null);
  const trigger = bars[bars.length - BTC.look].c * (1 - drop / 100); // ปิดแท่งถัดไปต่ำกว่านี้ = สัญญาณ
  const realDone = real.filter((r) => r.exit !== null);
  const realRet = realDone.map((r) => r.exit! / r.entry - 1 - BTC.fee);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">BTC ฟิวเจอร์</h1>
        <p className="text-sm text-slate-500">BTCUSDT perpetual · Binance · แท่ง 1 ชม. {bars.length.toLocaleString()} แท่ง (ตั้งแต่ ม.ค. 2563) · เวลาไทย</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RefreshButton />
        <span className="text-sm text-slate-500">{snap && <>ดึงเมื่อ {new Date(snap.at).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} · </>} ราคา จุดเข้า และข้อมูลประกอบคำนวณใหม่ทุกครั้งที่กด</span>
      </div>

      {/* วิเคราะห์ตอนนี้ — demand/supply + สภาพตลาด ณ ตอนกด */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">วิเคราะห์ตอนนี้</h2>
          <span className="text-sm text-slate-500">แท่ง {read.per === 4 ? "15 นาที" : "1 ชม."} · ราคา <b className="tabular-nums text-slate-800">{usd(price)}</b>{read.ch15 !== null && <> · 15 นาที <Pct v={read.ch15} /></>} · 1 ชม. <Pct v={read.ch1} /> · 4 ชม. <Pct v={read.ch4} /> · 24 ชม. <Pct v={read.ch24} /> · แกว่งเฉลี่ย {(read.vol1 * 100 / read.per).toFixed(2)}%/{read.per === 4 ? "15 นาที" : "ชม."}</span>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-blue-700">ดูเหตุผล: โซน Supply/Demand และข้อมูลตลาดที่ระบบใช้</summary>
          <div className="mt-2 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-sm font-medium text-red-700">Supply (แนวต้าน — ฝั่งขายรอ) เหนือราคา</div>
            {read.supply.length ? read.supply.map((z) => <div key={z.price} className="flex justify-between border-t border-slate-100 py-0.5 text-sm"><span className="tabular-nums font-medium">{usd(z.price)} <span className="text-xs text-slate-400">(<Pct v={z.price / price - 1} />)</span></span><span className="text-xs text-slate-500">{z.from} · {z.note}</span></div>) : <p className="text-sm text-slate-400">ไม่มีโซนใกล้</p>}
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-emerald-700">Demand (แนวรับ — ฝั่งซื้อรอ) ใต้ราคา</div>
            {read.demand.length ? read.demand.map((z) => <div key={z.price} className="flex justify-between border-t border-slate-100 py-0.5 text-sm"><span className="tabular-nums font-medium">{usd(z.price)} <span className="text-xs text-slate-400">(<Pct v={z.price / price - 1} />)</span></span><span className="text-xs text-slate-500">{z.from} · {z.note}</span></div>) : <p className="text-sm text-slate-400">ไม่มีโซนใกล้</p>}
          </div>
        </div>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{read.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        </details>
        <form action="/btc" className="flex flex-wrap items-center gap-2 text-sm">
          {drop !== BTC.defaultDrop && <input type="hidden" name="d" value={drop} />}
          {mode === "limit" && <input type="hidden" name="m" value="limit" />}
          {level !== RANGE.defaultLevel && <input type="hidden" name="k" value={level} />}
          <label className="text-slate-600">ทุน</label>
          <input name="cap" type="number" step="any" min="1" defaultValue={cap} className="w-28 rounded-md border border-slate-300 px-2 py-1 tabular-nums" />
          <span className="text-slate-500">USDT · เลเวอเรจ</span>
          <input name="lev" type="number" min="1" max="125" defaultValue={lev} className="w-16 rounded-md border border-slate-300 px-2 py-1 tabular-nums" />
          <span className="text-slate-500">x</span>
          <button className="rounded-md bg-slate-800 px-3 py-1 text-white hover:bg-slate-700">คำนวณ</button>
          <span className="text-slate-500">→ เปิดสถานะ {notional.toLocaleString("en-US")} USDT · ราคาขยับ 1% = {(notional / 100).toLocaleString("en-US")} USDT · ค่าธรรมเนียมไป-กลับ ~{(notional * BTC.fee).toLocaleString("en-US", { maximumFractionDigits: 0 })} USDT/ไม้</span>
        </form>
        <div className="grid gap-2 sm:grid-cols-2">
          {plans.map((p) => (
            <div key={p.side} className={`rounded-md border p-3 ${p.side === "S" ? "border-red-200 bg-red-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
              <div className={`font-semibold ${p.side === "S" ? "text-red-700" : "text-emerald-700"}`}>{p.side === "S" ? `ถ้าราคาขึ้นไปถึง ${usd(p.entry)} → Short` : `ถ้าราคาลงมาถึง ${usd(p.entry)} → Long`}</div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-slate-500">เข้า (Limit)</div><div className="font-semibold tabular-nums">{usd(p.entry)}</div></div>
                <div><div className="text-slate-500">TP</div><div className="font-semibold tabular-nums text-emerald-700">{usd(p.tp)}</div><div className="text-xs text-slate-500"><Pct v={p.tp / p.entry - 1} /></div></div>
                <div><div className="text-slate-500">SL</div><div className="font-semibold tabular-nums text-red-600">{usd(p.sl)}</div><div className="text-xs text-slate-500"><Pct v={p.sl / p.entry - 1} /></div></div>
              </div>
              {(() => {
                const win = pnl(p.side, p.entry, p.tp), loss = pnl(p.side, p.entry, p.sl), liq = liqPrice(p.side, p.entry);
                const liqFirst = p.side === "L" ? liq >= p.sl : liq <= p.sl;
                return (
                  <p className="mt-2 rounded bg-white/70 px-2 py-1 text-sm">
                    ทุน {cap.toLocaleString("en-US")} × {lev}x: ถึง TP <b className="tabular-nums text-emerald-700">{money(win)} USDT</b> · โดน SL <b className="tabular-nums text-red-600">{money(loss)} USDT</b> (เสีย {Math.abs(loss / cap * 100).toFixed(1)}% ของทุน)
                    <br /><span className="text-xs text-slate-600">ล้างพอร์ตที่ ~{usd(liq)} · หักค่าธรรมเนียมไป-กลับแล้ว</span>
                    {liqFirst && <><br /><span className="text-xs font-medium text-red-600">⚠ {lev}x โดนล้างพอร์ตก่อนถึง SL — ลดเลเวอเรจ</span></>}
                  </p>
                );
              })()}
              <p className="mt-1 text-xs text-slate-600">R:R 1 : {p.rr.toFixed(1)}{p.ok ? <> · เป้า{p.reach === "ปกติ" ? "อยู่ในระยะแกว่งปกติ" : " ต้องแกว่งแรงกว่าปกติถึงจะถึง"}</> : <> — <b>รอ</b>: {p.why}</>} · ไม่ถึงทั้งคู่ {read.hold} ชม. ปิด Market</p>
              <p className="mt-1 text-xs text-slate-600">{p.side === "S" ? <>ถ้าปิดแท่งเหนือ {usd(p.sl)} = supply แตก ไม่ Short{p.next && <> · โซนถัดไป {usd(p.next)}</>}</> : <>ถ้าปิดแท่งใต้ {usd(p.sl)} = demand แตก ไม่ Long{p.next && <> · โซนถัดไป {usd(p.next)}</>} · จุดเข้า Long ลึกที่ทดสอบแล้วอยู่ที่ {usd(range.next.price)}</>}</p>
            </div>
          ))}
        </div>
        <details className="space-y-1" open>
          <summary className="cursor-pointer text-sm font-medium">ย้อนหลัง 24 ชม. ทุก 15 นาที — ณ เวลานั้นระบบให้เข้าที่ไหน</summary>
          {tlDone.length > 0 && <p className="text-sm">ถ้าตั้งทุกแถวที่ระบบให้เข้า: ได้เข้า {tlDone.length} ครั้ง · ได้ {tlDone.filter((x) => x.ret! > 0).length} · เสีย {tlDone.filter((x) => x.ret! <= 0).length} · รวม <b className="tabular-nums">{money(tlDone.reduce((a, x) => a + x.ret!, 0) * notional)} USDT</b> ที่ทุน {cap.toLocaleString("en-US")} × {lev}x (หักค่าธรรมเนียมแล้ว · แต่ละแถวคิดแยกกัน)</p>}
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-slate-500"><th className="pr-3">เวลา</th><th className="pr-3 text-right">ราคา</th><th className="pr-3">Short (เข้า · TP · SL)</th><th className="pr-3">ผล S (USDT)</th><th className="pr-3">Long (เข้า · TP · SL)</th><th>ผล L (USDT)</th></tr></thead>
              <tbody>{timeline.map((r) => (
                <tr key={r.t} className="border-t border-slate-100 align-top">
                  <td className="pr-3 tabular-nums">{new Date(r.t).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="pr-3 text-right tabular-nums">{usd(r.price)}</td>
                  {([r.S, r.L] as const).map((x, k) => (
                    <Fragment key={k}>
                      <td className="pr-3 tabular-nums">{!x ? <span className="text-slate-400">ไม่มีโซน</span> : x.ok ? <span className={k === 0 ? "text-red-700" : "text-emerald-700"}>{usd(x.entry)} · {usd(x.tp)} · {usd(x.sl)}</span> : <span className="text-slate-400" title={x.why}>รอ</span>}</td>
                      <td className="pr-3">{!x?.ok ? "" : !x.filled ? <span className="text-slate-400">ไม่ถึงราคาเข้า</span> : x.ret === null ? <span className="text-amber-600">ถืออยู่</span> : <>{x.outcome} <span className={`tabular-nums ${x.ret > 0 ? "text-emerald-700" : "text-red-600"}`}>{money(x.ret * notional)}</span></>}</td>
                    </Fragment>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">&ldquo;รอ&rdquo; = ไม่มีโซนที่ R:R ≥ 1 : 2 และเป้าถึงได้ (ชี้ที่คำว่ารอเพื่อดูเหตุผล) · limit ของแต่ละแถวใช้ได้ 15 นาทีถัดไป · ไม่ถึง TP/SL ใน 2 ชม. = ปิดที่ราคาตอนนั้น (หมดเวลา) · ย้อนหลังไม่มี order book ใช้แค่โซนจากกราฟ</p>
        </details>
        <p className="text-xs text-slate-500">อ่านจากข้อมูล ณ ตอนกดดึงราคา · โซนจากกราฟ = จุดกลับตัวของแท่ง {read.per === 4 ? "15 นาที ใน 24 ชม." : "1 ชม. ใน 3 วัน"} ล่าสุด · order book เปลี่ยนทุกวินาที กดดึงใหม่ก่อนตั้งคำสั่งทุกครั้ง · เป็นการอ่านสภาพตลาด ไม่ได้รับประกันว่าได้เปรียบ — ใช้ Isolated และเลเวอเรจต่ำ</p>
      </section>

      {/* จุดเข้าตามราคา */}
      <section className={`card space-y-2 ${rangeOpen ? "border-emerald-300 bg-emerald-50/50" : "border-blue-200"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">จุดเข้าตอนนี้</h2>
          <span className="text-sm text-slate-500">ราคา {usd(price)} · ต่ำสุด 24 ชม. {usd(range.next.low)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-slate-500">ต่ำกว่าจุดต่ำสุด 24 ชม.</span>
          {RANGE.levels.map((k) => (
            <Link key={k} href={href(drop, mode, k)} className={`rounded-md border px-2.5 py-0.5 tabular-nums ${k === level ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>−{k}%</Link>
          ))}
          <span className="text-slate-400">· ยิ่งลึก ยิ่งได้ต่อไม้มาก แต่ match น้อยลง</span>
        </div>
        {rangeOpen ? (
          <div className="space-y-1">
            <p className="text-xl font-semibold text-emerald-700">▲ Long (ถืออยู่) · เข้า {usd(rangeOpen.entry)}</p>
            <p className="text-sm"><b>ปล่อย (Market) ตอน {thai(rangeOpen.exitAt)}</b> · Stop Loss {usd(rangeOpen.entry * (1 - RANGE.stop))} · ตอนนี้ <Pct v={price / rangeOpen.entry - 1 - BTC.fee} /> (หักค่าธรรมเนียมแล้ว · ยังไม่คูณเลเวอเรจ)</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
              <div className="text-sm text-emerald-800">Long — ตั้ง Limit Buy</div>
              <div className="text-2xl font-semibold tabular-nums text-emerald-700">{usd(range.next.price)}</div>
              <div className="text-xs text-slate-600">ห่างราคาตอนนี้ <Pct v={range.next.price / price - 1} /> · ราคาเปลี่ยนตามจุดต่ำสุด 24 ชม. กดดึงราคาใหม่แล้วปรับคำสั่งตาม</div>
              <div className="mt-2 text-sm">
                <div className="text-slate-500">Stop Loss (−{RANGE.stop * 100}%)</div><div className="font-semibold tabular-nums text-red-600">{usd(range.next.stop)}</div>
                <p className="mt-1">ทุน {cap.toLocaleString("en-US")} × {lev}x: โดน SL <b className="tabular-nums text-red-600">{money(pnl("L", range.next.price, range.next.stop))} USDT</b> · ราคาเด้ง +1% = <b className="tabular-nums text-emerald-700">{money(pnl("L", range.next.price, range.next.price * 1.01))} USDT</b> · ล้างพอร์ต ~{usd(liqPrice("L", range.next.price))}</p>
                {liqPrice("L", range.next.price) >= range.next.stop && <p className="text-xs font-medium text-red-600">⚠ {lev}x โดนล้างพอร์ตก่อนถึง SL −{RANGE.stop * 100}% — ลดเลเวอเรจ</p>}
              </div>
            </div>
            <div className={`rounded-md border p-3 ${sPlan?.ok ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-slate-50"}`}>
              {sPlan?.ok ? (
                <>
                  <div className="text-sm text-red-800">Short — ตั้ง Limit Sell</div>
                  <div className="text-2xl font-semibold tabular-nums text-red-700">{usd(sPlan.entry)}</div>
                  <div className="text-xs text-slate-600">ห่างราคาตอนนี้ <Pct v={sPlan.entry / price - 1} /> · Supply ตามแท่ง {read.per === 4 ? "15 นาที" : "1 ชม."} · โซนเปลี่ยนเร็ว กดดึงราคาใหม่ก่อนตั้งทุกครั้ง</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div><div className="text-slate-500">TP</div><div className="font-semibold tabular-nums text-emerald-700">{usd(sPlan.tp)}</div><div className="text-xs text-slate-500"><Pct v={sPlan.tp / sPlan.entry - 1} /></div></div>
                    <div><div className="text-slate-500">Stop Loss</div><div className="font-semibold tabular-nums text-red-600">{usd(sPlan.sl)}</div><div className="text-xs text-slate-500"><Pct v={sPlan.sl / sPlan.entry - 1} /></div></div>
                  </div>
                  <p className="mt-2 text-sm">ทุน {cap.toLocaleString("en-US")} × {lev}x: TP <b className="tabular-nums text-emerald-700">{money(pnl("S", sPlan.entry, sPlan.tp))}</b> · SL <b className="tabular-nums text-red-600">{money(pnl("S", sPlan.entry, sPlan.sl))}</b> USDT · ล้างพอร์ต ~{usd(liqPrice("S", sPlan.entry))}</p>
                  <p className="mt-1 text-xs text-slate-600">R:R 1 : {sPlan.rr.toFixed(1)} · {sPlan.reach === "ปกติ" ? "เป้าอยู่ในระยะที่ราคาแกว่งปกติ" : "เป้าต้องแกว่งแรงกว่าปกติถึงจะถึง"} · ปิดแท่งเหนือ {usd(sPlan.sl)} = supply แตก ยกเลิก/ไม่เข้า{sPlan.next && <> · โซนถัดไป {usd(sPlan.next)}</>} · ขนาดไม้ตามเงินที่ยอมเสีย ดูในกล่อง &ldquo;วิเคราะห์ตอนนี้&rdquo;</p>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-600">Short</div>
                  <div className="text-2xl font-semibold text-slate-500">รอ — ยังไม่มีจุดที่คุ้ม</div>
                  <div className="text-xs text-slate-500">{sPlan ? <>supply {usd(sPlan.entry)}: {sPlan.why} · กดดึงราคาใหม่เมื่อราคาขยับ</> : "ไม่มี supply เหนือราคาตอนนี้"}</div>
                </>
              )}
              <p className="mt-2 text-xs text-slate-400">ระบบเลือกจาก Demand/Supply ณ ตอนนี้ ไม่ใช่สัญญาณที่ทดสอบย้อนหลังแล้ว (ต่างจากฝั่ง Long)</p>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">match แล้วตั้ง Stop Loss ตามข้างบน · ใช้ Isolated เลเวอเรจต่ำ</p>
      </section>

      {/* ข้อมูลประกอบ */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">ข้อมูลอื่นที่ดึงได้ตอนนี้ (ประกอบ · ไม่ใช้ตัดสิน)</h2>
        {snap ? (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><div className="text-slate-500">Funding (8 ชม.)</div><div className="tabular-nums">{(snap.funding * 100).toFixed(4)}%</div><div className="text-xs text-slate-400">{snap.funding > 0 ? "Long จ่าย Short" : "Short จ่าย Long"} · ตัดรอบ {thai(snap.nextFunding).split(" ").at(-1)} · ทดสอบแล้ว ไม่ผ่าน</div></div>
            <div><div className="text-slate-500">Mark − Index</div><div className="tabular-nums"><Pct v={snap.mark / snap.index - 1} d={3} /></div><div className="text-xs text-slate-400">ฟิวเจอร์แพง/ถูกกว่าสปอต</div></div>
            <div><div className="text-slate-500">Order book ±0.5%</div><div className="tabular-nums">ซื้อ {snap.bidDepth.toFixed(0)} · ขาย {snap.askDepth.toFixed(0)} BTC</div><div className="text-xs text-slate-400">เปลี่ยนทุกวินาที · ย้อนหลังไม่มี ทดสอบไม่ได้</div></div>
            <div><div className="text-slate-500">Open Interest</div><div className="tabular-nums">{snap.oi?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "—"} BTC</div><div className="text-xs text-slate-400">เก็บสะสมอยู่ (ด้านล่าง)</div></div>
          </div>
        ) : <p className="text-sm text-slate-500">ดึงข้อมูลสดจาก Binance ไม่ได้ — กดดึงใหม่</p>}
        {flow.last && <p className="text-sm">Long/Short บัญชีทั้งตลาด <b className="tabular-nums">{flow.last.lsAccount?.toFixed(2)}</b> · top trader <b className="tabular-nums">{flow.last.lsTop?.toFixed(2)}</b> · Taker ซื้อ/ขาย <b className="tabular-nums">{flow.last.takerRatio?.toFixed(2)}</b> <span className="text-xs text-slate-400">(ชั่วโมงที่ {thai(flow.last.time)})</span></p>}
        <p className="text-xs text-slate-500">ตัวที่ใช้ตัดสินจริงมีแค่ราคา (จุดเข้าด้านบน) · Funding ทดสอบแล้วไม่ช่วย · OI / Long-Short / Taker มีย้อนหลังแค่ 30 วัน ระบบเก็บสะสมไว้ ทดสอบได้เมื่อมีหลายเดือน · Order book ไม่มีประวัติ — ตัวเลขเหล่านี้ดูประกอบเท่านั้น อย่าใช้เปิด S/L</p>
      </section>

      {/* เกณฑ์ลง */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-slate-500">สัญญาณเมื่อ BTC ลงใน 24 ชม. ตั้งแต่</span>
        {BTC.drops.map((d) => (
          <Link key={d} href={href(d, mode)} className={`rounded-md border px-2.5 py-0.5 tabular-nums ${d === drop ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>−{d}%</Link>
        ))}
        <span className="text-slate-400">· ยิ่งลงแรง ยิ่งแม่น แต่สัญญาณน้อยลง</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-slate-500">วิธีเข้า</span>
        {(["close", "limit"] as const).map((m) => (
          <Link key={m} href={href(drop, m)} className={`rounded-md border px-2.5 py-0.5 ${m === mode ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>{m === "close" ? "ราคาปิดแท่ง (ค่าเริ่มต้น)" : "Limit −1% รอ 2 ชม."}</Link>
        ))}
        <span className="text-slate-400">· limit ยังไม่ชนะชัด ดูตารางเทียบด้านล่าง</span>
      </div>

      {/* ตอนนี้ */}
      <section className={`card ${open ? "border-emerald-300 bg-emerald-50/50" : ""}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">ตอนนี้</h2>
          <span className="text-sm text-slate-500">ราคา {usd(price)} · 24 ชม. <Pct v={ch} /> · แท่งล่าสุดปิด {thai(bars[last].t + 3600000)}</span>
        </div>
        {pending ? (
          <div className="mt-2 space-y-1">
            <p className="text-xl font-semibold text-amber-600">● ตั้ง Limit Buy (Long) ที่ {usd(pending.price)}</p>
            <p className="text-sm">สัญญาณเมื่อ {thai(pending.signalAt)} (ลง 24 ชม. <Pct v={pending.drop24} />) · <b>ยกเลิกถ้ายังไม่ match ภายใน {thai(pending.cancelAt)}</b> · ราคาตอนนี้ห่าง <Pct v={pending.price / price - 1} /></p>
            <p className="text-sm text-slate-600">match แล้ว → ถือ {BTC.hold} ชม. นับจากปิดแท่งที่ match แล้วออกที่ราคาตอนนั้น · ไม่ match = ข้ามไม้นี้</p>
          </div>
        ) : open ? (
          <div className="mt-2 space-y-1">
            <p className="text-xl font-semibold text-emerald-700">▲ Long (ถืออยู่)</p>
            <p className="text-sm">เข้า {usd(open.entry)} เมื่อ {thai(open.entryAt)} (ลง 24 ชม. <Pct v={open.drop24} />) · <b>ออก {thai(open.exitAt)}</b> ที่ราคาตอนนั้น
              {open.exitAt > now && <> · อีก {Math.ceil((open.exitAt - now) / 3600000)} ชม.</>}</p>
            <p className="text-sm">ตอนนี้ <Pct v={price / open.entry - 1 - BTC.fee} /> (หักค่าธรรมเนียมแล้ว · ยังไม่คูณเลเวอเรจ)</p>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-xl font-semibold text-slate-600">รอ — ไม่มีสัญญาณ</p>
            <p className="text-sm text-slate-600">ทดสอบแล้ว ทิศทางชั่วโมงต่อชั่วโมงไม่มีแต้มต่อหลังหักค่าธรรมเนียม · สัญญาณ Long จะขึ้นเมื่อแท่งชั่วโมงถัดไปปิดต่ำกว่า <b>{usd(trigger)}</b> (ลง {drop}% จาก 24 ชม. ก่อน) · ห่างจากราคาตอนนี้ <Pct v={trigger / price - 1} /></p>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">กติกา: ปิดแท่ง 1 ชม. ที่ลง ≥{drop}% เทียบ 24 ชม. ก่อน → {mode === "close" ? "Long ที่ราคาปิด" : `ตั้ง limit buy ต่ำกว่าราคาปิด ${BTC.limit * 100}% รอ ${BTC.wait} ชม. (นับว่า match เมื่อราคาลงทะลุอีก ${BTC.through * 100}%) ไม่ match = ข้าม`} · ถือ {BTC.hold} ชม. แล้วออก · ไม่มีจุดตัดขาดทุน · ระหว่างถือไม่เปิดไม้ใหม่ · ค่าธรรมเนียมไป-กลับ {BTC.fee * 100}% · ไม่มีสัญญาณ Short (ทดสอบแล้วไม่ผ่าน)</p>
      </section>

      {/* ผลจริง */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">ผลจริง (ล็อกตั้งแต่ {thai(Date.parse(`${BTC.since}T00:00:00+07:00`)).split(" ").slice(0, 3).join(" ")})</h2>
        {real.length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีสัญญาณที่เกณฑ์ −{drop}% ตั้งแต่เปิดเมนู — สัญญาณเกิดไม่บ่อย (−5% ≈ เดือนละ 4 ไม้ในอดีต)</p> : (
          <>
            {realDone.length > 0 && <p className="text-sm">ปิดแล้ว {realDone.length} ไม้ · ถูก {realRet.filter((x) => x > 0).length} · รวม <Pct v={realRet.reduce((s, x) => s + x, 0)} /></p>}
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th>เข้า</th><th className="text-right">ราคาเข้า</th><th>ออก</th><th className="text-right">ราคาออก</th><th className="text-right">ผล</th></tr></thead>
              <tbody>{real.map((r) => (
                <tr key={r.id} className="border-t border-slate-100"><td>{thai(r.entryAt.getTime())}</td><td className="text-right tabular-nums">{usd(r.entry)}</td><td>{thai(r.exitAt.getTime())}</td><td className="text-right tabular-nums">{r.exit === null ? "ถืออยู่" : usd(r.exit)}</td><td className="text-right">{r.exit === null ? "—" : <Pct v={r.exit / r.entry - 1 - BTC.fee} />}</td></tr>
              ))}</tbody>
            </table>
          </>
        )}
      </section>

      {/* ทดสอบย้อนหลัง */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">ทดสอบย้อนหลัง · ลง ≥{drop}% → Long {BTC.hold} ชม. · {mode === "close" ? "เข้าที่ราคาปิด" : "limit −1%"}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th>ช่วง</th><th className="text-right">ไม้</th><th className="text-right">ถูก</th><th className="text-right">เฉลี่ย/ไม้</th><th className="text-right">รวม</th><th className="text-right">ลงลึกสุดระหว่างถือ</th><th className="text-right">เสียติดกันสูงสุด</th><th className="text-right">เทียบ Long มั่ว ๆ</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.label} className="border-t border-slate-100">
                <td>{r.label}</td><td className="text-right tabular-nums">{r.s.n}</td><td className="text-right tabular-nums">{(r.s.hit * 100).toFixed(1)}%</td>
                <td className="text-right"><Pct v={r.s.avg} /></td><td className="text-right"><Pct v={r.s.total} d={1} /></td><td className="text-right"><Pct v={r.s.worst} d={1} /></td>
                <td className="text-right tabular-nums">{r.s.maxLossStreak} ไม้</td><td className="text-right text-slate-500">{(r.base.hit * 100).toFixed(1)}% · <Pct v={r.base.avg} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">% = ของราคา หักค่าธรรมเนียมแล้ว · <b>ยังไม่คูณเลเวอเรจ</b> (เลเวอเรจ 10x → ×10 ทั้งกำไรและขาดทุน) · &ldquo;ลงลึกสุดระหว่างถือ&rdquo; คือราคาต่ำสุดที่เคยเจอระหว่าง 12 ชม. — ถ้าเลเวอเรจสูงพอจะโดนล้างพอร์ตก่อนถึงเวลาออก</p>
      </section>

      {/* เทียบวิธีเข้า */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">เทียบวิธีเข้า · ลง ≥{drop}%</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th>วิธีเข้า</th><th className="text-right">ครึ่งแรก ไม้ · ถูก · เฉลี่ย · รวม</th><th className="text-right">ครึ่งหลัง ไม้ · ถูก · เฉลี่ย · รวม</th><th className="text-right">ลงลึกสุด</th></tr></thead>
            <tbody>{cmp.map((r) => (
              <tr key={r.m} className={`border-t border-slate-100 ${r.m === mode ? "font-medium" : ""}`}>
                <td>{r.m === "close" ? "ราคาปิดแท่ง" : "Limit −1% รอ 2 ชม."}</td>
                {[r.a, r.b].map((s, k) => <td key={k} className="text-right tabular-nums">{s.n} · {(s.hit * 100).toFixed(1)}% · <Pct v={s.avg} /> · <Pct v={s.total} d={1} /></td>)}
                <td className="text-right"><Pct v={r.all.worst} d={1} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">limit ได้ราคาเข้าดีกว่า แต่ไม้ที่เด้งขึ้นทันทีจะไม่ได้ match เลยถูกข้าม (ซึ่งส่วนมากเป็นไม้ที่ได้กำไร) · ทดสอบซ้ำด้วยแท่ง 15 นาทีแล้วผลออกมาไม่ตรงกัน จึงยังไม่ใช้เป็นค่าเริ่มต้น · ผลจริงล็อกแยกตามวิธีเข้า</p>
      </section>

      {/* ตั้งค่าใน Binance */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">ตั้งค่าใน Binance ฟิวเจอร์</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Margin: Isolated</b> — เสียได้ไม่เกินเงินที่วางในไม้นั้น</li>
          <li><b>เลเวอเรจ:</b> ระหว่างถือ ราคาเคยลงลึกสุด <Pct v={worstAll} d={1} /> (ทั้งหมด) / <Pct v={worstYear} d={1} /> (1 ปีล่าสุด) · เลเวอเรจ N เท่าโดนล้างพอร์ตเมื่อลงราว 100/N % → 2x ≈ −50%, 3x ≈ −33%, 5x ≈ −20%, 10x ≈ −10% · ให้เลือกเลเวอเรจที่ล้างพอร์ตลึกกว่าตัวเลขข้างหน้า และเผื่อเพิ่ม</li>
          <li><b>เข้า:</b> {mode === "close" ? "Market Long ทันทีหลังแท่ง 1 ชม. ปิด (หน้านี้บอกเมื่อมีสัญญาณ)" : "Limit Buy (GTC) ที่ราคาที่หน้านี้บอก แล้วยกเลิกเองถ้าครบ 2 ชม. ยังไม่ match"}</li>
          <li><b>ออก:</b> ปิดสถานะเมื่อครบ {BTC.hold} ชม. (Market) · ไม่ตั้ง TP/SL ตามที่ทดสอบไว้ ถ้าจะใส่ SL ต้องทดสอบก่อน เพราะจะเปลี่ยนผล</li>
          <li><b>Short:</b> ยังไม่มีสัญญาณที่ผ่าน — ไม่เปิด Short</li>
        </ul>
      </section>

      {/* ข้อมูลที่เก็บสะสม */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">ข้อมูลที่เริ่มเก็บ (ยังไม่ใช้คิดสัญญาณ)</h2>
        <p className="text-sm text-slate-600">Open Interest · Long/Short ratio · Taker buy/sell — Binance เก็บย้อนหลังให้แค่ 30 วัน ทดสอบไม่ได้ จึงเก็บสะสมเอง ไว้หาสัญญาณ Short เมื่อได้หลายเดือน · เก็บแล้ว {flow.n.toLocaleString()} ชม.{flow.first && <> ตั้งแต่ {thai(flow.first)}</>} · <b>เปิดหน้านี้อย่างน้อยเดือนละครั้ง</b> ไม่งั้นข้อมูลขาด</p>
        {flow.last && (
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div><div className="text-slate-500">Open Interest</div><div className="tabular-nums">{flow.last.oi?.toLocaleString("en-US", { maximumFractionDigits: 0 })} BTC</div></div>
            <div><div className="text-slate-500">L/S บัญชีทั้งตลาด</div><div className="tabular-nums">{flow.last.lsAccount?.toFixed(2)}</div></div>
            <div><div className="text-slate-500">L/S top trader</div><div className="tabular-nums">{flow.last.lsTop?.toFixed(2)}</div></div>
            <div><div className="text-slate-500">Taker buy/sell</div><div className="tabular-nums">{flow.last.takerRatio?.toFixed(2)}</div></div>
          </div>
        )}
        {flow.last && <p className="text-xs text-slate-400">ค่าล่าสุด {thai(flow.last.time)}</p>}
      </section>

      {/* ไม้ล่าสุดในอดีต */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">10 ไม้ล่าสุด (ย้อนหลัง)</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>เข้า</th><th className="text-right">ลง 24 ชม.</th><th className="text-right">ราคาเข้า</th><th className="text-right">ราคาออก</th><th className="text-right">ลงลึกสุด</th><th className="text-right">ผล</th></tr></thead>
          <tbody>{trades.slice(-10).reverse().map((t) => (
            <tr key={t.entryAt} className="border-t border-slate-100"><td>{thai(t.entryAt)}</td><td className="text-right"><Pct v={t.drop24} d={1} /></td><td className="text-right tabular-nums">{usd(t.entry)}</td><td className="text-right tabular-nums">{t.exit === null ? "ถืออยู่" : usd(t.exit)}</td><td className="text-right"><Pct v={t.worst} d={1} /></td><td className="text-right">{t.ret === null ? "—" : <Pct v={t.ret} />}</td></tr>
          ))}</tbody>
        </table>
      </section>

      {/* ที่ทดสอบแล้วไม่ผ่าน */}
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">สัญญาณ Long/Short รายชั่วโมงที่ทดสอบแล้วไม่ผ่าน</h2>
        <p className="text-xs text-slate-500">ทิศชั่วโมงถัดไป · ถูก % · เฉลี่ยต่อไม้ก่อนหักค่าธรรมเนียม — ทุกตัวได้ไม่ถึงค่าธรรมเนียม 0.1% ต่อไม้ จึงไม่แสดงเป็นสัญญาณ (ทดสอบ 17 ต.ค. 69)</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th>วิธี</th><th className="text-right">ครึ่งแรก</th><th className="text-right">ครึ่งหลัง</th></tr></thead>
          <tbody>{FAILED.map((f) => <tr key={f.name} className="border-t border-slate-100"><td>{f.name}</td><td className="text-right tabular-nums text-slate-600">{f.a}</td><td className="text-right tabular-nums text-slate-600">{f.b}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  );
}
