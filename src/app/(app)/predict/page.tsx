import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { predictClose, fmtNum, fmtChange, signLabel, type Group } from "@/lib/stats";
import { StatCard } from "@/components/stat-card";
import { PatternMatrix } from "@/components/pattern-matrix";

function GroupCard({ title, g, hint }: { title: string; g: Group; hint: string }) {
  if (!g.count) {
    return (
      <div className="card">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      </div>
    );
  }
  const up = Math.round(g.closeUpRate * 100);
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{hint} · {g.count} ครั้ง</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-3xl font-semibold ${up >= 50 ? "text-emerald-600" : "text-red-600"}`}>{up}%</span>
        <span className="text-sm text-slate-500">โอกาสปิดบวก</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-200">
        <div className="h-full bg-emerald-500" style={{ width: `${up}%` }} />
      </div>
      <div className="mt-3 flex justify-between text-xs text-slate-600">
        <span>ปิด+ {g.closeUp}</span>
        <span>ปิด− {g.closeDown}</span>
        {g.closeFlat > 0 && <span>เท่า {g.closeFlat}</span>}
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">ปิดเฉลี่ย</dt><dd className="tabular-nums font-medium">{fmtChange(g.avgCloseChange)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">มัธยฐาน</dt><dd className="tabular-nums">{fmtChange(g.medianCloseChange)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate-500">ระหว่างวัน (ปิด−เปิด)</dt><dd className="tabular-nums">{fmtChange(g.avgIntraday)}</dd></div>
      </dl>
    </div>
  );
}

export default async function PredictPage({ searchParams }: PageProps<"/predict">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stockId = typeof sp.stock === "string" ? sp.stock : "";
  const openChangeRaw = typeof sp.openChange === "string" ? sp.openChange : "";
  const openValueRaw = typeof sp.openValue === "string" ? sp.openValue : "";
  const openChange = Number(openChangeRaw);
  const openValue = openValueRaw ? Number(openValueRaw) : null;

  const stocks = await prisma.stock.findMany({ where: { userId }, orderBy: { symbol: "asc" } });
  const selected = stockId ? stocks.find((s) => s.id === stockId) : undefined;
  const records = selected
    ? await prisma.record.findMany({ where: { stockId: selected.id }, orderBy: { date: "asc" } })
    : [];
  const ready = selected && openChangeRaw !== "" && Number.isFinite(openChange) && (openValue === null || openValue > 0);
  const p = ready ? predictClose(records, openChange, openValue) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">คาดการณ์ราคาปิด</h1>

      <form method="get" className="card grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="stock" className="label">หุ้น / ดัชนี</label>
          <select id="stock" name="stock" className="input" defaultValue={stockId} required>
            <option value="" disabled>เลือกหุ้น</option>
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>{s.symbol}{s.name ? ` — ${s.name}` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="openChange" className="label">เปิดวันนี้ เปลี่ยนแปลง (+/−)</label>
          <input id="openChange" name="openChange" type="number" step="any" inputMode="decimal" className="input" defaultValue={openChangeRaw} placeholder="-120.83" required />
        </div>
        <div>
          <label htmlFor="openValue" className="label">ค่าดัชนีตอนเปิด (ไม่บังคับ)</label>
          <input id="openValue" name="openValue" type="number" step="any" inputMode="decimal" className="input" defaultValue={openValueRaw} placeholder="74781.76" />
        </div>
        <button type="submit" className="btn-primary">คำนวณ</button>
      </form>

      {stocks.length === 0 && (
        <p className="text-sm text-slate-500">
          ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link>
        </p>
      )}

      {p && selected && (
        p.summary.count === 0 ? (
          <p className="card text-sm text-slate-500">
            {selected.symbol} ยังไม่มีสถิติ —{" "}
            <Link href={`/stocks/${selected.id}`} className="text-blue-600 hover:underline">บันทึกข้อมูลก่อน</Link>
          </p>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">
                {selected.symbol} · วันนี้เปิด{" "}
                <span className={p.openChange > 0 ? "text-emerald-600" : p.openChange < 0 ? "text-red-600" : ""}>
                  {signLabel[p.openSign]} {fmtChange(p.openChange)}
                </span>
                {p.prevClose !== null && <span className="text-slate-500"> · ปิดวันก่อน {fmtNum(p.prevClose)}</span>}
                <span className="text-slate-500"> · สถิติ {p.summary.count} ครั้ง</span>
              </h2>
              <Link href={`/stocks/${selected.id}`} className="text-sm text-blue-600 hover:underline">ดูประวัติ</Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <GroupCard title={`ทุกครั้งที่เปิด ${signLabel[p.openSign]}`} g={p.sameSign} hint="ประวัติทั้งหมดที่เปิดเครื่องหมายเดียวกัน" />
              <GroupCard
                title={`เปิด ${signLabel[p.openSign]} ขนาดใกล้เคียง`}
                g={p.similar}
                hint={`เปิดอยู่ในช่วง ±${Math.round(p.similarTolerance * 100)}% ของ ${fmtNum(Math.abs(p.openChange))} จุด`}
              />
              <GroupCard title={`เปิด ${signLabel[p.openSign]} ${p.recentN} ครั้งล่าสุด`} g={p.recent} hint="แนวโน้มช่วงหลัง" />
            </div>

            {p.predictedClose && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="ค่าปิดคาดการณ์ (เฉลี่ย)" value={fmtNum(p.predictedClose.byAvg)} hint={`ปิดวันก่อน ${fmtChange(p.sameSign.avgCloseChange)}`} tone={p.sameSign.avgCloseChange > 0 ? "up" : "down"} />
                <StatCard label="ค่าปิดคาดการณ์ (มัธยฐาน)" value={fmtNum(p.predictedClose.byMedian)} hint={`ปิดวันก่อน ${fmtChange(p.sameSign.medianCloseChange)}`} tone={p.sameSign.medianCloseChange > 0 ? "up" : "down"} />
                <StatCard
                  label="ค่าปิดคาดการณ์ (ขนาดใกล้เคียง)"
                  value={p.predictedClose.bySimilar === null ? "-" : fmtNum(p.predictedClose.bySimilar)}
                  hint={p.similar.count ? `จาก ${p.similar.count} ครั้ง` : "ไม่มีครั้งที่ใกล้เคียง"}
                  tone={p.similar.count ? (p.similar.avgCloseChange > 0 ? "up" : "down") : "neutral"}
                />
                <StatCard label="ช่วงคาดการณ์ (±1 SD)" value={`${fmtNum(p.predictedClose.low)} – ${fmtNum(p.predictedClose.high)}`} hint={`SD ${fmtNum(p.sameSign.stdCloseChange)} จุด`} />
              </div>
            )}

            <PatternMatrix summary={p.summary} />

            <p className="text-xs text-slate-500">
              * คำนวณจากสถิติที่บันทึกไว้เท่านั้น ไม่ใช่คำแนะนำการลงทุน — ยิ่งมีข้อมูลมาก ค่าคาดการณ์ยิ่งน่าเชื่อถือ
            </p>
          </section>
        )
      )}
    </div>
  );
}
