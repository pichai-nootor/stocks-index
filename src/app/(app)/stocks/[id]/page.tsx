import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtPct, fmtNum } from "@/lib/stats";
import { deleteRecord, deleteStock } from "@/app/actions/stocks";
import { StatCard } from "@/components/stat-card";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="จำนวนสถิติ" value={String(st.count)} />
        <StatCard
          label="ปิดบวก / ลบ / เท่า"
          value={`${st.up} / ${st.down} / ${st.flat}`}
          hint={st.count ? `โอกาสปิดบวก ${(st.upRate * 100).toFixed(0)}%` : undefined}
          tone={st.count ? (st.upRate >= 0.5 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label="เฉลี่ย ปิด-เปิด"
          value={st.count ? fmtPct(st.avgPct) : "-"}
          hint={st.count ? `มัธยฐาน ${fmtPct(st.medianPct)} · SD ${(st.stdPct * 100).toFixed(2)}%` : undefined}
          tone={st.avgPct > 0 ? "up" : st.avgPct < 0 ? "down" : "neutral"}
        />
        <StatCard
          label={`เฉลี่ย ${st.recentN} ครั้งล่าสุด`}
          value={st.count ? fmtPct(st.recentAvgPct) : "-"}
          hint={st.count ? `สูงสุด ${fmtPct(st.maxPct)} · ต่ำสุด ${fmtPct(st.minPct)}` : undefined}
          tone={st.recentAvgPct > 0 ? "up" : st.recentAvgPct < 0 ? "down" : "neutral"}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
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
                    <th className="px-4 py-2 text-right">ปิด</th>
                    <th className="px-4 py-2 text-right">เปลี่ยน</th>
                    <th className="px-4 py-2 text-right">%</th>
                    <th className="px-4 py-2">หมายเหตุ</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stock.records.map((r) => {
                    const diff = r.close - r.open;
                    const pct = r.open ? diff / r.open : 0;
                    const color = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-slate-500";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          {r.date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtNum(r.open)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtNum(r.close)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${color}`}>
                          {diff >= 0 ? "+" : ""}{fmtNum(diff)}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${color}`}>{fmtPct(pct)}</td>
                        <td className="px-4 py-2 text-slate-500">{r.note}</td>
                        <td className="px-4 py-2 text-right">
                          <form action={deleteRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="text-xs text-red-600 hover:underline">ลบ</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
