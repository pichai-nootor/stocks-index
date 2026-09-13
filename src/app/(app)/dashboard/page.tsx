import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { summarize, fmtPct, fmtNum } from "@/lib/stats";
import { StatCard } from "@/components/stat-card";

export default async function DashboardPage() {
  const { userId } = await requireUser();
  const stocks = await prisma.stock.findMany({
    where: { userId },
    include: { records: { orderBy: { date: "desc" } } },
    orderBy: { symbol: "asc" },
  });

  const totalRecords = stocks.reduce((n, s) => n + s.records.length, 0);
  const allRecords = stocks.flatMap((s) => s.records);
  const overall = summarize(allRecords);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ภาพรวม</h1>
        <Link href="/predict" className="btn-primary">คาดการณ์ราคาปิด</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="จำนวนหุ้น" value={String(stocks.length)} />
        <StatCard label="สถิติที่บันทึก" value={String(totalRecords)} hint="รวมทุกหุ้น" />
        <StatCard
          label="สัดส่วนปิดบวก (รวม)"
          value={totalRecords ? `${(overall.upRate * 100).toFixed(0)}%` : "-"}
          tone={overall.upRate >= 0.5 ? "up" : "down"}
          hint={totalRecords ? `เฉลี่ย ${fmtPct(overall.avgPct)} ต่อรอบ` : undefined}
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
                  <th className="px-5 py-2 text-right">จำนวนสถิติ</th>
                  <th className="px-5 py-2 text-right">ปิดบวก</th>
                  <th className="px-5 py-2 text-right">เฉลี่ย %</th>
                  <th className="px-5 py-2 text-right">ล่าสุด (เปิด → ปิด)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocks.map((s) => {
                  const st = summarize(s.records);
                  const last = s.records[0];
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link href={`/stocks/${s.id}`} className="font-medium text-blue-600 hover:underline">
                          {s.symbol}
                        </Link>
                        {s.name && <span className="ml-2 text-slate-500">{s.name}</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right">{st.count}</td>
                      <td className="px-5 py-2.5 text-right">
                        {st.count ? `${(st.upRate * 100).toFixed(0)}%` : "-"}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right ${
                          st.avgPct > 0 ? "text-emerald-600" : st.avgPct < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {st.count ? fmtPct(st.avgPct) : "-"}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-600">
                        {last ? `${fmtNum(last.open)} → ${fmtNum(last.close)}` : "-"}
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
