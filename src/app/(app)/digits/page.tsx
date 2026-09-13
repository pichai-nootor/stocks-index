import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { analyzeDigits, type DigitStat } from "@/lib/digits";
import { fmtNum, fmtChange } from "@/lib/stats";
import { Digits } from "@/components/digit-badges";

const WINDOWS = [5, 10, 20, 30, 60];

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function HotCard({ title, stats, hint }: { title: string; stats: DigitStat[]; hint: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex items-end gap-3">
        {stats.map((s) => (
          <div key={s.digit} className="flex flex-col items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100 font-mono text-4xl font-bold text-amber-900">
              {s.digit}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              {s.streak > 0 ? `เด้ง ${s.streak} วัน` : `เว้น ${s.gap} วัน`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export default async function DigitsPage({ searchParams }: PageProps<"/digits">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stocks = await prisma.stock.findMany({ where: { userId }, orderBy: { symbol: "asc" } });
  const stockId = typeof sp.stock === "string" && stocks.some((s) => s.id === sp.stock) ? sp.stock : stocks[0]?.id ?? "";
  const window = WINDOWS.includes(Number(sp.n)) ? Number(sp.n) : 10;
  const selected = stocks.find((s) => s.id === stockId);

  const records = selected
    ? await prisma.record.findMany({ where: { stockId: selected.id }, orderBy: { date: "asc" } })
    : [];
  const a = analyzeDigits(records, window);
  const maxDays = Math.max(1, ...a.stats.map((s) => s.days));
  const recentDays = [...a.days].reverse().slice(0, window);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">วิเคราะห์เลข</h1>
        <p className="mt-1 text-sm text-slate-500">
          3 ตัวบน = หลักหน่วย + ทศนิยมของค่าดัชนีตอนปิด · 2 ตัวล่าง = ทศนิยมของค่าเปลี่ยนแปลงตอนปิด · เลขสีเหลือง = เด้ง (ซ้ำจากวันก่อน)
        </p>
      </div>

      <form method="get" className="card flex flex-wrap items-end gap-4">
        <div className="min-w-48">
          <label htmlFor="stock" className="label">หุ้น / ดัชนี</label>
          <select id="stock" name="stock" className="input" defaultValue={stockId}>
            {stocks.map((s) => (
              <option key={s.id} value={s.id}>{s.symbol}{s.name ? ` — ${s.name}` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="n" className="label">ดูย้อนหลัง</label>
          <select id="n" name="n" className="input" defaultValue={String(window)}>
            {WINDOWS.map((n) => <option key={n} value={n}>{n} วันล่าสุด</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">ดู</button>
      </form>

      {!selected ? (
        <p className="text-sm text-slate-500">ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link></p>
      ) : a.days.length === 0 ? (
        <p className="card text-sm text-slate-500">
          {selected.symbol} ยังไม่มีสถิติ — <Link href={`/stocks/${selected.id}`} className="text-blue-600 hover:underline">บันทึกข้อมูลก่อน</Link>
        </p>
      ) : (
        <>
          {/* เลขเด่น */}
          <div className="grid gap-4 md:grid-cols-3">
            {a.hot1 && (
              <HotCard
                title="เลขเด่น 1 ตัว"
                stats={[a.hot1]}
                hint={`โผล่ ${a.hot1.days}/${a.window} วันล่าสุด · โผล่แล้วมักซ้ำวันถัดไป ${pct(a.hot1.repeatRate)}`}
              />
            )}
            <HotCard
              title="เลขเด่น 2 ตัว"
              stats={a.hot2}
              hint="จัดอันดับจาก ความถี่ช่วงหลัง + เด้งติดกัน + แนวโน้มซ้ำวันถัดไป"
            />
            <div className="card space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">พฤติกรรมของ {selected.symbol}</p>
              <div>
                <div className="flex justify-between text-sm"><span>มีเลขเด้งจากวันก่อน</span><span className="font-semibold">{pct(a.bounceDayRate)} ของวัน</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-amber-400" style={{ width: pct(a.bounceDayRate) }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-sm"><span>เลขตอนเปิดโผล่ที่ปิด</span><span className="font-semibold">{pct(a.fromOpenDayRate)} ของวัน</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-400" style={{ width: pct(a.fromOpenDayRate) }} /></div>
              </div>
              {a.lastClose && (
                <p className="text-xs text-slate-500">
                  ปิดล่าสุด {a.lastClose.date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}: บน {a.lastClose.closeTop3} ล่าง {a.lastClose.closeBottom2}
                  {" "}→ เลขที่อาจเด้งพรุ่งนี้: {a.lastClose.closeDigits.join(" ")}
                </p>
              )}
            </div>
          </div>

          {/* ความถี่ 0–9 */}
          <section className="card">
            <h2 className="font-medium">ความถี่เลข 0–9 ใน {a.window} วันล่าสุด</h2>
            <div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-10">
              {[...a.stats].sort((x, y) => x.digit.localeCompare(y.digit)).map((s) => {
                const h = Math.round((s.days / maxDays) * 100);
                const hot = a.hot2.some((d) => d.digit === s.digit);
                return (
                  <div key={s.digit} className="flex flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end rounded bg-slate-100">
                      <div className={`w-full rounded ${hot ? "bg-amber-400" : "bg-blue-400"}`} style={{ height: `${h}%` }} title={`${s.days} วัน`} />
                    </div>
                    <span className={`font-mono text-lg font-semibold ${hot ? "text-amber-700" : ""}`}>{s.digit}</span>
                    <span className="text-xs text-slate-500">{s.days} วัน</span>
                    <span className="text-[10px] text-slate-400">บน {s.inTop} · ล่าง {s.inBottom}</span>
                    {s.streak > 1 && <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">เด้ง {s.streak}</span>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ตารางรายวัน */}
          <section className="card p-0">
            <h2 className="border-b border-slate-200 px-5 py-3 font-medium">ผลรายวัน ({recentDays.length} วันล่าสุด)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">วันที่</th>
                    <th className="px-4 py-2">เปิด</th>
                    <th className="px-4 py-2">เปิด บน / ล่าง</th>
                    <th className="px-4 py-2">ปิด</th>
                    <th className="px-4 py-2">ปิด 3 ตัวบน</th>
                    <th className="px-4 py-2">ปิด 2 ตัวล่าง</th>
                    <th className="px-4 py-2">เด้ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentDays.map((d, i) => {
                    const r = records.find((x) => x.date.getTime() === d.date.getTime())!;
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 whitespace-nowrap">{d.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtNum(r.openValue)} <span className={r.openChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.openChange)}</span></td>
                        <td className="px-4 py-2 whitespace-nowrap"><Digits value={d.openTop3} /> <span className="text-slate-300">/</span> <Digits value={d.openBottom2} /></td>
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtNum(r.closeValue)} <span className={r.closeChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.closeChange)}</span></td>
                        <td className="px-4 py-2"><Digits value={d.closeTop3} hilite={d.bouncedFromPrev} tone="blue" /></td>
                        <td className="px-4 py-2"><Digits value={d.closeBottom2} hilite={d.bouncedFromPrev} tone="blue" /></td>
                        <td className="px-4 py-2 text-xs">
                          {d.bouncedFromPrev.length > 0 && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                              {d.bouncedFromPrev.join(" ")} เด้ง
                            </span>
                          )}
                          {d.fromOpen.length > 0 && (
                            <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">จากเปิด {d.fromOpen.join(" ")}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-500">* เป็นการนับความถี่จากสถิติที่บันทึกไว้เท่านั้น ไม่ได้รับประกันผล</p>
        </>
      )}
    </div>
  );
}
