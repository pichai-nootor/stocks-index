import Link from "next/link";
import { pickDigits, pickPair, pairLevel, PAIR_BASE, top2, bottom2, prevCloseCents } from "@/lib/digits";
import { fmtNum, fmtChange, forecastDirection, forecastClose, directionCall, evaluateCalls, checkOpen, type Summary, type RecordLike } from "@/lib/stats";
import { OpenWarning } from "@/components/open-warning";
import { CallCard } from "@/components/call-card";
import { CloseForecastCard } from "@/components/close-forecast-card";
import { DirectionCard } from "@/components/direction-card";
import { Digits } from "@/components/digit-badges";
import { CloseForm } from "@/components/close-form";

type Rec = { id: string; date: Date; openValue: number; openChange: number };
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** การ์ดวิเคราะห์ของวันที่กรอกเปิดไว้ (รอผลปิด) — ใช้ในหน้าแรก */
export function TodayCard({ stock, record, priceStats, priceHistory = [] }: {
  stock: { id: string; symbol: string; name: string | null };
  record: Rec;
  priceStats: Summary;
  priceHistory?: RecordLike[];
}) {
  const oTop = top2(record.openValue), oBot = bottom2(record.openChange);
  const ranked = pickDigits(record.openValue, record.openChange, priceHistory);
  const pp = pickPair(record.openValue, record.openChange, priceHistory);
  const D = prevCloseCents(record.openValue, record.openChange);
  const dir = record.openChange > 0 ? priceStats.whenOpenUp : record.openChange < 0 ? priceStats.whenOpenDown : priceStats.all;
  const df = forecastDirection(record.openValue, record.openChange, priceHistory);
  const cf = forecastClose(record.openValue, record.openChange, priceHistory);
  const call = directionCall(record.openValue, record.openChange, priceHistory);
  const ev = evaluateCalls(priceHistory);
  const pUp = df.pUp;
  const check = checkOpen(priceHistory, record.date, record.openValue, record.openChange);
  const dateStr = record.date.toISOString().slice(0, 10);

  return (
    <div className="card border-amber-200 bg-gradient-to-br from-amber-50/60 to-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {stock.symbol} <span className="font-normal text-slate-500">· {record.date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</span>
        </h3>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">รอผลปิด</span>
      </div>

      {check.mismatch && <div className="mt-3"><OpenWarning check={check} fixHref={`/digits?stock=${stock.id}&date=${dateStr}&openValue=${record.openValue}&openChange=${check.suggestedOpenChange}`} /></div>}
      <div className="mt-3"><CallCard c={call} score={{ called: ev.called, hits: ev.hits }} /></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <CloseForecastCard open={record.openValue} f={cf} dir={df} />
        <DirectionCard f={df} compact />
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[auto_auto_1fr]">
        <div className="flex items-center gap-3">
          <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-amber-400 font-mono text-6xl font-bold text-white shadow">{ranked[0].digit}</span>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-amber-800">ฟันเลขเดี่ยว</p>
            <p className="font-semibold">โผล่ {pct(ranked[0].p)}</p>
            <p className="mt-1 text-xs text-slate-500">เพดาน ~36% · สุ่ม 34%</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-24 items-center justify-center gap-1 rounded-3xl bg-amber-100 px-3 font-mono text-5xl font-bold text-amber-900 shadow-sm">{pp.pair[0]}<span className="text-amber-400">·</span>{pp.pair[1]}</span>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-amber-800">ฟันคู่ <span className={`ml-1 rounded px-1.5 py-0.5 normal-case ${pp.pBoth >= 0.22 ? "bg-emerald-100 text-emerald-800" : pp.pBoth < 0.14 ? "bg-slate-200 text-slate-600" : "bg-amber-200 text-amber-900"}`}>{pairLevel(pp.pBoth)}</span></p>
            <p className="font-semibold">มาทั้งคู่ {pct(pp.pBoth)}</p>
            <p className="text-xs text-slate-600">อย่างน้อย 1 ตัว {pct(pp.pAny)}</p>
            <p className="mt-1 text-xs text-slate-500">10 ปี ≈ {pct(PAIR_BASE.both10y)} · สุ่ม {pct(PAIR_BASE.bothRandom)}</p>
          </div>
        </div>
        <div className="sm:col-span-3">
          <p className="text-xs text-slate-500">โอกาสที่แต่ละเลขจะโผล่ตอนปิด (บน ∪ ล่าง)</p>
          <div className="mt-1 grid grid-cols-10 gap-1">
            {[...ranked].sort((a, b) => a.digit.localeCompare(b.digit)).map((r) => {
              const top = r.p >= ranked[0].p - 0.005, low = r.p <= ranked[ranked.length - 1].p + 0.005 && !top;
              return (
                <div key={r.digit} className={`rounded-md py-1 text-center ${top ? "bg-amber-100" : low ? "bg-slate-100 text-slate-400" : "bg-white"}`}>
                  <div className={`font-mono text-lg font-bold ${top ? "text-amber-900" : ""}`}>{r.digit}</div>
                  <div className="text-[11px] tabular-nums">{(r.p * 100).toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:col-span-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">เปิด</dt>
            <dd className="tabular-nums">{fmtNum(record.openValue)} <span className={record.openChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(record.openChange)}</span></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">เลขเปิด บน / ล่าง</dt>
            <dd><Digits value={oTop} hilite={[ranked[0].digit]} /> <Digits value={oBot} hilite={[ranked[0].digit]} /></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">ปิดวันก่อน → D</dt>
            <dd className="tabular-nums">{fmtNum(record.openValue - record.openChange)} → <span className="font-mono font-semibold">{String(D).padStart(2, "0")}</span></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">ทิศทาง (เปิด {record.openChange < 0 ? "−" : "+"})</dt>
            <dd><span className={`font-semibold ${pUp >= 0.5 ? "text-emerald-600" : "text-red-600"}`}>ปิดขึ้น {pct(pUp)}</span> <span className="text-xs text-slate-500">(ของคุณ {dir.count} วัน)</span></dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 pt-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">เย็นนี้กรอกปิด:</span>
          <CloseForm recordId={record.id} />
        </div>
        <Link href={`/digits?stock=${stock.id}&date=${dateStr}&openValue=${record.openValue}&openChange=${record.openChange}`} className="text-sm text-blue-600 hover:underline">
          ดูวิเคราะห์เต็ม →
        </Link>
      </div>
    </div>
  );
}
