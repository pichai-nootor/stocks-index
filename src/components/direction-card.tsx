import type { DirectionForecast } from "@/lib/stats";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** การ์ดฟันทิศทาง: ปิดขึ้น/ลง เทียบปิดวันก่อน พร้อมระดับความมั่นใจตามขนาดที่เปิด */
export function DirectionCard({ f, compact = false }: { f: DirectionForecast; compact?: boolean }) {
  const up = f.direction === "up";
  const flat = f.direction === "flat";
  const color = flat ? "bg-slate-200 text-slate-700" : up ? "bg-emerald-500 text-white" : "bg-red-500 text-white";
  const tierColor = f.pSame >= 0.78 ? "bg-emerald-100 text-emerald-800" : f.pSame >= 0.65 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";
  return (
    <div className={`card ${compact ? "" : "bg-gradient-to-br from-slate-50 to-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ฟันทิศทางปิด (เทียบปิดวันก่อน)</p>
      <div className="mt-2 flex items-center gap-4">
        <span className={`flex h-20 w-20 items-center justify-center rounded-3xl text-5xl font-bold shadow ${color}`}>{flat ? "–" : up ? "▲" : "▼"}</span>
        <div>
          <p className="text-2xl font-semibold">{flat ? "ไม่ชัด" : up ? "ปิดบวก" : "ปิดลบ"} <span className="text-lg text-slate-600">{flat ? "" : pct(f.pSame)}</span></p>
          <p className="mt-1 text-sm text-slate-600">
            เปิดห่างจากเมื่อวาน <span className={`font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>{f.openPct > 0 ? "+" : ""}{f.openPct.toFixed(2)}%</span>
            {" "}<span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tierColor}`}>ความมั่นใจ {f.tier.label}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            สถิติ 10 ปี เปิด{up ? "บวก" : "ลบ"}ช่วงนี้ {pct(up ? f.tier.up : f.tier.down)} ({up ? f.tier.nUp : f.tier.nDown} วัน)
            {f.own && <> · ของคุณ {f.own.same}/{f.own.n}</>}
          </p>
        </div>
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-slate-500">
          ยิ่งเปิดห่างจากปิดเมื่อวานมาก ยิ่งปิดไปทางเดียวกัน — และเปิดลบเชื่อถือได้กว่าเปิดบวก: &lt;0.1% บวก 50% / ลบ 59% · 0.1–0.25% บวก 56% / ลบ 67% · 0.25–0.5% ≈ 67–69% · 0.5–1% ≈ 79–81% · ≥1% บวก 78% / ลบ 95%
        </p>
      )}
    </div>
  );
}
