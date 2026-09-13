import Link from "next/link";
import { pickDigits, top2, bottom2, prevCloseCents, exactDigitProbs } from "@/lib/digits";
import { fmtNum, fmtChange, forecastDirection, forecastClose, directionCall, evaluateCalls, type Summary, type RecordLike } from "@/lib/stats";
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
  const D = prevCloseCents(record.openValue, record.openChange);
  const dir = record.openChange > 0 ? priceStats.whenOpenUp : record.openChange < 0 ? priceStats.whenOpenDown : priceStats.all;
  const df = forecastDirection(record.openValue, record.openChange, priceHistory);
  const cf = forecastClose(record.openValue, record.openChange, priceHistory);
  const call = directionCall(record.openValue, record.openChange, priceHistory);
  const ev = evaluateCalls(priceHistory);
  const pUp = df.pUp;
  const exact = exactDigitProbs(D, pUp);
  const flat = exact[0].p - exact[exact.length - 1].p < 0.01;
  const mathHot = exact.filter((e) => e.p >= exact[0].p - 0.005).map((e) => e.digit);
  const mathCold = exact.filter((e) => e.p <= exact[exact.length - 1].p + 0.005).map((e) => e.digit);

  return (
    <div className="card border-amber-200 bg-gradient-to-br from-amber-50/60 to-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {stock.symbol} <span className="font-normal text-slate-500">· {record.date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" })}</span>
        </h3>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">รอผลปิด</span>
      </div>

      <div className="mt-3"><CallCard c={call} score={{ called: ev.called, hits: ev.hits }} /></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[3fr_2fr]">
        <CloseForecastCard open={record.openValue} f={cf} dir={df} />
        <DirectionCard f={df} compact />
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-3">
          <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-amber-400 font-mono text-6xl font-bold text-white shadow">{ranked[0].digit}</span>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wide text-amber-800">ฟันเลข (D + ทิศทาง · โอกาส ~36%)</p>
            <p className="font-semibold">{pct(ranked[0].p)}</p>
            {ranked[1] && <p className="mt-1 text-slate-600">คู่ <span className="font-mono text-xl font-semibold text-amber-900">{ranked[0].digit} {ranked[1].digit}</span></p>}
            <p className="mt-1 text-xs text-slate-500">อันดับ: <span className="font-mono">{ranked.map((r) => r.digit).join(" › ")}</span></p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
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
          <div className="col-span-2 sm:col-span-2">
            <dt className="text-xs text-slate-500">คณิตศาสตร์ (D + ทิศทาง)</dt>
            <dd className="text-xs">
              {flat
                ? `ทุกเลข ~${Math.round(exact[0].p * 100)}% ไม่มีเลขเด่น`
                : mathHot.length <= 4
                  ? <>เลขเด่น <span className="font-mono font-semibold text-emerald-700">{mathHot.join(" ")}</span> ({(exact[0].p * 100).toFixed(0)}%)</>
                  : <>ส่วนใหญ่ ~{(exact[0].p * 100).toFixed(0)}% · โอกาสน้อย <span className="font-mono font-semibold text-red-600">{mathCold.join(" ")}</span> ({(exact[exact.length - 1].p * 100).toFixed(0)}%)</>}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 pt-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">เย็นนี้กรอกปิด:</span>
          <CloseForm recordId={record.id} />
        </div>
        <Link href={`/digits?stock=${stock.id}&date=${record.date.toISOString().slice(0, 10)}&openValue=${record.openValue}&openChange=${record.openChange}`} className="text-sm text-blue-600 hover:underline">
          ดูวิเคราะห์เต็ม →
        </Link>
      </div>
    </div>
  );
}
