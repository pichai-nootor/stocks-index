import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtChange, fmtNum, openPct, closePct } from "@/lib/stats";
import { deleteRecord, deleteStock } from "@/app/actions/stocks";
import { StatCard } from "@/components/stat-card";
import { Change, PatternBadge } from "@/components/change";
import { PatternMatrix } from "@/components/pattern-matrix";
import { RecordForm } from "./record-form";

export default async function StockDetailPage({ params }: PageProps<"/stocks/[id]">) {
  const { id } = await params;
  const { userId } = await requireUser();
  const stock = await prisma.stock.findFirst({
    where: { id, userId },
    include: { records: { orderBy: { date: "desc" } } },
  });
  if (!stock) notFound();

  const st = summarize(stock.records);
  const tone = (x: number): "up" | "down" | "neutral" => (x > 0 ? "up" : x < 0 ? "down" : "neutral");

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
          <Link href={`/predict?stock=${stock.id}`} className="btn-primary">คาดการณ์ราคาปิด</Link>
          <form action={deleteStock}>
            <input type="hidden" name="id" value={stock.id} />
            <button type="submit" className="btn-danger">ลบหุ้น</button>
          </form>
        </div>
      </div>

      {st.count > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <PatternMatrix summary={st} />
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="จำนวนสถิติ" value={String(st.count)} hint={`ปิดบวก ${(st.all.closeUpRate * 100).toFixed(0)}% ของทั้งหมด`} />
            <StatCard
              label="เฉลี่ยเปลี่ยนแปลงตอนปิด"
              value={fmtChange(st.all.avgCloseChange)}
              hint={`มัธยฐาน ${fmtChange(st.all.medianCloseChange)}`}
              tone={tone(st.all.avgCloseChange)}
            />
            <StatCard
              label="เมื่อเปิด + → ปิดเฉลี่ย"
              value={st.whenOpenUp.count ? fmtChange(st.whenOpenUp.avgCloseChange) : "-"}
              hint={st.whenOpenUp.count ? `โอกาสปิดบวก ${(st.whenOpenUp.closeUpRate * 100).toFixed(0)}% (${st.whenOpenUp.count} ครั้ง)` : "ยังไม่มีข้อมูล"}
              tone={tone(st.whenOpenUp.avgCloseChange)}
            />
            <StatCard
              label="เมื่อเปิด − → ปิดเฉลี่ย"
              value={st.whenOpenDown.count ? fmtChange(st.whenOpenDown.avgCloseChange) : "-"}
              hint={st.whenOpenDown.count ? `โอกาสปิดบวก ${(st.whenOpenDown.closeUpRate * 100).toFixed(0)}% (${st.whenOpenDown.count} ครั้ง)` : "ยังไม่มีข้อมูล"}
              tone={tone(st.whenOpenDown.avgCloseChange)}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[340px_1fr]">
        <section className="card h-fit">
          <h2 className="font-medium">บันทึกสถิติ เปิด/ปิด</h2>
          <RecordForm stockId={stock.id} />
        </section>

        <section className="card p-0">
          <h2 className="border-b border-slate-200 px-5 py-3 font-medium">ประวัติ</h2>
          {stock.records.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">ยังไม่มีข้อมูล เริ่มบันทึกได้จากฟอร์มด้านซ้าย</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">วันที่</th>
                    <th className="px-4 py-2 text-right">เปิด</th>
                    <th className="px-4 py-2 text-right">เปลี่ยน</th>
                    <th className="px-4 py-2 text-right">ปิด</th>
                    <th className="px-4 py-2 text-right">เปลี่ยน</th>
                    <th className="px-4 py-2">รูปแบบ</th>
                    <th className="px-4 py-2">หมายเหตุ</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stock.records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {r.date.toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtNum(r.openValue)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap"><Change value={r.openChange} pct={openPct(r)} /></td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtNum(r.closeValue)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap"><Change value={r.closeChange} pct={closePct(r)} /></td>
                      <td className="px-4 py-2 whitespace-nowrap"><PatternBadge open={r.openChange} close={r.closeChange} /></td>
                      <td className="px-4 py-2 text-slate-500">{r.note}</td>
                      <td className="px-4 py-2 text-right">
                        <form action={deleteRecord}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-xs text-red-600 hover:underline">ลบ</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
