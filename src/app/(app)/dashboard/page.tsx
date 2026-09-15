import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtNum, fmtChange, hasClose, evaluateCalls, CALL_MIN_GAP_PCT } from "@/lib/stats";
import { toDayDigits, pickTwo } from "@/lib/digits";
import { Digits } from "@/components/digit-badges";
import { OpenForm } from "@/components/open-form";
import { TodayCard } from "@/components/today-card";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const stocks = await prisma.stock.findMany({
    where: { userId },
    include: { records: { orderBy: { date: "asc" } } },
    orderBy: { symbol: "asc" },
  });
  const today = new Date().toISOString().slice(0, 10);

  // การ์ด "วันนี้": ทุกแถวที่กรอกเปิดแล้วแต่ยังไม่มีปิด
  const pending = stocks.flatMap((s) => {
    const closed = s.records.filter(hasClose);
    const priceStats = summarize(closed);
    return s.records
      .filter((r) => !hasClose(r))
      .map((r) => ({ stock: s, record: r, priceStats, priceHistory: closed }));
  }).sort((a, b) => b.record.date.getTime() - a.record.date.getTime());

  // ผลล่าสุดที่ตัดสินแล้ว + สกอร์รวม ต่อหุ้น
  const scoreboard = stocks.map((s) => {
    const closed = s.records.filter(hasClose);
    const days = toDayDigits(closed);
    const judged = days.map((d, i) => {
      const pair = pickTwo(closed[i].openValue, closed[i].openChange, closed.slice(0, i)).digits.map((x) => x.digit);
      const pick = pair[0];
      const rec = closed[i]; // closed เรียงตามวันที่เหมือน days
      return { d, rec, pick, pair, hit1: d.closeDigits.includes(pick), hit2: pair.filter((x) => d.closeDigits.includes(x)) };
    });
    const last = judged[judged.length - 1];
    const calls = evaluateCalls(s.records);
    const lastCall = [...calls.perDay].reverse().find((d) => d.call && d.actual);
    return { stock: s, n: judged.length, hit1: judged.filter((j) => j.hit1).length, hit2: judged.filter((j) => j.hit2.length > 0).length, hitBoth: judged.filter((j) => j.hit2.length === 2).length, last, calls, lastCall };
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
          <h2 className="font-medium">ผลการฟันทิศทาง — เฉพาะวันที่เปิดห่าง ≥ {CALL_MIN_GAP_PCT}%</h2>
          <p className="text-xs text-slate-500">วันอื่น ๆ ระบบไม่ฟัน (โอกาสถูกไม่พอ) · นับเฉพาะวันที่ฟันและมีผลปิดแล้ว</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">หุ้น</th>
                <th className="px-5 py-2 text-right">วันที่ฟัน</th>
                <th className="px-5 py-2 text-right">ถูก</th>
                <th className="px-5 py-2 text-right">ไม่ฟัน</th>
                <th className="px-5 py-2">ฟันล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoreboard.map(({ stock, calls, lastCall }) => (
                <tr key={stock.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 font-medium">{stock.symbol}</td>
                  <td className="px-5 py-2.5 text-right">{calls.called}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${calls.called && calls.hits / calls.called >= 0.7 ? "text-emerald-600" : ""}`}>
                    {calls.called ? `${calls.hits}/${calls.called} (${Math.round((calls.hits / calls.called) * 100)}%)` : "-"}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-500">{calls.skipped} วัน</td>
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
          <h2 className="font-medium">ผลงานฟันเลข 2 ตัว <span className="text-xs font-normal text-slate-500">10 ปี: ตัวหลัก 36% · ≥1 ใน 2 ≈ 63% (สุ่ม 59%)</span></h2>
          <Link href="/stocks" className="text-sm text-blue-600 hover:underline">จัดการหุ้น</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">หุ้น</th>
                <th className="px-5 py-2 text-right">วันที่ปิดแล้ว</th>
                <th className="px-5 py-2 text-right">ตัวหลักถูก</th>
                <th className="px-5 py-2 text-right">2 ตัว ≥1 ถูก</th>
                <th className="px-5 py-2 text-right">2 ตัวถูกทั้งคู่</th>
                <th className="px-5 py-2">ผลล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoreboard.map(({ stock, n, hit1, hit2, hitBoth, last }) => (
                <tr key={stock.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5">
                    <Link href={`/stocks/${stock.id}`} className="font-medium text-blue-600 hover:underline">{stock.symbol}</Link>
                    {stock.name && <span className="ml-2 text-slate-500">{stock.name}</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right">{n}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${n && hit1 / n > 0.4 ? "text-emerald-600" : ""}`}>{n ? `${hit1}/${n} (${Math.round((hit1 / n) * 100)}%)` : "-"}</td>
                  <td className={`px-5 py-2.5 text-right font-semibold ${n && hit2 / n > 0.63 ? "text-emerald-600" : ""}`}>{n ? `${hit2}/${n} (${Math.round((hit2 / n) * 100)}%)` : "-"}</td>
                  <td className="px-5 py-2.5 text-right">{n ? `${hitBoth}/${n} (${Math.round((hitBoth / n) * 100)}%)` : "-"}</td>
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
