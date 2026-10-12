import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { pickTwoFor } from "@/lib/formulas/stocks";
import { toDayDigits, scoreFromOpen, pickDigits, pickPair, pairProbs, PAIR_BASE, DRILL_BASE, DRILL_PER_DIGIT, backtestPicks, fitModel, top2, bottom2, POSITIONS, positionLabel, positionDigits, prevCloseCents, exactDigitProbs } from "@/lib/digits";
import { summarize, forecastDirection, checkOpen } from "@/lib/stats";
import { OpenWarning } from "@/components/open-warning";
import { todayThai } from "@/lib/intraday";
import { SHOW_DIRECTION } from "@/lib/config";
import { DirectionCard } from "@/components/direction-card";
import { TwoPickCard } from "@/components/two-pick";
import { TopToBottom } from "./top-to-bottom";
import { fmtNum, fmtChange, hasClose } from "@/lib/stats";
import { Digits } from "@/components/digit-badges";
import { CloseForm } from "@/components/close-form";
import { OpenForm } from "@/components/open-form";
import { Pagination, paginate } from "@/components/pagination";

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
  const dateRaw = typeof sp.date === "string" ? sp.date : todayThai();
  const page = Number(sp.page) || 1;
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
  const ranked = hasOpen ? pickDigits(openValue, openChange, records) : null;
  const pp = hasOpen ? pickPair(openValue, openChange, records) : null;
  const two = hasOpen ? pickTwoFor(selected?.symbol ?? "", openValue, openChange, records) : null;
  const posRanked = hasOpen ? scoreFromOpen(days, oTop, oBot, model) : null;
  const bt = records.length ? backtestPicks(records) : null;
  const top1 = bt?.topK[0];

  // โครงสร้าง + ทิศทาง
  const priceStats = summarize(records);
  const dirGroup = hasOpen ? (openChange > 0 ? priceStats.whenOpenUp : openChange < 0 ? priceStats.whenOpenDown : priceStats.all) : null;
  const df = hasOpen ? forecastDirection(openValue, openChange, records) : null;
  const pUp = df ? df.pUp : 0.5;
  const D = hasOpen ? prevCloseCents(openValue, openChange) : null;
  const exact = D !== null ? exactDigitProbs(D, pUp) : null;
  const prevCloseValue = hasOpen ? openValue - openChange : null;
  const check = hasOpen ? checkOpen(records, new Date(dateRaw), openValue, openChange) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">วิเคราะห์เลขปิด — จากเลขเปิด</h1>
        <p className="mt-1 text-sm text-slate-500">
          ใส่เลขเปิดวันนี้ → ระบบดูว่าเลขในตำแหน่ง สิบ/หน่วย ของบนและล่าง ตัวไหนน่าจะถูก “เอามาปิด” (ไม่นับหลักร้อย)
        </p>
      </div>

      <OpenForm stocks={stocks} stockId={stockId} date={dateRaw} openValue={openValueRaw} openChange={openChangeRaw} />
      {check?.mismatch && <OpenWarning check={check} fixHref={`/digits?stock=${stockId}&date=${dateRaw}&openValue=${openValueRaw}&openChange=${check.suggestedOpenChange}`} />}
      {saved && <p className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800">✓ บันทึกเลขเปิดวันที่ {new Date(dateRaw).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} แล้ว — ตอนเย็นมาเติมผลปิดด้านล่าง</p>}

      {!selected ? (
        <p className="text-sm text-slate-500">ยังไม่มีหุ้น — <Link href="/stocks" className="text-blue-600 hover:underline">เพิ่มหุ้นก่อน</Link></p>
      ) : (
        <>
          {ranked && openPos && two && (
            <section className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="card bg-amber-50/60">
                <TwoPickCard two={two} tied={pp ?? undefined} open={{ top: top2(openValue), bottom: bottom2(openChange) }} score={bt ? { days: bt.days, pair: bt.pair, tied: bt.tied, single: top1?.atLeastOne, drill: bt.drill } : undefined} />
                <p className="mt-3 text-xs text-amber-700">
                  {top1 && bt ? `เลขเดี่ยวตัวหลักย้อนหลังถูก ${pct(top1.atLeastOne)} (${bt.days} วัน) · 10 ปี ≈ 36%` : "ยังไม่มีวันที่ปิดแล้วให้ทดสอบ"}
                  {" "}· ทุกตำแหน่งเริ่มที่ ~10% เพราะ “บน” สุ่ม — จะเอียงไปหลักสิบ/หน่วยเฉพาะวันที่ D ลงท้าย 0 หรือ 9
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
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-lg font-semibold ${two.digits.some((d) => d.digit === openPos[k]) ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-200 bg-slate-100"}`}>{openPos[k]}</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500" style={{ width: pct(posRate(k)) }} /></div>
                      <span className="w-24 text-right tabular-nums">{pct(posRate(k))} <span className="text-xs text-slate-400">({model.position[k].hit}/{model.position[k].n})</span></span>
                    </div>
                  ))}
                </div>
                <h4 className="mt-4 text-sm font-medium">อันดับเลขตามตำแหน่งเปิด (วิธีเดิม — วัดแล้ว ≈ 33%)</h4>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {posRanked!.map((s, i) => (
                    <li key={s.digit} className="flex items-center gap-3 py-1.5">
                      <span className="w-6 text-slate-400">{i + 1}</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-mono text-lg font-bold">{s.digit}</span>
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
                <h2 className="font-medium">โครงสร้างของวันนี้: ทายแค่ “บน” ล่างคำนวณได้</h2>
                <p className="text-xs text-slate-500">
                  ปิดวันก่อน = {fmtNum(prevCloseValue!)} → ทศนิยม <span className="font-mono font-semibold">D = {String(D).padStart(2, "0")}</span>
                  {" "}· 2 ตัวล่าง = (บน − D) ถ้าปิดขึ้น หรือ (D − บน) ถ้าปิดลง (mod 100) — ตรวจแล้วตรง {days.length}/{days.length} วันในประวัติ
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  {SHOW_DIRECTION && <DirectionCard f={df!} compact />}
                  <p className="mt-2 text-xs text-slate-500">
                    {dirGroup.count
                      ? `ของคุณ ${dirGroup.count} วันที่เปิดแบบเดียวกัน: ปิด+ ${dirGroup.closeUp} · ปิด− ${dirGroup.closeDown}`
                      : "ยังไม่มีวันที่เปิดแบบเดียวกันในข้อมูลของคุณ"}
                  </p>
                  <TopToBottom D={D} pUp={pUp} />
                  <h3 className="mt-4 text-sm font-medium">คู่ที่มาด้วยกันบ่อยสุด (D = {String(D).padStart(2, "0")}, ทิศทาง {pct(pUp)})</h3>
                  <p className="text-xs text-slate-500">ล่าง = บน ∓ D ทำให้บางคู่ผูกกัน — เลือกคู่จากการไล่ 200 กรณี ไม่ใช่เอา 2 เลขเดี่ยวอันดับแรกมาจับคู่ (ได้แค่ 11%)</p>
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {pairProbs(D, pUp).slice(0, 5).map((q, i) => (
                      <li key={q.pair.join("")} className="flex items-center gap-3 py-1.5">
                        <span className="w-5 text-slate-400">{i + 1}</span>
                        <span className={`rounded-lg px-2 py-0.5 font-mono text-lg font-bold ${i === 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100"}`}>{q.pair.join(" ")}</span>
                        <span className="w-28 tabular-nums">มาทั้งคู่ <span className="font-semibold">{(q.pBoth * 100).toFixed(1)}%</span></span>
                        <span className="text-xs text-slate-500">อย่างน้อย 1 ตัว {pct(q.pAny)}</span>
                      </li>
                    ))}
                  </ul>
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
                  const before = records.filter((d) => d.date.getTime() < r.date.getTime());
                  const tw = pickTwoFor(selected?.symbol ?? "", r.openValue, r.openChange, before), pr = pickPair(r.openValue, r.openChange, before);
                  return (
                    <div key={r.id} className="flex flex-wrap items-center gap-4 py-3 text-sm">
                      <span className="w-20 whitespace-nowrap">{r.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span>
                      <span className="text-slate-600">เปิด {fmtNum(r.openValue)} {fmtChange(r.openChange)}</span>
                      <span><Digits value={t} /> <Digits value={b} /></span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">ฟัน</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 font-mono text-lg font-bold text-white">{tw.digits[0].digit}</span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200 font-mono text-lg font-bold text-amber-900">{tw.digits[1].digit}</span>
                        <span className="ml-2 text-xs text-slate-500">คู่ผูก</span>
                        <span className="flex h-8 items-center justify-center rounded-lg bg-amber-100 px-2 font-mono text-lg font-bold text-amber-900">{pr.pair.join(" ")}</span>
                        <span className="text-xs text-slate-500">{pct(pr.pBoth)}</span>
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
                <span className="text-xs text-slate-500">ฟันแต่ละวันจาก D + ทิศทาง (ใช้ข้อมูลก่อนหน้าวันนั้น) · ปิดมีเลขเฉลี่ย {bt.avgCloseSize.toFixed(1)} ตัว · ฟันแบบนี้บน 10 ปี: ตัวหลัก 36% · 2 ตัว ≥1 63%</span>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr><th className="py-1 pr-4">ถ้าเลือก</th><th className="py-1 pr-4 text-right">โผล่อย่างน้อย 1 ตัว</th><th className="py-1 pr-4 text-right">โผล่ครบทุกตัว</th><th className="py-1 text-right text-slate-400">สุ่มเดา (อย่างน้อย 1)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bt.topK.map((r) => (
                    <tr key={r.k}>
                      <td className="py-1.5 pr-4">{r.k === 1 ? "ตัวหลัก (ตัวที่หยิบ)" : r.k === 2 ? "ฟัน 2 ตัว" : "3 เลขอันดับแรก (อ้างอิง)"}</td>
                      <td className={`py-1.5 pr-4 text-right font-semibold ${r.atLeastOne > r.randomAtLeastOne ? "text-emerald-600" : "text-slate-700"}`}>{pct(r.atLeastOne)}</td>
                      <td className="py-1.5 pr-4 text-right">{pct(r.all)}</td>
                      <td className="py-1.5 text-right text-slate-400">{pct(r.randomAtLeastOne)}</td>
                    </tr>
                  ))}
                  {bt.fairTop1 !== undefined && (
                    <tr className="text-slate-600">
                      <td className="py-1.5 pr-4">ตัวหลัก (วัดทั้งกลุ่มที่เสมอ) <span className="text-xs text-slate-400">— เสมอกัน {bt.tieDays} วัน นับสัดส่วนกลุ่มที่โผล่ ไม่ขึ้นกับว่าหยิบตัวไหน</span></td>
                      <td className="py-1.5 pr-4 text-right font-semibold">{pct(bt.fairTop1)}</td>
                      <td className="py-1.5 pr-4 text-right">–</td>
                      <td className="py-1.5 text-right text-slate-400">10 ปี 36%</td>
                    </tr>
                  )}
                  {bt.tied && (
                    <tr className="bg-amber-50/50">
                      <td className="py-1.5 pr-4">คู่ผูก (เลือกคู่ที่มาด้วยกันบ่อยสุด)</td>
                      <td className="py-1.5 pr-4 text-right">{pct(bt.tied.any)}</td>
                      <td className={`py-1.5 pr-4 text-right font-semibold ${bt.tied.both > PAIR_BASE.bothRandom ? "text-emerald-600" : "text-slate-700"}`}>{pct(bt.tied.both)} <span className="text-xs font-normal text-slate-400">(10 ปี {pct(PAIR_BASE.both10y)})</span></td>
                      <td className="py-1.5 text-right text-slate-400">ครบคู่ {pct(PAIR_BASE.bothRandom)}</td>
                    </tr>
                  )}
                  {bt.drill && (
                    <tr>
                      <td className="py-1.5 pr-4">เลขเจาะ (2 ตัว × {DRILL_PER_DIGIT} เลข กลับได้) <span className="text-xs text-slate-400">— ต่อชุด {pct(bt.drill.set)} (10 ปี {pct(DRILL_BASE.set10y)})</span></td>
                      <td className={`py-1.5 pr-4 text-right font-semibold ${bt.drill.any > DRILL_BASE.dayRandom ? "text-emerald-600" : "text-slate-700"}`}>{pct(bt.drill.any)} <span className="text-xs font-normal text-slate-400">(10 ปี {pct(DRILL_BASE.day10y)})</span></td>
                      <td className="py-1.5 pr-4 text-right">–</td>
                      <td className="py-1.5 text-right text-slate-400">{pct(DRILL_BASE.dayRandom)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-blue-600">ดูรายวัน</summary>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-1 pr-4">วันที่</th><th className="py-1 pr-4">เปิด</th><th className="py-1 pr-4">ฟัน (3 อันดับ)</th><th className="py-1 pr-4">ปิดจริง</th><th className="py-1 pr-4">ถูก</th><th className="py-1">เจาะ</th></tr>
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
                          <td className="py-1.5 pr-4 font-medium">{d.hits.length ? `${d.hits.length} ตัว` : <span className="text-slate-400">–</span>}</td>
                          <td className="py-1.5 font-mono text-emerald-700">{d.drill?.hits.length ? d.drill.hits.join(" ") : <span className="text-slate-400">–</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </section>
          )}

          {days.length > 0 && (() => {
            const paged = paginate([...days].reverse(), page);
            const keep = new URLSearchParams();
            keep.set("stock", stockId);
            if (hasOpen) { keep.set("openValue", openValueRaw); keep.set("openChange", openChangeRaw); keep.set("date", dateRaw); }
            return (
            <section id="history" className="card p-0">
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
                    {paged.items.map((d) => {
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
                <Pagination {...paged} href={(n) => { keep.set("page", String(n)); return `/digits?${keep.toString()}#history`; }} />
              </div>
            </section>
            );
          })()}

          <p className="text-xs text-slate-500">* นับจากสถิติที่บันทึกไว้เท่านั้น ยิ่งมีข้อมูลมาก % ต่อตำแหน่งยิ่งนิ่ง</p>
        </>
      )}
    </div>
  );
}
