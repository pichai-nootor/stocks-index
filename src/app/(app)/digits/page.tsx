import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDayDigits, scoreFromOpen, backtest, fitModel, top2, bottom2, POSITIONS, positionLabel, positionDigits } from "@/lib/digits";
import { fmtNum, fmtChange, hasClose } from "@/lib/stats";
import { Digits } from "@/components/digit-badges";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default async function DigitsPage({ searchParams }: PageProps<"/digits">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stocks = await prisma.stock.findMany({
    where: { userId },
    include: { _count: { select: { records: true } } },
    orderBy: { symbol: "asc" },
  });
  const defaultStock = [...stocks].sort((a, b) => b._count.records - a._count.records)[0];
  const stockId = typeof sp.stock === "string" && stocks.some((s) => s.id === sp.stock) ? sp.stock : defaultStock?.id ?? "";
  const selected = stocks.find((s) => s.id === stockId);
  const openValueRaw = typeof sp.openValue === "string" ? sp.openValue : "";
  const openChangeRaw = typeof sp.openChange === "string" ? sp.openChange : "";
  const openValue = Number(openValueRaw);
  const openChange = Number(openChangeRaw);
  const hasOpen = openValueRaw !== "" && openChangeRaw !== "" && Number.isFinite(openValue) && Number.isFinite(openChange);

  const records = (selected ? await prisma.record.findMany({ where: { stockId: selected.id }, orderBy: { date: "asc" } }) : []).filter(hasClose);
  const days = toDayDigits(records);
  const model = fitModel(days);
  const posRate = (k: (typeof POSITIONS)[number]) => (model.position[k].n ? model.position[k].hit / model.position[k].n : 0);
  const anyRate = model.anyPosition.n ? model.anyPosition.hit / model.anyPosition.n : 0;

  const oTop = hasOpen ? top2(openValue) : "";
  const oBot = hasOpen ? bottom2(openChange) : "";
  const openPos = hasOpen ? positionDigits(oTop, oBot) : null;
  const ranked = hasOpen ? scoreFromOpen(days, oTop, oBot, model) : null;
  const bt = days.length ? backtest(days) : null;
  const top1 = bt?.topK[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">วิเคราะห์เลขปิด — จากเลขเปิด</h1>
        <p className="mt-1 text-sm text-slate-500">
          ใส่เลขเปิดวันนี้ → ระบบดูว่าเลขในตำแหน่ง สิบ/หน่วย ของบนและล่าง ตัวไหนน่าจะถูก "เอามาปิด" (ไม่นับหลักร้อย)
        </p>
      </div>

      <form method="get" className="card grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="stock" className="label">หุ้น / ดัชนี</label>
          <select id="stock" name="stock" className="input" defaultValue={stockId}>
            {stocks.map((s) => <option key={s.id} value={s.id}>{s.symbol}{s.name ? ` — ${s.name}` : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="openValue" className="label">ค่าดัชนีตอนเปิด</label>
          <input id="openValue" name="openValue" type="number" step="any" inputMode="decimal" className="input" defaultValue={openValueRaw} placeholder="74309.16" required />
        </div>
        <div>
          <label htmlFor="openChange" className="label">เปิดวันนี้ เปลี่ยนแปลง (+/−)</label>
          <input id="openChange" name="openChange" type="number" step="any" inputMode="decimal" className="input" defaultValue={openChangeRaw} placeholder="-593.43" required />
        </div>
        <button type="submit" className="btn-primary">ฟันธง</button>
      </form>

      {!selected ? (
        <p className="text-sm text-slate-500">ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link></p>
      ) : (
        <>
          {ranked && openPos && (
            <section className="grid gap-4 md:grid-cols-[1fr_2fr]">
              <div className="card flex flex-col items-center justify-center bg-amber-50 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">ฟันธง</p>
                <span className="mt-2 flex h-28 w-28 items-center justify-center rounded-3xl bg-amber-400 font-mono text-7xl font-bold text-white shadow">{ranked[0].digit}</span>
                <p className="mt-3 text-sm text-amber-900">โอกาสโผล่ตอนปิด <span className="font-semibold">{pct(ranked[0].p)}</span></p>
                {ranked[1] && <p className="mt-1 text-sm text-amber-800">คู่: <span className="font-mono text-xl font-semibold">{ranked[0].digit} {ranked[1].digit}</span></p>}
                <p className="mt-2 text-xs text-amber-700">
                  {top1 && bt ? `ฟันแบบนี้ย้อนหลังถูก ${pct(top1.atLeastOne)} (${bt.days} วัน)` : "ยังไม่มีวันที่ปิดแล้วให้ทดสอบ"}
                </p>
              </div>

              <div className="card">
                <h3 className="text-sm font-medium">เลขเปิดวันนี้ทีละตำแหน่ง — บน <span className="font-mono">{oTop}</span> ล่าง <span className="font-mono">{oBot}</span></h3>
                <p className="text-xs text-slate-500">
                  {model.anyPosition.n
                    ? `ประวัติ ${model.anyPosition.n} วัน: มีอย่างน้อย 1 ตำแหน่งมาปิด ${pct(anyRate)} ของวัน`
                    : "ยังไม่มีประวัติ — ทุกตำแหน่งเริ่มที่ 50%"}
                </p>
                <div className="mt-3 space-y-2">
                  {POSITIONS.map((k) => (
                    <div key={k} className="flex items-center gap-3 text-sm">
                      <span className="w-28 text-slate-600">{positionLabel[k]}</span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-lg font-semibold ${openPos[k] === ranked[0].digit ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-100"}`}>{openPos[k]}</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500" style={{ width: pct(posRate(k)) }} /></div>
                      <span className="w-24 text-right tabular-nums">{pct(posRate(k))} <span className="text-xs text-slate-400">({model.position[k].hit}/{model.position[k].n})</span></span>
                    </div>
                  ))}
                </div>
                <h4 className="mt-4 text-sm font-medium">อันดับเลข</h4>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {ranked.map((s, i) => (
                    <li key={s.digit} className="flex items-center gap-3 py-1.5">
                      <span className="w-6 text-slate-400">{i + 1}</span>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-lg font-bold ${i === 0 ? "bg-amber-400 text-white" : "bg-slate-100"}`}>{s.digit}</span>
                      <span className="w-12 font-semibold tabular-nums">{pct(s.p)}</span>
                      <span className="text-xs text-slate-500">{s.evidence.map((e) => e.label).join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {bt && (
            <section className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">ความแม่นยำย้อนหลัง ({bt.days} วัน)</h2>
                <span className="text-xs text-slate-500">ฟันแต่ละวันจากเลขเปิดวันนั้น · ปิดมีเลขเฉลี่ย {bt.avgCloseSize.toFixed(1)} ตัว</span>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr><th className="py-1 pr-4">ถ้าเลือก</th><th className="py-1 pr-4 text-right">โผล่อย่างน้อย 1 ตัว</th><th className="py-1 pr-4 text-right">โผล่ครบทุกตัว</th><th className="py-1 text-right text-slate-400">สุ่มเดา (อย่างน้อย 1)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bt.topK.map((r) => (
                    <tr key={r.k}>
                      <td className="py-1.5 pr-4">{r.k} เลขอันดับแรก</td>
                      <td className={`py-1.5 pr-4 text-right font-semibold ${r.atLeastOne > r.randomAtLeastOne ? "text-emerald-600" : "text-slate-700"}`}>{pct(r.atLeastOne)}</td>
                      <td className="py-1.5 pr-4 text-right">{pct(r.all)}</td>
                      <td className="py-1.5 text-right text-slate-400">{pct(r.randomAtLeastOne)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-blue-600">ดูรายวัน</summary>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-1 pr-4">วันที่</th><th className="py-1 pr-4">เปิด</th><th className="py-1 pr-4">ฟัน (3 อันดับ)</th><th className="py-1 pr-4">ปิดจริง</th><th className="py-1">ถูก</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...bt.perDay].reverse().map((d) => {
                      const day = days.find((x) => x.date.getTime() === d.date.getTime())!;
                      return (
                        <tr key={d.date.toISOString()}>
                          <td className="py-1.5 pr-4 whitespace-nowrap">{d.date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</td>
                          <td className="py-1.5 pr-4 whitespace-nowrap"><Digits value={day.openTop2} /> <Digits value={day.openBottom2} /></td>
                          <td className="py-1.5 pr-4"><Digits value={d.predicted.join("")} hilite={d.hits} /></td>
                          <td className="py-1.5 pr-4 whitespace-nowrap"><Digits value={day.closeTop2} hilite={d.hits} tone="blue" /> <Digits value={day.closeBottom2} hilite={d.hits} tone="blue" /></td>
                          <td className="py-1.5 font-medium">{d.hits.length ? `${d.hits.length} ตัว` : <span className="text-slate-400">–</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </section>
          )}

          {days.length > 0 && (
            <section className="card p-0">
              <h2 className="border-b border-slate-200 px-5 py-3 font-medium">ประวัติ: ตำแหน่งไหนของเลขเปิดมาปิด ({days.length} วัน)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">วันที่</th>
                      <th className="px-4 py-2">เปิด</th>
                      <th className="px-4 py-2">เลขเปิด</th>
                      <th className="px-4 py-2">ปิด</th>
                      <th className="px-4 py-2">เลขปิด</th>
                      <th className="px-4 py-2">มาปิดจากตำแหน่ง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...days].reverse().slice(0, 30).map((d) => {
                      const r = records.find((x) => x.date.getTime() === d.date.getTime())!;
                      return (
                        <tr key={d.date.toISOString()} className="hover:bg-slate-50">
                          <td className="px-4 py-2 whitespace-nowrap">{d.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtNum(r.openValue)} <span className={r.openChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.openChange)}</span></td>
                          <td className="px-4 py-2 whitespace-nowrap"><Digits value={d.openTop2} hilite={d.fromOpen} /> <Digits value={d.openBottom2} hilite={d.fromOpen} /></td>
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtNum(r.closeValue)} <span className={r.closeChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.closeChange)}</span></td>
                          <td className="px-4 py-2 whitespace-nowrap"><Digits value={d.closeTop2} hilite={d.fromOpen} tone="blue" /> <Digits value={d.closeBottom2} hilite={d.fromOpen} tone="blue" /></td>
                          <td className="px-4 py-2 text-xs">
                            {d.carriedPositions.length ? d.carriedPositions.map((k) => <span key={k} className="mr-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">{positionLabel[k]}</span>) : <span className="text-slate-300">–</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="text-xs text-slate-500">* นับจากสถิติที่บันทึกไว้เท่านั้น ยิ่งมีข้อมูลมาก % ต่อตำแหน่งยิ่งนิ่ง</p>
        </>
      )}
    </div>
  );
}
