import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtNum, fmtChange } from "@/lib/stats";
import { StatCard } from "@/components/stat-card";
import { Change, PatternBadge } from "@/components/change";

export default async function DashboardPage() {
  const { userId } = await requireUser();
  const stocks = await prisma.stock.findMany({
    where: { userId },
    include: { records: { orderBy: { date: "desc" } } },
    orderBy: { symbol: "asc" },
  });

  const totalRecords = stocks.reduce((n, s) => n + s.records.length, 0);
  const overall = summarize(stocks.flatMap((s) => s.records));
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ภาพรวม</h1>
        <Link href="/predict" className="btn-primary">คาดการณ์ราคาปิด</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="หุ้น / สถิติ" value={`${stocks.length} / ${totalRecords}`} hint="จำนวนหุ้น / จำนวนวันที่บันทึก" />
        <StatCard
          label="ปิดกลับทิศจากเปิด"
          value={totalRecords ? `${Math.round(overall.reversalRate * 100)}%` : "-"}
          hint="เปิด+ปิด− หรือ เปิด−ปิด+"
        />
        <StatCard
          label="เปิด + → ปิด +"
          value={pct(overall.patterns.upUp, overall.whenOpenUp.count)}
          hint={`${overall.patterns.upUp} จาก ${overall.whenOpenUp.count} ครั้ง`}
          tone={overall.whenOpenUp.count ? (overall.whenOpenUp.closeUpRate >= 0.5 ? "up" : "down") : "neutral"}
        />
        <StatCard
          label="เปิด − → ปิด +"
          value={pct(overall.patterns.downUp, overall.whenOpenDown.count)}
          hint={`${overall.patterns.downUp} จาก ${overall.whenOpenDown.count} ครั้ง`}
          tone={overall.whenOpenDown.count ? (overall.whenOpenDown.closeUpRate >= 0.5 ? "up" : "down") : "neutral"}
        />
      </div>

      <section className="card p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-medium">หุ้นของคุณ</h2>
          <Link href="/stocks" className="text-sm text-blue-600 hover:underline">จัดการหุ้น</Link>
        </div>
        {stocks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นแรก</Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-2">หุ้น</th>
                  <th className="px-5 py-2 text-right">สถิติ</th>
                  <th className="px-5 py-2 text-right">เปิด+→ปิด+</th>
                  <th className="px-5 py-2 text-right">เปิด−→ปิด+</th>
                  <th className="px-5 py-2 text-right">ปิดเฉลี่ย</th>
                  <th className="px-5 py-2">ล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.map((s) => {
                  const st = summarize(s.records);
                  const last = s.records[0];
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link href={`/stocks/${s.id}`} className="font-medium text-blue-600 hover:underline">{s.symbol}</Link>
                        {s.name && <span className="ml-2 text-slate-500">{s.name}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right">{st.count}</td>
                      <td className="px-5 py-2.5 text-right">{pct(st.patterns.upUp, st.whenOpenUp.count)}</td>
                      <td className="px-5 py-2.5 text-right">{pct(st.patterns.downUp, st.whenOpenDown.count)}</td>
                      <td className="px-5 py-2.5 text-right">{st.count ? <Change value={st.all.avgCloseChange} /> : "-"}</td>
                      <td className="px-5 py-2.5 whitespace-nowrap text-slate-600">
                        {last ? (
                          <span className="inline-flex items-center gap-2">
                            <PatternBadge open={last.openChange} close={last.closeChange} />
                            <span className="tabular-nums">{fmtNum(last.closeValue)} ({fmtChange(last.closeChange)})</span>
                          </span>
                        ) : "-"}
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
  );
}
