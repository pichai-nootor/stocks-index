import type { Summary } from "@/lib/stats";

/** ตาราง 2×2: เปิด +/− → ปิด +/− */
export function PatternMatrix({ summary }: { summary: Summary }) {
  const { patterns: p, whenOpenUp, whenOpenDown } = summary;
  const cell = (n: number, total: number, tone: "up" | "down") => (
    <td className="px-4 py-3 text-center">
      <div className={`text-xl font-semibold ${tone === "up" ? "text-emerald-600" : "text-red-600"}`}>{n}</div>
      <div className="text-xs text-slate-500">{total ? `${((n / total) * 100).toFixed(0)}%` : "-"}</div>
    </td>
  );
  return (
    <div className="card p-0">
      <div className="border-b border-slate-200 px-5 py-3">
        <h2 className="font-medium">รูปแบบ เปิด → ปิด</h2>
        <p className="text-xs text-slate-500">
          ปิดกลับทิศจากเปิด {(summary.reversalRate * 100).toFixed(0)}% ของครั้งทั้งหมด
          {p.flat > 0 && ` · ไม่เปลี่ยนแปลง ${p.flat} ครั้ง (ไม่นับในตาราง)`}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">วันที่เปิด…</th>
            <th className="px-4 py-2">ปิด +</th>
            <th className="px-4 py-2">ปิด −</th>
            <th className="px-4 py-2">รวม</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr>
            <td className="px-4 py-3 font-medium text-emerald-700">เปิด +</td>
            {cell(p.upUp, p.upUp + p.upDown, "up")}
            {cell(p.upDown, p.upUp + p.upDown, "down")}
            <td className="px-4 py-3 text-center text-slate-600">{whenOpenUp.count}</td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-medium text-red-700">เปิด −</td>
            {cell(p.downUp, p.downUp + p.downDown, "up")}
            {cell(p.downDown, p.downUp + p.downDown, "down")}
            <td className="px-4 py-3 text-center text-slate-600">{whenOpenDown.count}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
