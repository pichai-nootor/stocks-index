import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtChange, fmtNum, hasClose, evaluateCalls, CALL_MIN_GAP_PCT } from "@/lib/stats";
import { pickTwo, top2, bottom2, randomAtLeastOne } from "@/lib/digits";
import { todayThai } from "@/lib/intraday";
import { deleteRecord, deleteStock } from "@/app/actions/stocks";
import { StatCard } from "@/components/stat-card";
import { Change, PatternBadge } from "@/components/change";
import { PatternMatrix } from "@/components/pattern-matrix";
import { Digits } from "@/components/digit-badges";
import { RecordForm } from "./record-form";
import { CloseForm } from "@/components/close-form";
import { ImportForm } from "./import-form";
import { Pagination, paginate } from "@/components/pagination";

export default async function StockDetailPage({ params, searchParams }: PageProps<"/stocks/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const { userId } = await requireUser();
  const stock = await prisma.stock.findFirst({
    where: { id, userId },
    include: { records: { orderBy: { date: "asc" } } },
  });
  if (!stock) notFound();

  const closed = stock.records.filter(hasClose);
  const st = summarize(closed);

  // ฟันธงของแต่ละวัน: ใช้เฉพาะวันที่ปิดแล้ว "ก่อนหน้า" วันนั้น (สำหรับทิศทาง)
  const rows = stock.records.map((r) => {
    const history = closed.filter((d) => d.date.getTime() < r.date.getTime());
    const oTop = top2(r.openValue), oBot = bottom2(r.openChange);
    const two = pickTwo(r.openValue, r.openChange, history);
    const pair = two.digits.map((x) => x.digit), pick = pair[0];
    const closeDigits = hasClose(r) ? [...new Set((top2(r.closeValue) + bottom2(r.closeChange)).split(""))] : null;
    const hit1 = pick !== null && closeDigits ? closeDigits.includes(pick) : null;
    const hit2 = pair && closeDigits ? pair.filter((d) => closeDigits.includes(d)) : null;
    const third = two.third.digit, fourth = two.fourth.digit;
    const hit3 = closeDigits ? closeDigits.includes(third) : null;
    const hit4 = closeDigits ? closeDigits.includes(fourth) : null;
    return { r, oTop, oBot, pick, pair, third, fourth, p: two.digits[0].p, closeDigits, hit1, hit2, hit3, hit4 };
  }).reverse();

  const calls = evaluateCalls(stock.records);
  const callByDate = new Map(calls.perDay.map((d) => [d.date.getTime(), d]));
  const paged = paginate(rows, page);
  const judged = rows.filter((x) => x.hit1 !== null);
  const hit1Count = judged.filter((x) => x.hit1).length;
  const hit2Count = judged.filter((x) => x.hit2 && x.hit2.length > 0).length;
  const hit3Count = judged.filter((x) => (x.hit2 && x.hit2.length > 0) || x.hit3).length;
  const hit4Count = judged.filter((x) => (x.hit2 && x.hit2.length > 0) || x.hit3 || x.hit4).length;
  const pending = stock.records.filter((r) => !hasClose(r)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/stocks" className="text-sm text-slate-500 hover:underline">← หุ้นทั้งหมด</Link>
          <h1 className="text-2xl font-semibold">
            {stock.symbol}
            {stock.name && <span className="ml-2 text-base font-normal text-slate-500">{stock.name}</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/digits?stock=${stock.id}`} className="btn-ghost border border-slate-200">วิเคราะห์เลขปิด</Link>
          <Link href={`/predict?stock=${stock.id}`} className="btn-ghost border border-slate-200">คาดการณ์ราคาปิด</Link>
          <form action={deleteStock}>
            <input type="hidden" name="id" value={stock.id} />
            <button type="submit" className="btn-danger">ลบหุ้น</button>
          </form>
        </div>
      </div>

      {/* ผลงานการฟันธง — เทียบกับสุ่มตามจำนวนเลขปิดจริงของแต่ละวัน */}
      {(() => { const sizes = judged.map((j) => j.closeDigits!.length); const rnd1 = randomAtLeastOne(sizes, 1), rnd2 = randomAtLeastOne(sizes, 2), rnd3 = randomAtLeastOne(sizes, 3); return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="ฟันธง 1 ตัว ถูก"
          value={judged.length ? `${hit1Count} / ${judged.length} วัน` : "-"}
          hint={judged.length ? `${Math.round((hit1Count / judged.length) * 100)}% · สุ่มเดา ${Math.round(rnd1 * 100)}% · เพดาน 36%` : "รอผลปิดวันแรก"}
          tone={judged.length ? (hit1Count / judged.length > rnd1 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label="คู่ 2 ตัว โผล่อย่างน้อย 1"
          value={judged.length ? `${hit2Count} / ${judged.length} วัน` : "-"}
          hint={judged.length ? `${Math.round((hit2Count / judged.length) * 100)}% · สุ่มเดา ${Math.round(rnd2 * 100)}% · 10 ปี 63%` : undefined}
          tone={judged.length ? (hit2Count / judged.length > rnd2 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label="รวมตัวสำรอง (3–4 ตัว) โผล่ ≥1"
          value={judged.length ? `${hit3Count} / ${judged.length} วัน` : "-"}
          hint={judged.length ? `${Math.round((hit3Count / judged.length) * 100)}% · สุ่ม ${Math.round(rnd3 * 100)}% · 10 ปี 82% — 4 ตัว ${hit4Count}/${judged.length} (${Math.round((hit4Count / judged.length) * 100)}%, 10 ปี 94%)` : undefined}
          tone={judged.length ? (hit3Count / judged.length > rnd3 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label={`ฟันทิศทาง (เปิดห่าง ≥${CALL_MIN_GAP_PCT}%)`}
          value={calls.called ? `${calls.hits} / ${calls.called} วัน` : "-"}
          hint={calls.called ? `${Math.round((calls.hits / calls.called) * 100)}% · ไม่ฟัน ${calls.skipped} วัน` : "ยังไม่มีวันที่เข้าเกณฑ์"}
          tone={calls.called ? (calls.hits / calls.called >= 0.7 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label="รอผลปิด"
          value={String(pending)}
          hint={pending ? "เติมค่าปิดในตารางด้านล่าง" : "ครบทุกวันแล้ว"}
        />
      </div>
      ); })()}

      {/* min-w-0 บนคอลัมน์ตาราง: ไม่งั้น grid จะยืดตามความกว้างตารางจนล้นหน้า แทนที่จะเลื่อนในกรอบ */}
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="card h-fit">
          <h2 className="font-medium">บันทึกเปิดวันนี้</h2>
          <RecordForm stockId={stock.id} today={todayThai()} />
        </section>

        <section className="card min-w-0 p-0">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="font-medium">ประวัติ + ผลฟันธงรายวัน</h2>
            <p className="text-xs text-slate-500">ฟันจาก D (ทศนิยมปิดวันก่อน) + ทิศทางตามขนาดที่เปิด · เหลือง = เลขที่ฟันแล้วโผล่จริง · เพดานวิธีนี้ ≈ 36%</p>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูล เริ่มบันทึกเปิดได้จากฟอร์มด้านซ้าย</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">วันที่</th>
                    <th className="px-3 py-2">เปิด</th>
                    <th className="px-3 py-2">เลขเปิด</th>
                    <th className="px-3 py-2">ทิศทาง</th>
                    <th className="px-3 py-2 bg-amber-50 text-amber-800">ฟัน 2 ตัว + สำรอง</th>
                    <th className="px-3 py-2">ปิด</th>
                    <th className="px-3 py-2">เลขปิด</th>
                    <th className="px-3 py-2 bg-amber-50 text-amber-800">ผล</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.items.map(({ r, oTop, oBot, pair, third, fourth, hit1, hit2, hit3, hit4 }) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{r.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {fmtNum(r.openValue)}<br /><Change value={r.openChange} className="text-xs" />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><Digits value={oTop} /> <Digits value={oBot} /></td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {(() => { const c = callByDate.get(r.date.getTime()); if (!c || !c.call) return <span className="text-slate-400">ไม่ฟัน</span>;
                          return <span className={`rounded px-1.5 py-0.5 font-medium ${c.hit === true ? "bg-emerald-100 text-emerald-800" : c.hit === false ? "bg-red-100 text-red-800 line-through" : "bg-amber-100 text-amber-800"}`}>{c.call === "up" ? "▲ บวก" : "▼ ลบ"}{c.hit === true ? " ✓" : c.hit === false ? " ✗" : ""}</span>; })()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap bg-amber-50/50">
                        <span className="flex items-center gap-1.5">
                          {pair.map((d) => {
                            const ok = hit2 ? hit2.includes(d) : null;
                            return <span key={d} className={`flex h-9 w-9 items-center justify-center rounded-lg font-mono text-xl font-bold ${ok ? "bg-amber-400 text-white" : ok === false ? "bg-slate-200 text-slate-500 line-through" : "bg-amber-100 text-amber-900"}`}>{d}</span>;
                          })}
                          <span className="mx-0.5 text-amber-300">+</span>
                          {[[third, hit3], [fourth, hit4]].map(([d, ok]) => (
                            <span key={String(d)} className={`ml-1 flex h-7 w-7 items-center justify-center rounded-md border font-mono text-sm font-bold ${ok ? "border-amber-400 bg-amber-200 text-amber-900" : ok === false ? "border-slate-200 text-slate-400 line-through" : "border-amber-200 text-amber-800"}`} title="ตัวสำรอง">{d}</span>
                          ))}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {hasClose(r) ? (<>{fmtNum(r.closeValue)}<br /><Change value={r.closeChange} className="text-xs" /></>) : <CloseForm recordId={r.id} />}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {hasClose(r) ? <><Digits value={top2(r.closeValue)} hilite={hit2 ?? []} tone="blue" /> <Digits value={bottom2(r.closeChange)} hilite={hit2 ?? []} tone="blue" /></> : <span className="text-xs text-slate-400">รอปิด</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap bg-amber-50/50 text-xs">
                        {hit1 === null ? (
                          <span className="text-slate-400">{hasClose(r) ? "–" : "รอผล"}</span>
                        ) : hit2 && hit2.length === 2 ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">✓ ถูกทั้งคู่</span>
                        ) : hit2 && hit2.length ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">✓ ถูก {hit2.join(" ")}{hit3 || hit4 ? ` +สำรอง ${[hit3 ? third : null, hit4 ? fourth : null].filter(Boolean).join(" ")}` : ""}</span>
                        ) : hit3 || hit4 ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">สำรองถูก {[hit3 ? third : null, hit4 ? fourth : null].filter(Boolean).join(" ")}</span>
                        ) : (
                          <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-800">✗ ผิด</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="flex flex-col items-end gap-1">
                          {hasClose(r) && <PatternBadge open={r.openChange} close={r.closeChange} />}
                          <form action={deleteRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="text-xs text-red-600 hover:underline">ลบ</button>
                          </form>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination {...paged} href={(n) => `/stocks/${stock.id}?page=${n}`} />
            </div>
          )}
        </section>
      </div>

      <ImportForm stockId={stock.id} />

      {st.count > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-medium">สถิติราคา เปิด/ปิด (+/−)</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <PatternMatrix summary={st} />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="จำนวนวันที่ปิดแล้ว" value={String(st.count)} hint={`ปิดบวก ${(st.all.closeUpRate * 100).toFixed(0)}%`} />
              <StatCard label="เฉลี่ยเปลี่ยนแปลงตอนปิด" value={fmtChange(st.all.avgCloseChange)} hint={`มัธยฐาน ${fmtChange(st.all.medianCloseChange)}`} tone={st.all.avgCloseChange > 0 ? "up" : st.all.avgCloseChange < 0 ? "down" : "neutral"} />
              <StatCard label="เมื่อเปิด + → ปิดเฉลี่ย" value={st.whenOpenUp.count ? fmtChange(st.whenOpenUp.avgCloseChange) : "-"} hint={st.whenOpenUp.count ? `โอกาสปิดบวก ${(st.whenOpenUp.closeUpRate * 100).toFixed(0)}% (${st.whenOpenUp.count} ครั้ง)` : "ยังไม่มีข้อมูล"} />
              <StatCard label="เมื่อเปิด − → ปิดเฉลี่ย" value={st.whenOpenDown.count ? fmtChange(st.whenOpenDown.avgCloseChange) : "-"} hint={st.whenOpenDown.count ? `โอกาสปิดบวก ${(st.whenOpenDown.closeUpRate * 100).toFixed(0)}% (${st.whenOpenDown.count} ครั้ง)` : "ยังไม่มีข้อมูล"} />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
