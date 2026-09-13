import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { predictClose, fmtNum, fmtPct } from "@/lib/stats";
import { StatCard } from "@/components/stat-card";

export default async function PredictPage({ searchParams }: PageProps<"/predict">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stockId = typeof sp.stock === "string" ? sp.stock : "";
  const openRaw = typeof sp.open === "string" ? sp.open : "";
  const open = Number(openRaw);

  const stocks = await prisma.stock.findMany({ where: { userId }, orderBy: { symbol: "asc" } });
  const selected = stockId ? stocks.find((s) => s.id === stockId) : undefined;
  const records = selected
    ? await prisma.record.findMany({ where: { stockId: selected.id }, orderBy: { date: "asc" } })
    : [];
  const prediction = selected && openRaw && open > 0 ? predictClose(records, open) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">คาดการณ์ราคาปิด</h1>

      <form method="get" className="card grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="stock" className="label">หุ้น</label>
          <select id="stock" name="stock" className="input" defaultValue={stockId} required>
            <option value="" disabled>เลือกหุ้น</option>
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>{s.symbol}{s.name ? ` — ${s.name}` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="open" className="label">ราคาเปิดวันนี้</label>
          <input
            id="open"
            name="open"
            type="number"
            step="any"
            inputMode="decimal"
            className="input"
            defaultValue={openRaw}
            placeholder="เช่น 35.50"
            required
          />
        </div>
        <button type="submit" className="btn-primary">คำนวณ</button>
      </form>

      {stocks.length === 0 && (
        <p className="text-sm text-slate-500">
          ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link>
        </p>
      )}

      {prediction && selected && (
        prediction.count === 0 ? (
          <p className="card text-sm text-slate-500">
            {selected.symbol} ยังไม่มีสถิติ —{" "}
            <Link href={`/stocks/${selected.id}`} className="text-blue-600 hover:underline">บันทึกข้อมูลก่อน</Link>
          </p>
        ) : (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">
                {selected.symbol} · เปิด {fmtNum(prediction.open)} · อิงสถิติ {prediction.count} ครั้ง
              </h2>
              <Link href={`/stocks/${selected.id}`} className="text-sm text-blue-600 hover:underline">ดูประวัติ</Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="คาดการณ์ (ค่าเฉลี่ย)"
                value={fmtNum(prediction.byAvg)}
                hint={`เฉลี่ยเปลี่ยน ${fmtPct(prediction.summary.avgPct)}`}
                tone={prediction.byAvg > prediction.open ? "up" : prediction.byAvg < prediction.open ? "down" : "neutral"}
              />
              <StatCard
                label="คาดการณ์ (มัธยฐาน)"
                value={fmtNum(prediction.byMedian)}
                hint={`มัธยฐาน ${fmtPct(prediction.summary.medianPct)} · ทนค่าผิดปกติ`}
                tone={prediction.byMedian > prediction.open ? "up" : prediction.byMedian < prediction.open ? "down" : "neutral"}
              />
              <StatCard
                label={`คาดการณ์ (${prediction.summary.recentN} ครั้งล่าสุด)`}
                value={fmtNum(prediction.byRecent)}
                hint={`แนวโน้มล่าสุด ${fmtPct(prediction.summary.recentAvgPct)}`}
                tone={prediction.byRecent > prediction.open ? "up" : prediction.byRecent < prediction.open ? "down" : "neutral"}
              />
              <StatCard
                label="คาดการณ์ (ราคาเปิดใกล้เคียง ±3%)"
                value={prediction.bySimilar === null ? "-" : fmtNum(prediction.bySimilar)}
                hint={
                  prediction.similarCount
                    ? `จาก ${prediction.similarCount} ครั้งที่เปิดใกล้เคียง`
                    : "ไม่มีครั้งที่ราคาเปิดใกล้เคียง"
                }
                tone={
                  prediction.bySimilar === null
                    ? "neutral"
                    : prediction.bySimilar > prediction.open ? "up" : "down"
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="ช่วงคาดการณ์ (±1 SD)"
                value={`${fmtNum(prediction.low)} – ${fmtNum(prediction.high)}`}
                hint={`ความผันผวน SD ${(prediction.summary.stdPct * 100).toFixed(2)}%`}
              />
              <StatCard
                label="โอกาสปิดบวก"
                value={`${(prediction.upRate * 100).toFixed(0)}%`}
                hint={`บวก ${prediction.summary.up} · ลบ ${prediction.summary.down} · เท่า ${prediction.summary.flat}`}
                tone={prediction.upRate >= 0.5 ? "up" : "down"}
              />
            </div>

            <p className="text-xs text-slate-500">
              * เป็นการคำนวณจากสถิติที่บันทึกไว้เท่านั้น ไม่ใช่คำแนะนำการลงทุน — ยิ่งมีข้อมูลมาก ค่าคาดการณ์ยิ่งน่าเชื่อถือ
            </p>
          </section>
        )
      )}
    </div>
  );
}
