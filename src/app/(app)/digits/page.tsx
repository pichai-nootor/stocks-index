import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toDayDigits, scoreFromOpen, backtest, fitModel, top2, bottom2, POSITIONS, positionLabel, positionDigits, prevCloseCents, exactDigitProbs } from "@/lib/digits";
import { summarize } from "@/lib/stats";
import { TopToBottom } from "./top-to-bottom";
import { fmtNum, fmtChange, hasClose } from "@/lib/stats";
import { Digits } from "@/components/digit-badges";
import { CloseForm } from "@/components/close-form";
import { OpenForm } from "@/components/open-form";

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
  const dateRaw = typeof sp.date === "string" ? sp.date : new Date().toISOString().slice(0, 10);
  const saved = sp.saved === "1";
  const openValueRaw = typeof sp.openValue === "string" ? sp.openValue : "";
  const openChangeRaw = typeof sp.openChange === "string" ? sp.openChange : "";
  const openValue = Number(openValueRaw);
  const openChange = Number(openChangeRaw);
  const hasOpen = openValueRaw !== "" && openChangeRaw !== "" && Number.isFinite(openValue) && Number.isFinite(openChange);

  const allRecords = selected ? await prisma.record.findMany({ where: { stockId: selected.id }, orderBy: { date: "asc" } }) : [];
  const records = allRecords.filter(hasClose);
  const pendingRecords = allRecords.filter((r) => !hasClose(r)).reverse();
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

  // โครงสร้าง + ทิศทาง
  const priceStats = summarize(records);
  const dirGroup = hasOpen ? (openChange > 0 ? priceStats.whenOpenUp : openChange < 0 ? priceStats.whenOpenDown : priceStats.all) : null;
  // โอกาสปิดสูงกว่าเมื่อวาน (smoothing เข้าหา 50% เมื่อข้อมูลน้อย)
  const pUp = dirGroup ? (dirGroup.closeUp + 0.5 * 2) / (dirGroup.count + 2) : 0.5;
  const D = hasOpen ? prevCloseCents(openValue, openChange) : null;
  const exact = D !== null ? exactDigitProbs(D, pUp) : null;
  const prevCloseValue = hasOpen ? openValue - openChange : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">วิเคราะห์เลขปิด — จากเลขเปิด</h1>
        <p className="mt-1 text-sm text-slate-500">
          ใส่เลขเปิดวันนี้ → ระบบดูว่าเลขในตำแหน่ง สิบ/หน่วย ของบนและล่าง ตัวไหนน่าจะถูก "เอามาปิด" (ไม่นับหลักร้อย)
        </p>
      </div>

      <OpenForm stocks={stocks} stockId={stockId} date={dateRaw} openValue={openValueRaw} openChange={openChangeRaw} />
      {saved && <p className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800">✓ บันทึกเลขเปิดวันที่ {new Date(dateRaw).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} แล้ว — ตอนเย็นมาเติมผลปิดด้านล่าง</p>}

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

          {ranked && D !== null && exact && dirGroup && (
            <section className="card space-y-4">
              <div>
                <h2 className="font-medium">โครงสร้างของวันนี้: ทายแค่ "บน" ล่างคำนวณได้</h2>
                <p className="text-xs text-slate-500">
                  ปิดวันก่อน = {fmtNum(prevCloseValue!)} → ทศนิยม <span className="font-mono font-semibold">D = {String(D).padStart(2, "0")}</span>
                  {" "}· 2 ตัวล่าง = (บน − D) ถ้าปิดขึ้น หรือ (D − บน) ถ้าปิดลง (mod 100) — ตรวจแล้วตรง {days.length}/{days.length} วันในประวัติ
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium">ทิศทางวันนี้ (เปิด {openChange > 0 ? "+" : openChange < 0 ? "−" : "0"})</h3>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`text-3xl font-semibold ${pUp >= 0.5 ? "text-emerald-600" : "text-red-600"}`}>{pct(pUp)}</span>
                    <span className="text-sm text-slate-600">โอกาสปิดสูงกว่าเมื่อวาน</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-red-200"><div className="h-full bg-emerald-500" style={{ width: pct(pUp) }} /></div>
                  <p className="mt-1 text-xs text-slate-500">
                    {dirGroup.count
                      ? `จาก ${dirGroup.count} วันที่เปิดแบบเดียวกัน: ปิด+ ${dirGroup.closeUp} · ปิด− ${dirGroup.closeDown}`
                      : "ยังไม่มีวันที่เปิดแบบเดียวกัน → ใช้ 50%"}
                  </p>
                  <TopToBottom D={D} pUp={pUp} />
                </div>

                <div>
                  <h3 className="text-sm font-medium">ความน่าจะเป็นตามคณิตศาสตร์ (D = {String(D).padStart(2, "0")}, ทิศทาง {pct(pUp)})</h3>
                  <p className="text-xs text-slate-500">ไล่ทุกกรณี บน 00–99 → เลขไหนโผล่ใน บน∪ล่าง บ่อยสุด · สุ่มล้วน ≈ 34%</p>
                  <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {[...exact].sort((a, b) => a.digit.localeCompare(b.digit)).map((e) => {
                      const best = exact[0].p, worst = exact[exact.length - 1].p;
                      const hot = e.p >= best - 0.005;
                      return (
                        <div key={e.digit} className="flex flex-col items-center gap-1">
                          <div className="flex h-16 w-full items-end rounded bg-slate-100">
                            <div className={`w-full rounded ${hot ? "bg-emerald-500" : e.p <= worst + 0.005 ? "bg-slate-300" : "bg-blue-300"}`} style={{ height: `${Math.round(((e.p - 0.2) / 0.25) * 100)}%` }} />
                          </div>
                          <span className={`font-mono text-lg font-semibold ${hot ? "text-emerald-700" : ""}`}>{e.digit}</span>
                          <span className="text-xs text-slate-600">{(e.p * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                  {exact[0].p - exact[exact.length - 1].p < 0.01 ? (
                    <p className="mt-2 text-xs text-slate-500">วันนี้ (D = {String(D).padStart(2, "0")}) ทุกเลขมีโอกาสเท่ากัน ~{Math.round(exact[0].p * 100)}% — ไม่มีเลขเด่นตามคณิตศาสตร์</p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      {exact.filter((e) => e.p >= exact[0].p - 0.005).length <= 4
                        ? <>เลขเด่น: <span className="font-mono font-semibold text-emerald-700">{exact.filter((e) => e.p >= exact[0].p - 0.005).map((e) => e.digit).join(" ")}</span> ({(exact[0].p * 100).toFixed(0)}%)</>
                        : <>ส่วนใหญ่ ~{(exact[0].p * 100).toFixed(0)}%</>}
                      {" "}· โอกาสน้อยสุด: <span className="font-mono font-semibold text-red-600">{exact.filter((e) => e.p <= exact[exact.length - 1].p + 0.005).map((e) => e.digit).join(" ")}</span> ({(exact[exact.length - 1].p * 100).toFixed(0)}%)
                      {" "}— ต่างกันแค่ไม่กี่ % บอกไว้ตรง ๆ
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {pendingRecords.length > 0 && (
            <section className="card border-amber-200">
              <h2 className="font-medium">รอผลปิด ({pendingRecords.length})</h2>
              <p className="text-xs text-slate-500">กรอกค่าปิด + เปลี่ยนแปลง แล้วระบบจะตรวจให้ว่าเลขที่ฟันโผล่ไหม</p>
              <div className="mt-3 divide-y divide-slate-100">
                {pendingRecords.map((r) => {
                  const t = top2(r.openValue), b = bottom2(r.openChange);
                  const rk = scoreFromOpen(days.filter((d) => d.date.getTime() < r.date.getTime()), t, b);
                  return (
                    <div key={r.id} className="flex flex-wrap items-center gap-4 py-3 text-sm">
                      <span className="w-20 whitespace-nowrap">{r.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span>
                      <span className="text-slate-600">เปิด {fmtNum(r.openValue)} {fmtChange(r.openChange)}</span>
                      <span><Digits value={t} /> <Digits value={b} /></span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">ฟัน</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 font-mono text-lg font-bold text-white">{rk[0].digit}</span>
                        {rk[1] && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 font-mono text-lg font-bold text-amber-900">{rk[1].digit}</span>}
                      </span>
                      <span className="ml-auto"><CloseForm recordId={r.id} /></span>
                    </div>
                  );
                })}
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
