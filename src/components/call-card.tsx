import { CALL_MIN_GAP_PCT, type DirectionCall } from "@/lib/stats";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** การ์ด "ฟัน / ไม่ฟัน" วันนี้ */
export function CallCard({ c, score }: { c: DirectionCall; score?: { called: number; hits: number } }) {
  const f = c.forecast;
  if (!c.call) {
    return (
      <div className="card border-slate-300 bg-slate-50">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ฟันทิศทางวันนี้</p>
        <div className="mt-2 flex items-center gap-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-300 text-3xl font-bold text-white">—</span>
          <div>
            <p className="text-2xl font-semibold text-slate-700">วันนี้ไม่ฟัน</p>
            <p className="mt-1 text-sm text-slate-600">{c.reason}</p>
            <p className="mt-1 text-xs text-slate-500">ฟันเฉพาะวันที่เปิดห่างจากปิดวันก่อน ≥ {CALL_MIN_GAP_PCT}% (ราว 1 ใน 15 ของวัน · ถูก 84–94%)</p>
          </div>
        </div>
        {score && score.called > 0 && <p className="mt-3 text-xs text-slate-500">ผลงานวันที่ฟัน: ถูก {score.hits}/{score.called} ({pct(score.hits / score.called)})</p>}
      </div>
    );
  }
  const up = c.call === "up";
  return (
    <div className={`card ${up ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${up ? "text-emerald-800" : "text-red-800"}`}>ฟันทิศทางวันนี้</p>
      <div className="mt-2 flex items-center gap-4">
        <span className={`flex h-20 w-20 items-center justify-center rounded-3xl text-5xl font-bold text-white shadow ${up ? "bg-emerald-500" : "bg-red-500"}`}>{up ? "▲" : "▼"}</span>
        <div>
          <p className={`text-3xl font-semibold ${up ? "text-emerald-700" : "text-red-700"}`}>{up ? "ปิดบวก" : "ปิดลบ"} <span className="text-xl">{pct(f.pSame)}</span></p>
          <p className="mt-1 text-sm text-slate-700">{c.reason} <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs">มั่นใจ {f.tier.label}</span></p>
          <p className="mt-1 text-xs text-slate-600">สถิติ 10 ปี {pct(f.tier.sameRate)} ({f.tier.n} วัน){f.own ? ` · ของคุณ ${f.own.same}/${f.own.n}` : ""}</p>
        </div>
      </div>
      {score && score.called > 0 && <p className="mt-3 text-xs text-slate-600">ผลงานวันที่ฟัน: ถูก {score.hits}/{score.called} ({pct(score.hits / score.called)})</p>}
    </div>
  );
}
