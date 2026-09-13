import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { StockForm } from "./stock-form";

export default async function StocksPage() {
  const { userId } = await requireUser();
  const stocks = await prisma.stock.findMany({
    where: { userId },
    include: { _count: { select: { records: true } } },
    orderBy: { symbol: "asc" },
  });

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      <section className="card h-fit">
        <h2 className="font-medium">เพิ่มหุ้น</h2>
        <StockForm />
      </section>

      <section className="card p-0">
        <h2 className="border-b border-slate-200 px-5 py-3 font-medium">รายการหุ้น</h2>
        {stocks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">ยังไม่มีหุ้น</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stocks.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/stocks/${s.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <span className="font-medium">{s.symbol}</span>
                    {s.name && <span className="ml-2 text-sm text-slate-500">{s.name}</span>}
                  </div>
                  <span className="text-sm text-slate-500">{s._count.records} สถิติ →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
