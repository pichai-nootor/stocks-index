"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const WEEK = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);
const addDays = (d: string, k: number) => ymd(parse(d) + k * 86400000);
const addMonths = (m: string, k: number) => { const [y, mo] = m.split("-").map(Number); const t = y * 12 + mo - 1 + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
const monthEnd = (m: string) => addDays(`${addMonths(m, 1)}-01`, -1);
const label = (d: string) => `${+d.slice(8)} ${TH_SHORT[+d.slice(5, 7) - 1]} ${String(+d.slice(0, 4) + 543).slice(-2)}`;
const short = (x: number) => `${x > 0 ? "+" : ""}${Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(Math.abs(x) >= 10000 ? 0 : 1)}k` : x}`;

/**
 * เลือกช่วงวันที่ (ผู้ใช้ 29 ต.ค. 69: "เอาแบบ Date Range Picker") — แบบ shadcn: ปุ่มลัดด้านซ้าย + ปฏิทิน 2 เดือน
 *   กดวันแรก → วันสุดท้าย → "ใช้ช่วงนี้" · แต่ละวันมีจุดเขียว/แดง = วันนั้นกำไร/ขาดทุน · base = ลิงก์หน้าเดิม (ต่อ &from=&to=)
 */
export function RangePicker({ from, to, min, max, base, dayProfit, anchor = "buy" }: { from: string; to: string; min: string; max: string; base: string; dayProfit: Record<string, number>; anchor?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(addMonths(to.slice(0, 7), -1)); // เดือนซ้าย
  const [draft, setDraft] = useState<{ from: string; to: string | null }>({ from, to });
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const go = (f: string, t: string) => { setOpen(false); router.push(`${base}&from=${f < min ? min : f}&to=${t > max ? max : t}#${anchor}`, { scroll: false }); };
  const thisM = max.slice(0, 7), thisY = max.slice(0, 4);
  const presets: [string, string, string][] = [
    ["เดือนนี้", `${thisM}-01`, max],
    ["เดือนก่อน", `${addMonths(thisM, -1)}-01`, monthEnd(addMonths(thisM, -1))],
    ["7 วันล่าสุด", addDays(max, -6), max],
    ["30 วันล่าสุด", addDays(max, -29), max],
    ["3 เดือนล่าสุด", `${addMonths(thisM, -2)}-01`, max],
    ["ปีนี้", `${thisY}-01-01`, max],
    ["ปีก่อน", `${+thisY - 1}-01-01`, `${+thisY - 1}-12-31`],
    ["ทั้งหมด", min, max],
  ];

  const pick = (d: string) => {
    if (!draft.from || draft.to) setDraft({ from: d, to: null });
    else if (d < draft.from) setDraft({ from: d, to: draft.from });
    else setDraft({ from: draft.from, to: d });
  };
  const end = draft.to ?? (hover && hover >= draft.from ? hover : null);
  const sum = (f: string, t: string) => Object.entries(dayProfit).filter(([d]) => d >= f && d <= t).reduce((a, [, p]) => a + p, 0);

  const month = (m: string) => {
    const first = `${m}-01`, lead = new Date(parse(first)).getUTCDay(), last = +monthEnd(m).slice(8);
    const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: last }, (_, i) => `${m}-${String(i + 1).padStart(2, "0")}`)];
    return (
      <div className="w-[15.5rem]">
        <div className="mb-1 text-center text-sm font-medium">{TH_MONTHS[+m.slice(5) - 1]} {+m.slice(0, 4) + 543}</div>
        <div className="grid grid-cols-7 text-center text-[11px] text-slate-400">{WEEK.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const off = d < min || d > max;
            const isEdge = d === draft.from || d === end;
            const inRange = end && d > draft.from && d < end;
            const p = dayProfit[d];
            return (
              <button
                key={d}
                type="button"
                disabled={off}
                onClick={() => pick(d)}
                onMouseEnter={() => setHover(d)}
                className={`relative flex h-8 flex-col items-center justify-center text-sm tabular-nums ${off ? "text-slate-300" : "hover:bg-slate-100"} ${isEdge ? "rounded-md bg-blue-600 font-semibold text-white hover:bg-blue-600" : inRange ? "bg-blue-50 text-blue-900" : "rounded-md"} ${d === max && !isEdge ? "font-semibold text-blue-700" : ""}`}
                title={p !== undefined ? `${label(d)} ${short(p)}` : undefined}
              >
                {+d.slice(8)}
                {p !== undefined && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isEdge ? "bg-white" : p > 0 ? "bg-emerald-500" : p < 0 ? "bg-rose-500" : "bg-slate-300"}`} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => { setDraft({ from, to }); setView(addMonths(to.slice(0, 7), -1)); setOpen((o) => !o); }}
        className={`flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm ${open ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"}`}
      >
        <span aria-hidden>📅</span>
        <span className="font-medium">{label(from)} – {label(to)}</span>
        <span className="text-xs text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:flex-row">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
            {presets.map(([name, f, t]) => {
              const on = f === from && t === to;
              return (
                <button key={name} type="button" onClick={() => go(f, t)} className={`whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm ${on ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}>
                  {name}
                </button>
              );
            })}
          </div>
          <div className="p-3" onMouseLeave={() => setHover(null)}>
            <div className="flex items-start gap-4">
              <button type="button" onClick={() => setView((v) => addMonths(v, -1))} disabled={view <= min.slice(0, 7)} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="เดือนก่อน">‹</button>
              {month(view)}
              <div className="hidden sm:block">{month(addMonths(view, 1))}</div>
              <button type="button" onClick={() => setView((v) => addMonths(v, 1))} disabled={addMonths(view, 1) >= max.slice(0, 7)} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="เดือนถัดไป">›</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-600">
                {draft.to ? <>{label(draft.from)} – {label(draft.to)} <span className={`ml-1 tabular-nums ${sum(draft.from, draft.to) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{short(sum(draft.from, draft.to))}</span></> : "เลือกวันสุดท้าย"}
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost border border-slate-200 px-3 py-1">ยกเลิก</button>
                <button type="button" disabled={!draft.to} onClick={() => draft.to && go(draft.from, draft.to)} className="btn-primary px-3 py-1 disabled:opacity-40">ใช้ช่วงนี้</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
