import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDayDigits, scoreDigits, backtest, fitModel, top2, bottom2, POSITIONS, positionLabel, type DigitScore } from "@/lib/digits";
import { fmtNum, fmtChange, hasClose } from "@/lib/stats";
import { Digits } from "@/components/digit-badges";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const tier = (p: number) =>
  p >= 0.6 ? { label: "มั่นใจสูง", cls: "bg-emerald-100 text-emerald-800" }
  : p >= 0.45 ? { label: "ปานกลาง", cls: "bg-amber-100 text-amber-800" }
  : { label: "ต่ำ", cls: "bg-slate-100 text-slate-600" };

function BigDigit({ s, rank }: { s: DigitScore; rank: number }) {
  const t = tier(s.p);
  return (
    <div className="card flex flex-col items-center text-center">
      <span className="text-xs text-slate-500">อันดับ {rank}</span>
      <span className="mt-1 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 font-mono text-5xl font-bold text-amber-900">
        {s.digit}
      </span>
      <span className="mt-2 text-2xl font-semibold">{pct(s.p)}</span>
      <span className={`mt-1 rounded px-2 py-0.5 text-xs font-medium ${t.cls}`}>{t.label}</span>
      <ul className="mt-3 space-y-1 text-left text-xs text-slate-600">
        {s.evidence.filter((e) => e.kind !== "base").map((e) => (
          <li key={e.kind} className="flex items-start gap-1">
            <span className="text-amber-500">●</span>
            <span>{e.label} <span className="text-slate-400">→ {pct(e.p)}</span></span>
          </li>
        ))}
        <li className="flex items-start gap-1"><span className="text-slate-300">●</span><span>{s.evidence[0].label}</span></li>
      </ul>
    </div>
  );
}

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
  const last = days[days.length - 1] ?? null;

  const oTop = hasOpen ? top2(openValue) : "";
  const oBot = hasOpen ? bottom2(openChange) : "";
  const ranked = hasOpen && days.length ? scoreDigits(days, oTop, oBot) : null;
  const bt = days.length >= 3 ? backtest(days) : null;
  const model = fitModel(days);
  const posRate = (k: (typeof POSITIONS)[number]) => (model.position[k].n ? model.position[k].hit / model.position[k].n : 0);
  const anyRate = model.anyPosition.n ? model.anyPosition.hit / model.anyPosition.n : 0;
  const top1 = bt?.topK[0];
  const byDigit = ranked ? [...ranked].sort((a, b) => a.digit.localeCompare(b.digit)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">วิเคราะห์เลขปิด</h1>
        <p className="mt-1 text-sm text-slate-500">
          ใส่เลขเปิดวันนี้ → ระบบบอกว่าเลข 0–9 ตัวไหนน่าจะปรากฏตอนปิด (บน 2 ตัว + ล่าง 2 ตัว, ไม่นับหลักร้อย)
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
        <button type="submit" className="btn-primary">วิเคราะห์</button>
      </form>

      {!selected ? (
        <p className="text-sm text-slate-500">ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link></p>
      ) : days.length === 0 ? (
        <p className="card text-sm text-slate-500">
          {selected.symbol} ยังไม่มีสถิติ — <Link href={`/stocks/${selected.id}`} className="text-blue-600 hover:underline">บันทึกข้อมูลก่อน</Link>
        </p>
      ) : (
        <>
          {ranked && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">เลขเปิดวันนี้:</span>
                <span>บน <Digits value={oTop} /></span>
                <span>ล่าง <Digits value={oBot} /></span>
                {last && (
                  <span className="text-slate-500">
                    · ปิดเมื่อวาน ({last.date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}) บน <Digits value={last.closeTop2} /> ล่าง <Digits value={last.closeBottom2} />
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <div className="card flex flex-col items-center justify-center bg-amber-50 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-800">ฟันธง 1 ตัว</p>
                  <span className="mt-2 flex h-28 w-28 items-center justify-center rounded-3xl bg-amber-400 font-mono text-7xl font-bold text-white shadow">
                    {ranked[0].digit}
                  </span>
                  <p className="mt-3 text-sm text-amber-900">โอกาสโผล่ตอนปิด <span className="font-semibold">{pct(ranked[0].p)}</span></p>
                  <p className="mt-1 text-xs text-amber-800">
                    {top1 && bt ? `ฟันธงแบบนี้ย้อนหลังถูก ${pct(top1.atLeastOne)} (${bt.days} วัน)` : "ยังไม่มีข้อมูลพอทดสอบย้อนหลัง"}
                  </p>
                  <p className="mt-2 text-xs text-amber-700">คู่: <span className="font-mono text-base font-semibold">{ranked[0].digit} {ranked[1].digit}</span></p>
                </div>
                <div className="card">
                  <h3 className="text-sm font-medium">พฤติกรรม {selected.symbol}: ตำแหน่งไหนของเลขเปิดที่ "มาปิด"</h3>
                  <p className="text-xs text-slate-500">มีอย่างน้อย 1 ตำแหน่งมาปิด {pct(anyRate)} ของวัน ({model.anyPosition.n} วัน)</p>
                  <div className="mt-3 space-y-2">
                    {POSITIONS.map((k) => {
                      const d = k === "topTens" ? oTop[0] : k === "topUnits" ? oTop[1] : k === "botTens" ? oBot[0] : oBot[1];
                      return (
                        <div key={k} className="flex items-center gap-3 text-sm">
                          <span className="w-28 text-slate-600">{positionLabel[k]}</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-slate-100 font-mono font-semibold">{d}</span>
                          <div className="h-2 flex-1 rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500" style={{ width: pct(posRate(k)) }} /></div>
                          <span className="w-20 text-right tabular-nums">{pct(posRate(k))} <span className="text-xs text-slate-400">({model.position[k].hit}/{model.position[k].n})</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-medium">เลขที่น่าจะปรากฏตอนปิด</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {ranked.slice(0, 3).map((s, i) => <BigDigit key={s.digit} s={s} rank={i + 1} />)}
                </div>
              </div>

              <div className="card">
                <h3 className="text-sm font-medium">ความน่าจะเป็นทั้ง 10 เลข</h3>
                <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {byDigit!.map((s) => {
                    const top = ranked.slice(0, 3).some((x) => x.digit === s.digit);
                    return (
                      <div key={s.digit} className="flex flex-col items-center gap-1">
                        <div className="flex h-24 w-full items-end rounded bg-slate-100">
                          <div className={`w-full rounded ${top ? "bg-amber-400" : "bg-blue-300"}`} style={{ height: pct(s.p) }} />
                        </div>
                        <span className={`font-mono text-lg font-semibold ${top ? "text-amber-700" : ""}`}>{s.digit}</span>
                        <span className="text-xs text-slate-600">{pct(s.p)}</span>
                        <span className="flex gap-0.5 text-[10px]">
                          {s.inOpen && <span className="rounded bg-blue-100 px-1 text-blue-800" title="อยู่ในเลขเปิด">เปิด</span>}
                          {s.inPrevClose && <span className="rounded bg-amber-100 px-1 text-amber-800" title="อยู่ในปิดเมื่อวาน">เด้ง{s.streak > 1 ? s.streak : ""}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {bt && (
            <section className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">ความแม่นยำย้อนหลัง (ทดสอบ {bt.days} วัน)</h2>
                <span className="text-xs text-slate-500">ทายแต่ละวันด้วยข้อมูลก่อนหน้าวันนั้นเท่านั้น · ปิดมีเลขเฉลี่ย {bt.avgCloseSize.toFixed(1)} ตัว</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-4">ถ้าเลือก</th>
                      <th className="py-1 pr-4 text-right">โผล่อย่างน้อย 1 ตัว</th>
                      <th className="py-1 pr-4 text-right">โผล่ครบทุกตัว</th>
                      <th className="py-1 text-right text-slate-400">สุ่มเดา (อย่างน้อย 1)</th>
                    </tr>
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
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-blue-600">ดูรายวัน</summary>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-1 pr-4">วันที่</th><th className="py-1 pr-4">ทาย (3 อันดับ)</th><th className="py-1 pr-4">ปิดจริง</th><th className="py-1">ถูก</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...bt.perDay].reverse().map((d) => (
                      <tr key={d.date.toISOString()}>
                        <td className="py-1.5 pr-4 whitespace-nowrap">{d.date.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</td>
                        <td className="py-1.5 pr-4"><Digits value={d.predicted.join("")} hilite={d.hits} /></td>
                        <td className="py-1.5 pr-4"><Digits value={d.actual.join("")} hilite={d.hits} tone="blue" /></td>
                        <td className="py-1.5 font-medium">{d.hits.length ? `${d.hits.length} ตัว` : <span className="text-slate-400">–</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>
          )}

          <section className="card p-0">
            <h2 className="border-b border-slate-200 px-5 py-3 font-medium">ประวัติเลข ({days.length} วัน) — เหลือง = เด้งจากวันก่อน</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">วันที่</th>
                    <th className="px-4 py-2">เปิด</th>
                    <th className="px-4 py-2">เปิด บน/ล่าง</th>
                    <th className="px-4 py-2">ปิด</th>
                    <th className="px-4 py-2">ปิด บน/ล่าง</th>
                    <th className="px-4 py-2">เอามาปิดจากตำแหน่ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...days].reverse().slice(0, 30).map((d) => {
                    const r = records.find((x) => x.date.getTime() === d.date.getTime())!;
                    return (
                      <tr key={d.date.toISOString()} className="hover:bg-slate-50">
                        <td className="px-4 py-2 whitespace-nowrap">{d.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtNum(r.openValue)} <span className={r.openChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.openChange)}</span></td>
                        <td className="px-4 py-2 whitespace-nowrap"><Digits value={d.openTop2} /> <Digits value={d.openBottom2} /></td>
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtNum(r.closeValue)} <span className={r.closeChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(r.closeChange)}</span></td>
                        <td className="px-4 py-2 whitespace-nowrap"><Digits value={d.closeTop2} hilite={d.bouncedFromPrev} tone="blue" /> <Digits value={d.closeBottom2} hilite={d.bouncedFromPrev} tone="blue" /></td>
                        <td className="px-4 py-2 text-xs">
                          {d.carriedPositions.length ? d.carriedPositions.map((k) => (
                            <span key={k} className="mr-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">{positionLabel[k]}</span>
                          )) : <span className="text-slate-300">–</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-500">* คำนวณจากสถิติที่บันทึกไว้เท่านั้น ยิ่งมีข้อมูลมาก (20+ วัน) ตัวเลข % และความแม่นยำย้อนหลังยิ่งเชื่อถือได้</p>
        </>
      )}
    </div>
  );
}
