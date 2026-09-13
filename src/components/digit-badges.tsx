/** แสดงเลข เช่น "76" เป็นกล่องทีละหลัก; hilite = เลขที่ต้องเน้น (เด้ง) */
export function Digits({
  value,
  hilite = [],
  tone = "slate",
}: {
  value: string;
  hilite?: string[];
  tone?: "slate" | "blue";
}) {
  const base = tone === "blue" ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className="inline-flex gap-0.5 font-mono text-sm">
      {value.split("").map((d, i) => (
        <span
          key={i}
          className={`inline-flex h-7 w-6 items-center justify-center rounded border ${
            hilite.includes(d) ? "border-amber-400 bg-amber-100 font-semibold text-amber-900" : base
          }`}
        >
          {d}
        </span>
      ))}
    </span>
  );
}
