import Link from "next/link";
import { pickPair, top2, bottom2, prevCloseCents } from "@/lib/digits";
import { pickTwoFor } from "@/lib/formulas/stocks";
import { hangSengSession } from "@/lib/stocks/hangseng";
import { isDowJones } from "@/lib/stocks/dowjones";
import { TwoPickCard } from "@/components/two-pick";
import { CloseYahooButton } from "@/components/close-yahoo-button";
import { LiveCard } from "@/components/live-card";
import { SHOW_DIRECTION } from "@/lib/config";
import { fmtNum, fmtChange, forecastDirection, forecastClose, directionCall, evaluateCalls, checkOpen, type Summary, type RecordLike } from "@/lib/stats";
import { OpenWarning } from "@/components/open-warning";
import { CallCard } from "@/components/call-card";
import { CloseForecastCard } from "@/components/close-forecast-card";
import { DirectionCard } from "@/components/direction-card";
import { Digits } from "@/components/digit-badges";
import { CloseForm } from "@/components/close-form";

type Rec = { id: string; date: Date; openValue: number; openChange: number; liveValue: number | null; liveAt: Date | null };
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** การ์ดวิเคราะห์ของวันที่กรอกเปิดไว้ (รอผลปิด) — ใช้ในหน้าแรก */
export function TodayCard({ stock, record, priceStats, priceHistory = [], live = null, liveScore }: {
  stock: { id: string; symbol: string; name: string | null };
  record: Rec;
  priceStats: Summary;
  priceHistory?: RecordLike[];
  /** ราคาสดจาก Yahoo (ถ้าดึงได้และเป็นวันเดียวกับรายการ) */
  live?: { price: number; at: string; closed: boolean; source?: "bse" | "yahoo" } | null;
  liveScore?: { called: number; hits: number };
}) {
  const oTop = top2(record.openValue), oBot = bottom2(record.openChange);
  const pp = hangSengSession(stock.symbol) || isDowJones(stock.symbol) ? undefined : pickPair(record.openValue, record.openChange, priceHistory); // ฮั่งเส็ง/ดาวโจนส์ยังไม่มีหลักฐานคู่ผูกของตัวเอง
  const two = pickTwoFor(stock.symbol, record.openValue, record.openChange, priceHistory);
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
        <span className="flex items-center gap-2"><span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">รอผลปิด</span><CloseYahooButton recordId={record.id} /></span>
      </div>

      {check.mismatch && <div className="mt-3"><OpenWarning check={check} fixHref={`/digits?stock=${stock.id}&date=${dateStr}&openValue=${record.openValue}&openChange=${check.suggestedOpenChange}`} /></div>}
      {SHOW_DIRECTION && (<>
      <div className={`mt-3 grid gap-3 ${call.call ? "lg:grid-cols-2" : ""}`}>
        <LiveCard recordId={record.id} prevClose={record.openValue - record.openChange} live={live} saved={record.liveValue !== null && record.liveAt ? { price: record.liveValue, at: record.liveAt.toISOString() } : null} score={liveScore} />
        {/* ฟันจากเปิดอย่างเดียว (เปิดห่าง ≥1%) — โชว์เฉพาะวันที่เข้าเกณฑ์ เป็นเสียงยืนยันเพิ่ม */}
        {call.call && <CallCard c={call} score={{ called: ev.called, hits: ev.hits }} />}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CloseForecastCard open={record.openValue} f={cf} dir={df} />
        <DirectionCard f={df} compact />
      </div>

      </>)}
      <div className="mt-3"><TwoPickCard two={two} tied={pp} open={{ top: oTop, bottom: oBot }} /></div>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:col-span-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">เปิด</dt>
            <dd className="tabular-nums">{fmtNum(record.openValue)} <span className={record.openChange < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(record.openChange)}</span></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">เลขเปิด บน / ล่าง</dt>
            <dd><Digits value={oTop} hilite={two.digits.map((d) => d.digit)} /> <Digits value={oBot} hilite={two.digits.map((d) => d.digit)} /></dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">ปิดวันก่อน → D</dt>
            <dd className="tabular-nums">{fmtNum(record.openValue - record.openChange)} → <span className="font-mono font-semibold">{String(D).padStart(2, "0")}</span></dd>
          </div>
          {SHOW_DIRECTION && (
          <div>
            <dt className="text-xs text-slate-500">ทิศทาง (เปิด {record.openChange < 0 ? "−" : "+"})</dt>
            <dd><span className={`font-semibold ${pUp >= 0.5 ? "text-emerald-600" : "text-red-600"}`}>ปิดขึ้น {pct(pUp)}</span> <span className="text-xs text-slate-500">(ของคุณ {dir.count} วัน)</span></dd>
          </div>
          )}
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
