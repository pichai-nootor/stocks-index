"use client";

import { useActionState } from "react";
import { saveLiveFromYahoo, fillCloseFromYahoo } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";
import { LIVE_CHECKPOINTS, LIVE_CALL_MIN, liveDirection, fmtThaiTime } from "@/lib/intraday";
import { fmtNum, fmtChange } from "@/lib/stats";

const pct = (x: number) => `${Math.round(x * 100)}%`;

type Live = { price: number; at: string; closed: boolean } | null;

/**
 * ฟันทิศทาง "สด": ราคาตอนนี้จาก Yahoo (ส่งมาจาก server) + จุดที่บันทึกไว้
 * ยิ่งเช็กสาย ยิ่งแม่น — 13:45 น. ไทย ห่าง ≥0.25% ถูก ~90%, 15:45 น. ≥0.25% ถูก 97%
 */
export function LiveCard({ recordId, prevClose, live, saved, score }: {
  recordId: string;
  prevClose: number;
  live: Live;
  saved: { price: number; at: string } | null;
  score?: { called: number; hits: number };
}) {
  const [ls, liveAction, livePending] = useActionState(saveLiveFromYahoo, undefined);
  const [cs, closeAction, closePending] = useActionState(fillCloseFromYahoo, undefined);
  const now = live && !live.closed ? liveDirection(prevClose, live.price, new Date(live.at)) : null;
  const kept = saved ? liveDirection(prevClose, saved.price, new Date(saved.at)) : null;
  const show = kept ?? now;
  const tone = (c: "up" | "down" | null) => (c === "up" ? "border-emerald-300 bg-emerald-50" : c === "down" ? "border-red-300 bg-red-50" : "border-slate-300 bg-slate-50");

  return (
    <div className={`card ${tone(show?.call ?? null)}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">ฟันทิศทางสด (ราคาระหว่างวัน)</p>
        {live && <p className="text-xs text-slate-500">Yahoo ล่าสุด {fmtNum(live.price)} <span className={live.price >= prevClose ? "text-emerald-600" : "text-red-600"}>{fmtChange(live.price - prevClose)}</span> · {fmtThaiTime(new Date(live.at))} น. ไทย{live.closed ? " · ปิดแล้ว" : ""}</p>}
      </div>

      {show ? (
        <div className="mt-2 flex items-center gap-4">
          <span className={`flex h-16 w-16 items-center justify-center rounded-2xl text-4xl font-bold text-white shadow ${show.call === "up" ? "bg-emerald-500" : show.call === "down" ? "bg-red-500" : "bg-slate-300"}`}>{show.call === "up" ? "▲" : show.call === "down" ? "▼" : "—"}</span>
          <div className="text-sm">
            <p className="text-xl font-semibold">{show.call === "up" ? "ปิดบวก" : show.call === "down" ? "ปิดลบ" : "ยังไม่ฟัน"} {show.call && <span className="text-base text-slate-600">{pct(show.pSame)}</span>}</p>
            <p className="text-slate-700">{show.reason}</p>
            {kept && <p className="text-xs text-slate-500">บันทึกไว้ตอน {fmtThaiTime(new Date(saved!.at))} น. ที่ {fmtNum(saved!.price)} — นี่คือค่าที่จะถูกตรวจตอนปิด</p>}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">{live?.closed ? "ตลาดปิดแล้ว — เติมผลปิดด้านล่าง" : "ยังไม่มีราคาสด (ตลาดอินเดียเปิด 10:45–17:00 น. ไทย)"}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {live && !live.closed && (
          <form action={liveAction}>
            <input type="hidden" name="id" value={recordId} />
            <button className="btn-primary" disabled={livePending}>{livePending ? "..." : kept ? "อัปเดตจุดฟันสดเป็นตอนนี้" : "บันทึกฟันสดตอนนี้"}</button>
          </form>
        )}
        {live?.closed && (
          <form action={closeAction}>
            <input type="hidden" name="id" value={recordId} />
            <button className="btn-primary" disabled={closePending}>{closePending ? "..." : "เติมปิดจาก Yahoo"}</button>
          </form>
        )}
        {score && score.called > 0 && <span className="text-xs text-slate-600">ผลฟันสดที่ผ่านมา: ถูก {score.hits}/{score.called} ({pct(score.hits / score.called)})</span>}
      </div>
      <FormError message={ls?.error ?? cs?.error} />

      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer">เช็กตอนไหนแม่นแค่ไหน (SENSEX 2 ปี, 718 วัน) — ฟันเมื่อ ≥ {pct(LIVE_CALL_MIN)}</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-slate-400"><tr><th className="text-left font-normal">เวลาไทย</th>{LIVE_CHECKPOINTS[0].tiers.map((t) => <th key={t.minPct} className="text-right font-normal">≥{t.minPct}%</th>).reverse()}</tr></thead>
          <tbody>
            {LIVE_CHECKPOINTS.map((c) => (
              <tr key={c.ist}><td>{c.thai}</td>{[...c.tiers].reverse().map((t) => <td key={t.minPct} className={`text-right ${t.rate >= LIVE_CALL_MIN ? "font-semibold text-emerald-700" : ""}`}>{pct(t.rate)}</td>)}</tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1">คอลัมน์ = ระยะห่างจากปิดเมื่อวานตอนที่เช็ก · ทิศทางเทียบปิดวันก่อน ไม่ใช่เทียบเปิด</p>
      </details>
    </div>
  );
}
