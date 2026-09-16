import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtNum, fmtChange, hasClose, evaluateCalls, CALL_MIN_GAP_PCT } from "@/lib/stats";
import { toDayDigits, pickTwo } from "@/lib/digits";
import { Digits } from "@/components/digit-badges";
import { OpenForm } from "@/components/open-form";
import { TodayCard } from "@/components/today-card";
import { YahooOpenButton } from "@/components/yahoo-open-button";
import { fetchQuote } from "@/lib/yahoo";
import { evaluateLiveCalls, todayThai } from "@/lib/intraday";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const stocks = await prisma.stock.findMany({
    where: { userId },
    include: { records: { orderBy: { date: "asc" } } },
    orderBy: { symbol: "asc" },
  });
  const today = todayThai();

  // ราคาสดจาก Yahoo ต่อหุ้น (ดึงครั้งเดียวต่อการโหลดหน้า; หุ้นที่ไม่รู้จักสัญลักษณ์ → null)
  const quotes = new Map(await Promise.all(stocks.map(async (s) => [s.id, await fetchQuote(s.symbol)] as const)));

  // การ์ด "วันนี้": ทุกแถวที่กรอกเปิดแล้วแต่ยังไม่มีปิด
  const pending = stocks.flatMap((s) => {
    const closed = s.records.filter(hasClose);
    const priceStats = summarize(closed);
    const q = quotes.get(s.id);
    const liveScore = evaluateLiveCalls(s.records);
    return s.records
      .filter((r) => !hasClose(r))
      .map((r) => ({
        stock: s, record: r, priceStats, priceHistory: closed,
        live: q && q.tradingDate === r.date.toISOString().slice(0, 10) ? { price: q.last, at: q.lastAt.toISOString(), closed: q.closed } : null,
        liveScore: { called: liveScore.called, hits: liveScore.hits },
      }));
  }).sort((a, b) => b.record.date.getTime() - a.record.date.getTime());

  // ผลล่าสุดที่ตัดสินแล้ว + สกอร์รวม ต่อหุ้น
  const scoreboard = stocks.map((s) => {
    const closed = s.records.filter(hasClose);
    const days = toDayDigits(closed);
    const judged = days.map((d, i) => {
      const two = pickTwo(closed[i].openValue, closed[i].openChange, closed.slice(0, i));
      const pair = two.digits.map((x) => x.digit);
      const pick = pair[0];
      const rec = closed[i]; // closed เรียงตามวันที่เหมือน days
      // วันที่เสมอกันหลายตัว นับสัดส่วนของกลุ่มที่โผล่ (ไม่ขึ้นกับว่าหยิบตัวไหนเป็นตัวหลัก)
      const fair = two.tiedWithMain.filter((x) => d.closeDigits.includes(x)).length / two.tiedWithMain.length;
      const hit2 = pair.filter((x) => d.closeDigits.includes(x));
      return { d, rec, pick, pair, fair, hit1: d.closeDigits.includes(pick), hit2, hit3: hit2.length > 0 || d.closeDigits.includes(two.third.digit) };
    });
    const last = judged[judged.length - 1];
    const calls = evaluateCalls(s.records);
    const lastCall = [...calls.perDay].reverse().find((d) => d.call && d.actual);
    const liveCalls = evaluateLiveCalls(s.records);
    return { stock: s, n: judged.length, hit1: judged.filter((j) => j.hit1).length, fair: judged.reduce((a, j) => a + j.fair, 0), hit2: judged.filter((j) => j.hit2.length > 0).length, hitBoth: judged.filter((j) => j.hit2.length === 2).length, hit3: judged.filter((j) => j.hit3).length, last, calls, lastCall, liveCalls };
  });
  const defaultStock = [...stocks].sort((a, b) => b.records.length - a.records.length)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">วันนี้</h1>
        <Link href="/digits" className="text-sm text-blue-600 hover:underline">หน้าวิเคราะห์เต็ม →</Link>
      </div>

      {saved && <p className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800">✓ บันทึกเลขเปิดแล้ว — ผลวิเคราะห์อยู่ด้านล่าง</p>}

      {stocks.length === 0 ? (
        <p className="card text-sm text-slate-500">ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link></p>
      ) : pending.length === 0 ? (
        <section className="space-y-2">
          <p className="text-sm text-slate-600">ยังไม่ได้กรอกเปิดของวันนี้ — กรอกแล้วระบบจะฟันธงให้ทันที</p>
          <YahooOpenButton stockId={defaultStock.id} symbol={defaultStock.symbol} quote={(() => {
            const q = quotes.get(defaultStock.id);
            // ซ่อนถ้าวันซื้อขายล่าสุดของ Yahoo มีผลปิดในระบบแล้ว (= วันนี้ตลาดยังไม่เปิด)
            const done = q && defaultStock.records.some((r) => r.date.toISOString().slice(0, 10) === q.tradingDate && hasClose(r));
            return q && !done ? { tradingDate: q.tradingDate, dateLabel: new Date(q.tradingDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" }), open: q.open, prevClose: q.prevClose } : null;
          })()} />
          {(() => { const q = quotes.get(defaultStock.id); return q && defaultStock.records.some((r) => r.date.toISOString().slice(0, 10) === q.tradingDate && hasClose(r)) ? <p className="text-xs text-slate-500">Yahoo ยังอยู่ที่วัน {q.tradingDate} (บันทึกครบแล้ว) — ปุ่มดึงเปิดจะขึ้นหลังตลาดเปิด 10:45 น. ไทย</p> : null; })()}
          <OpenForm stocks={stocks} stockId={defaultStock.id} date={today} redirectTo="dashboard" />
        </section>
      ) : (
        <>
          <div className="grid gap-4">
            {pending.map((p) => <TodayCard key={p.record.id} {...p} />)}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600">กรอกเปิดวันอื่น / หุ้นอื่น</summary>
            <div className="mt-2"><OpenForm stocks={stocks} stockId={defaultStock.id} date={today} redirectTo="dashboard" /></div>
          </details>
        </>
      )}

      {/* ผลการฟันทิศทาง (เฉพาะวันที่มั่นใจ) */}
      <section className="card p-0">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="font-medium">ผลการฟันทิศทาง — จากเปิด (เฉพาะวันที่เปิดห่าง ≥ {CALL_MIN_GAP_PCT}%) และ ฟันสด (ราคาระหว่างวัน)</h2>
          <p className="text-xs text-slate-500">จากเปิดฟันได้ราว 1 ใน 15 วัน · ฟันสดฟันได้เกือบทุกวันถ้าเช็กหลัง 13:45 น. ไทย และราคาห่างจากปิดเมื่อวาน ≥0.25% · นับเฉพาะวันที่ฟันและมีผลปิดแล้ว</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">หุ้น</th>
                <th className="px-5 py-2 text-right">วันที่ฟัน</th>
                <th className="px-5 py-2 text-right">ถูก</th>
                <th className="px-5 py-2 text-right">ไม่ฟัน</th>
                <th className="px-5 py-2 text-right">ฟันสด ถูก</th>
                <th className="px-5 py-2">ฟันล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoreboard.map(({ stock, calls, lastCall, liveCalls }) => (
                <tr key={stock.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-medium">{stock.symbol}</td>
                  <td className="px-5 py-2.5 text-right">{calls.called}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${calls.called && calls.hits / calls.called >= 0.7 ? "text-emerald-600" : ""}`}>
                    {calls.called ? `${calls.hits}/${calls.called} (${Math.round((calls.hits / calls.called) * 100)}%)` : "-"}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{calls.skipped} วัน</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${liveCalls.called && liveCalls.hits / liveCalls.called >= 0.85 ? "text-emerald-600" : ""}`}>
                    {liveCalls.called ? `${liveCalls.hits}/${liveCalls.called} (${Math.round((liveCalls.hits / liveCalls.called) * 100)}%)` : <span className="font-normal text-slate-400">ยังไม่มี</span>}
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    {lastCall ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className="text-slate-500">{lastCall.date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                        <span className={`rounded px-1.5 py-0.5 font-medium ${lastCall.call === "up" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{lastCall.call === "up" ? "▲ ปิดบวก" : "▼ ปิดลบ"}</span>
                        <span className="text-slate-500">(เปิด {lastCall.openPct > 0 ? "+" : ""}{lastCall.openPct.toFixed(2)}%)</span>
                        {lastCall.hit ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">✓ ถูก</span> : <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">✗ ผิด</span>}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* สกอร์เลข */}
      <section className="card p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="font-medium">ผลงานฟันเลข 2 ตัว <span className="text-xs font-normal text-slate-500">10 ปี: ตัวหลัก 36% · ≥1 ใน 2 ≈ 63% (สุ่ม 59%) · ≥1 ใน 3 ≈ 82% (สุ่ม 71%)</span></h2>
            <p className="text-xs text-slate-500">* วันส่วนใหญ่เลขเสมอกัน 6–8 ตัว จึงวัดด้วยสัดส่วนของกลุ่มที่เสมอที่โผล่จริง (ไม่ขึ้นกับว่าหยิบตัวไหน) — “ตัวที่หยิบถูก” คือเลขตัวเดียวที่ระบบหยิบ แกว่งตามโชค</p>
          </div>
          <Link href="/stocks" className="text-sm text-blue-600 hover:underline">จัดการหุ้น</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">หุ้น</th>
                <th className="px-5 py-2 text-right">วันที่ปิดแล้ว</th>
                <th className="px-5 py-2 text-right">ตัวหลัก*</th>
                <th className="px-5 py-2 text-right text-slate-400">ตัวที่หยิบถูก</th>
                <th className="px-5 py-2 text-right">2 ตัว ≥1 ถูก</th>
                <th className="px-5 py-2 text-right">2 ตัวถูกทั้งคู่</th>
                <th className="px-5 py-2 text-right">3 ตัว (รวมสำรอง) ≥1</th>
                <th className="px-5 py-2">ผลล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoreboard.map(({ stock, n, hit1, fair, hit2, hitBoth, hit3, last }) => (
                <tr key={stock.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <Link href={`/stocks/${stock.id}`} className="font-medium text-blue-600 hover:underline">{stock.symbol}</Link>
                    {stock.name && <span className="ml-2 text-slate-500">{stock.name}</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right">{n}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${n && fair / n > 0.36 ? "text-emerald-600" : ""}`}>{n ? `${Math.round((fair / n) * 100)}%` : "-"}</td>
                  <td className="px-5 py-2.5 text-right text-slate-400">{n ? `${hit1}/${n} (${Math.round((hit1 / n) * 100)}%)` : "-"}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${n && hit2 / n > 0.63 ? "text-emerald-600" : ""}`}>{n ? `${hit2}/${n} (${Math.round((hit2 / n) * 100)}%)` : "-"}</td>
                  <td className="px-5 py-2.5 text-right">{n ? `${hitBoth}/${n} (${Math.round((hitBoth / n) * 100)}%)` : "-"}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${n && hit3 / n > 0.71 ? "text-emerald-600" : ""}`}>{n ? `${hit3}/${n} (${Math.round((hit3 / n) * 100)}%)` : "-"}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    {last ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-xs text-slate-500">{last.d.date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                        <span className="text-xs">ฟัน <span className="font-mono font-bold">{last.pick}</span></span>
                        <Digits value={last.d.closeTop2} hilite={last.hit2} tone="blue" /> <Digits value={last.d.closeBottom2} hilite={last.hit2} tone="blue" />
                        <span className="text-xs">รอง <span className="font-mono font-bold">{last.pair[1]}</span></span>
                        {last.hit2.length === 2 ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">✓ ถูกทั้งคู่</span> : last.hit1 ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">✓ ตัวหลักถูก</span> : last.hit2.length ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">ตัวรองถูก</span> : <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">✗</span>}
                        <span className="text-xs text-slate-400">{fmtNum(last.rec.closeValue)} ({fmtChange(last.rec.closeChange)})</span>
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
