import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmtNum, fmtChange } from "@/lib/stats";
import { PCT_INDEXES, isPctIndex, hasOpenPct, pctDays, type PctDay, type PctIndex } from "@/lib/pct-stats";
import { openRangeHistory } from "@/lib/open-range";

const DIG = "0123456789".split("");
const STEPS = [0.01, 0.05, 0.1] as const;
/** อ่านตัวเลขที่ผู้ใช้พิมพ์ — รับ "−" (ลบแบบยูนิโค้ด) "," และ "-1." ได้ · ว่าง/อ่านไม่ได้ = ค่าเริ่มต้น */
const num = (v: unknown, d: number) => { if (typeof v !== "string" && typeof v !== "number") return d; const t = String(v).replace(/[%\s]/g, "").replace(/[−–]/g, "-").replace(",", "."); if (t === "" || t === "-") return d; const n = Number(t.endsWith(".") ? t.slice(0, -1) : t); return Number.isFinite(n) ? n : d; };
const fmtP = (x: number, step: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${step >= 0.1 ? `${Math.abs(x).toFixed(1)}x` : Math.abs(x).toFixed(2)}%`;

/** % ของวัน → ช่วง (ปัดเข้าหาศูนย์ตามขนาดช่วง เช่น ช่วง 0.1: −0.76 → −0.7x) */
const bucketOf = (p: number, step: number) => { const h = Math.round(Math.abs(p) * 100), s = Math.round(step * 100); return (Math.sign(p) * Math.floor(h / s) * s) / 100; };

/**
 * สถิติ % → เลขที่ออก (หุ้นปกติ) — เลือกดัชนี + ช่วง % แล้วดูว่าแต่ละ % เคยออกเลข 0–9 กี่ครั้ง (ราคารายวัน 10 ปี)
 *   ผู้ใช้ขอ 14 ต.ค. 69: เก็บข้อมูล % มาดูว่าดัชนีชอบออกเลขไหน — เป็นเครื่องมือดูข้อมูล ไม่ได้ใช้ในสูตรฟัน
 */
export default async function PctPage({ searchParams }: PageProps<"/pct">) {
  await requireUser();
  const sp = await searchParams;
  const key = typeof sp.i === "string" && isPctIndex(sp.i) ? sp.i : "nk-am";
  const idx = PCT_INDEXES.find((x) => x.key === key)!;
  const kind = sp.k === "open" && hasOpenPct(key) ? "open" : "close";
  const step = STEPS.find((s) => s === num(sp.step, 0.01)) ?? 0.01;
  // ใส่ช่องไหนก่อนก็ได้ · แสดงตามที่ผู้ใช้พิมพ์ · ฝั่งลบเรียงจากใกล้ 0 ออกไป (−0.72 → −0.80) ตามที่ผู้ใช้อ่าน
  const inFrom = num(sp.from, -0.7), inTo = num(sp.to, -0.8);
  let from = Math.min(inFrom, inTo), to = Math.max(inFrom, inTo);

  const days = await pctDays(key);
  // ฐานของ "วันนี้วิ่งกี่จุด" = ปิดทั้งวันล่าสุด (รอบเช้าใช้ปิดบ่ายของวันก่อน — ปิดภาคเช้าเทียบกับค่านี้)
  const baseDays = key.endsWith("-am") ? await pctDays((key === "hk-am" ? "hk-pm16" : key.replace("-am", "-pm")) as PctIndex) : days;
  const baseClose = baseDays.at(-1)?.close ?? null;

  // "เปิดวันนี้ x%": หาวันในอดีตที่เปิดใกล้เคียงที่สุด → ดูว่าปิดไปกี่ % → ตั้งช่วง % ปิดให้ตารางด้านล่าง (ผู้ใช้ขอ 14 ต.ค. 69)
  const op = typeof sp.op === "string" && sp.op.trim() !== "" && hasOpenPct(key) ? num(sp.op, NaN) : NaN;
  const near = Number.isFinite(op) ? days.filter((d) => d.openPct !== null).sort((a, b) => Math.abs(a.openPct! - op) - Math.abs(b.openPct! - op)).slice(0, 40) : [];
  const nearClose = near.map((d) => d.closePct).sort((a, b) => a - b);
  const q = (f: number) => nearClose[Math.min(nearClose.length - 1, Math.floor(f * nearClose.length))];
  const guess = near.length >= 10 ? { lo: q(0.25), mid: q(0.5), hi: q(0.75), up: near.filter((d) => d.closePct > 0).length, openLo: Math.min(...near.map((d) => d.openPct!)), openHi: Math.max(...near.map((d) => d.openPct!)) } : null;
  const opTo = guess ? { from: guess.lo, to: guess.hi } : null;
  if (opTo) { from = opTo.from; to = opTo.to; }
  const kindUsed = opTo ? "close" : kind;
  const valueOf = (d: PctDay) => (kindUsed === "open" ? d.openPct : d.closePct);
  const groups = new Map<number, PctDay[]>();
  for (const d of days) { const v = valueOf(d); if (v === null) continue; const b = bucketOf(v, step); groups.set(b, [...(groups.get(b) ?? []), d]); }
  const lo = bucketOf(from, step), hi = bucketOf(to, step), sH = Math.round(step * 100);
  const rows: { b: number; list: PctDay[] }[] = [];
  for (let h = Math.round(lo * 100); h <= Math.round(hi * 100); h += sH) { const b = h / 100; if (rows.length < 400) rows.push({ b, list: (groups.get(b) ?? []).slice().reverse() }); }
  if (hi <= 0) rows.reverse(); // ฝั่งลบ: −0.72, −0.73, … , −0.80
  const inRange = rows.flatMap((r) => r.list);
  const rate = (list: PctDay[], d: string) => (list.length ? list.filter((x) => x.digits.includes(d)).length / list.length : 0);
  const base = days.filter((d) => valueOf(d) !== null);
  // ภาพรวม: แบ่งเป็นช่วงกว้าง w (ตั้งได้ · ค่าเริ่ม 0.03% เช่น .31–.33 / .34–.36) ตั้งแต่ 0.01 ถึง 3.00% และเกิน 3% ทั้งบวกและลบ · เกิน 1% โชว์เฉพาะช่วงที่มีวัน
  const W_OPTIONS = [2, 3, 4, 5, 10] as const;
  const w = W_OPTIONS.find((x) => x === num(sp.w, 3)) ?? 3;
  const bins = Array.from({ length: Math.ceil(300 / w) }, (_, k) => ({ lo: k * w + 1, hi: Math.min(300, k * w + w) }));
  const overview = (["+", "−"] as const).flatMap((sg) => [...bins, { lo: 301, hi: 100000 }].map(({ lo, hi }) => {
    const list = base.filter((d) => { const v = valueOf(d)!, h = Math.round(Math.abs(v) * 100); return (sg === "+" ? v > 0 : v < 0) && h >= lo && h <= hi; }).reverse();
    const rs = DIG.map((d) => ({ d, r: list.length ? list.filter((x) => x.digits.includes(d)).length / list.length : 0 }));
    const cnt = new Map<string, number>(); for (const x of list) for (const m of [x.top, x.bottom]) cnt.set(m, (cnt.get(m) ?? 0) + 1);
    return { lo, hi, label: hi > 1000 ? `${sg}เกิน 3.00%` : `${sg}${(lo / 100).toFixed(2)}–${(hi / 100).toFixed(2)}%`, list, hot: [...rs].sort((a, b) => b.r - a.r).slice(0, 3), cold: [...rs].sort((a, b) => a.r - b.r).slice(0, 2), nums: [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 3) };
  })).filter((o) => o.list.length || !/เกิน/.test(o.label) && Number(o.label.slice(1, 5)) < 1);

  // ตารางสถานการณ์ (ผู้ใช้ขอ 15 ต.ค. 69): เปิด ±x% → ปิดมักจะ ±เท่าไร (ช่วงกลาง 25–75%) → เลขที่มาบ่อยในช่วงปิดนั้น
  const orHist = await openRangeHistory(key);
  const scen = orHist ? (() => {
    const g = new Map<number, number[]>();
    for (const d of orHist) { const b = bucketOf(d.openPct, 0.1); if (Math.abs(b) <= 3) g.set(b, [...(g.get(b) ?? []), d.closePct]); }
    return [...g].filter(([, l]) => l.length >= 10).sort((a, b) => b[0] - a[0]).map(([b, l]) => {
      const c = [...l].sort((x, y) => x - y), lo = c[Math.floor(c.length * 0.25)], hi = c[Math.floor(c.length * 0.75)];
      const band = orHist.filter((d) => d.closePct >= lo && d.closePct <= hi);
      const hot = DIG.map((d) => ({ d, r: band.filter((x) => x.digits.includes(d)).length / (band.length || 1) })).sort((x, y) => y.r - x.r);
      return { b, n: l.length, up: l.filter((x) => x > 0).length / l.length, lo, hi, bandN: band.length, hot: hot.slice(0, 3), cold: hot.slice(-2) };
    });
  })() : null;
  const sg = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(2)}%`;

  const cells = (list: PctDay[], strong = false) => (
    <>{DIG.map((d) => {
      const n = list.filter((x) => x.digits.includes(d)).length, r = list.length ? n / list.length : 0;
      const tone = !list.length ? "" : r >= 0.6 ? "bg-blue-200 text-blue-950" : r >= 0.45 ? "bg-blue-100 text-blue-900" : r < 0.2 ? "text-slate-300" : "text-slate-600";
      return <td key={d} className={`px-1.5 py-1 text-center tabular-nums ${tone} ${strong ? "font-semibold" : ""}`}>{list.length ? <>{Math.round(r * 100)}<span className="text-[9px] opacity-60">%</span><div className="text-[9px] leading-3 opacity-60">{n}/{list.length}</div></> : "–"}</td>;
    })}</>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สถิติ % → เลขที่ออก</h1>
        <p className="text-sm text-slate-500">ราคารายวันย้อนหลัง 10 ปี · ผล = ทศนิยมราคาปิด (บน) + ทศนิยมการเปลี่ยนแปลง (ล่าง) · % ปัด 2 ตำแหน่งแบบที่เว็บแสดง</p>
      </div>

      {/* แยกหน้าต่อหุ้น — แต่ละดัชนีไม่เหมือนกัน (ผู้ใช้ขอ) */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {PCT_INDEXES.map((x) => (
          <Link key={x.key} href={`/pct?i=${x.key}&k=${hasOpenPct(x.key) ? kind : "close"}&from=${inFrom}&to=${inTo}&step=${step}&w=${w}`} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${x.key === key ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>{x.label}</Link>
        ))}
      </nav>

      <form className="card flex flex-wrap items-end gap-3 text-sm">
        <input type="hidden" name="i" value={key} /><input type="hidden" name="w" value={w} />
        <label className="space-y-1"><span className="block text-xs text-slate-500">ดู % ตอน</span>
          <select name="k" defaultValue={kind} className="input"><option value="close">ปิด</option>{hasOpenPct(key) && <option value="open">เปิด</option>}</select></label>
        <label className="space-y-1"><span className="block text-xs text-slate-500">ตั้งแต่ %</span><input name="from" defaultValue={inFrom} type="text" inputMode="decimal" className="input w-24" /></label>
        <label className="space-y-1"><span className="block text-xs text-slate-500">ถึง %</span><input name="to" defaultValue={inTo} type="text" inputMode="decimal" className="input w-24" /></label>
        <label className="space-y-1"><span className="block text-xs text-slate-500">ช่วงละ</span>
          <select name="step" defaultValue={step} className="input">{STEPS.map((s) => <option key={s} value={s}>{s.toFixed(2)}%</option>)}</select></label>
        <button className="btn-primary">ดู</button>
        <p className="w-full text-xs text-slate-400">{idx.label}: {base.length.toLocaleString()} วัน{base.length ? ` (${base[0].date} → ${base[base.length - 1].date})` : " — ดึงข้อมูลไม่ได้ ลองใหม่อีกครั้ง"}{idx.note ? ` · ${idx.note}` : ""} · ตัวเลขในช่อง = % ของวันที่เลขนั้นออก (ใต้ = กี่วัน/ทั้งหมด) · ฟ้าเข้ม ≥60% · ฟ้า ≥45%</p>
      </form>

      {scen && (
        <section className="card overflow-x-auto">
          <h2 className="font-medium">เปิดเท่านี้ → ปิดมักจะเท่าไร → เลขที่มาบ่อย · {idx.label}</h2>
          <p className="mb-2 text-xs text-slate-500">ช่วงปิด = ครึ่งกลางของวันที่เปิดในช่วงนั้น (25%–75%) · เลขมาบ่อย = นับจากทุกวันในอดีตที่ปิดอยู่ในช่วงนั้น (ปกติ ~34%){/-pm/.test(key) ? " · รอบบ่ายใช้ % ปิดภาคเช้าแทน % เปิดบ่าย" : ""} · ทดสอบย้อนหลังแล้ว รูดตามนี้ได้ใกล้เคียงเลขฟันปกติ ไม่ได้ดีกว่าชัด</p>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-2 py-1.5 text-left">เปิด</th><th className="px-2 py-1.5 text-right">วัน</th><th className="px-2 py-1.5 text-right">ปิดบวก</th><th className="px-2 py-1.5 text-left">ปิดมักจะอยู่ที่</th><th className="px-2 py-1.5 text-left">เลขมาบ่อย (รูด 2 ตัวแรก)</th><th className="px-2 py-1.5 text-left">มาน้อย</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scen.map((x) => (
                <tr key={x.b}>
                  <td className="px-2 py-1 whitespace-nowrap font-medium tabular-nums">{fmtP(x.b, 0.1)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{x.n}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{Math.round(x.up * 100)}%</td>
                  <td className="px-2 py-1 whitespace-nowrap tabular-nums">{sg(x.lo)} ถึง {sg(x.hi)} <span className="text-slate-400">({x.bandN} วัน)</span></td>
                  <td className="px-2 py-1 whitespace-nowrap font-mono">{x.hot.map((h, k) => <span key={h.d} className={`mr-1.5 rounded px-1 ${k < 2 ? "bg-violet-100 font-semibold text-violet-900" : "text-slate-500"}`}>{h.d} {Math.round(h.r * 100)}%</span>)}</td>
                  <td className="px-2 py-1 whitespace-nowrap font-mono text-slate-400">{x.cold.map((h) => `${h.d} ${Math.round(h.r * 100)}%`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ภาพรวมทุกช่วง 0.05% ของหุ้นที่เลือก (ผู้ใช้ขอ 14 ต.ค. 69: ทำครบทุกช่วง ไม่ใช่แค่ช่วงตัวอย่าง) */}
      <section className="card overflow-x-auto">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="font-medium">ภาพรวมทุกช่วง · {idx.label} · % {kindUsed === "open" ? "เปิด" : "ปิด"}</h2>
          <span className="text-xs text-slate-500">ช่วงกว้าง:</span>
          {W_OPTIONS.map((x) => <Link key={x} href={`/pct?i=${key}&k=${kind}&from=${inFrom}&to=${inTo}&step=${step}&w=${x}`} className={`rounded px-2 py-0.5 text-xs ${x === w ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{(x / 100).toFixed(2)}%</Link>)}
        </div>
        <p className="mb-2 text-xs text-slate-500">ช่วงละ {(w / 100).toFixed(2)}% (เช่น {w === 3 ? ".31–.33 · .34–.36" : `.01–.${String(w).padStart(2, "0")}`}) · เลขมาบ่อย = % ของวันที่เลขนั้นออก (ปกติ ~34%) · ตัวอย่าง = วันล่าสุดในช่วงนั้น{baseClose ? ` · วันนี้วิ่งกี่จุด คิดจากราคาปิดล่าสุด ${fmtNum(baseClose)}` : ""}</p>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="px-2 py-1.5 text-left">ช่วง %</th><th className="px-2 py-1.5 text-right">วัน</th><th className="px-2 py-1.5 text-right" title={baseClose ? `คิดจากราคาปิดล่าสุด ${fmtNum(baseClose)}` : ""}>วันนี้ ≈ วิ่ง (จุด)</th><th className="px-2 py-1.5 text-left">เลขมาบ่อย</th><th className="px-2 py-1.5 text-left">เลขมาน้อย</th><th className="px-2 py-1.5 text-left">เลข 2 ตัวบ่อยสุด</th><th className="px-2 py-1.5 text-left">ตัวอย่างล่าสุด</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {overview.map((o) => (
              <tr key={o.label} className={o.list.length ? "" : "text-slate-300"}>
                <td className="px-2 py-1 whitespace-nowrap font-medium tabular-nums">{o.label}</td>
                <td className="px-2 py-1 text-right tabular-nums">{o.list.length}</td>
                <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums text-slate-600" title={o.list.length ? `ย้อนหลัง: วิ่ง ${Math.round(Math.min(...o.list.map((x) => Math.abs(x.change))))}–${Math.round(Math.max(...o.list.map((x) => Math.abs(x.change))))} จุด` : ""}>{baseClose && o.lo <= 300 ? `${Math.round((baseClose * o.lo) / 10000)}–${Math.round((baseClose * o.hi) / 10000)}` : "–"}</td>
                <td className="px-2 py-1 whitespace-nowrap">{o.hot.map((h) => <span key={h.d} className={`mr-1.5 rounded px-1 font-mono ${h.r >= 0.5 && o.list.length >= 20 ? "bg-blue-100 font-semibold text-blue-900" : ""}`}>{h.d} <span className="text-slate-500">{Math.round(h.r * 100)}%</span></span>)}</td>
                <td className="px-2 py-1 whitespace-nowrap font-mono text-slate-500">{o.cold.map((h) => `${h.d} ${Math.round(h.r * 100)}%`).join(" · ")}</td>
                <td className="px-2 py-1 whitespace-nowrap font-mono text-slate-600">{o.nums.map(([m, n]) => `${m}×${n}`).join(" · ")}</td>
                <td className="px-2 py-1 whitespace-nowrap tabular-nums text-slate-500">{o.list[0] ? `${o.list[0].date} · ${fmtNum(o.list[0].close)} · ${fmtChange(o.list[0].change)} · ${o.list[0].top}/${o.list[0].bottom}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ใส่ % เปิดวันนี้ → ช่วงที่น่าจะปิด → ตารางเลขของช่วงนั้น */}
      <form className="card space-y-2 text-sm">
        <input type="hidden" name="i" value={key} /><input type="hidden" name="step" value={step} /><input type="hidden" name="w" value={w} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1"><span className="block text-xs text-slate-500">วันนี้เปิด (%)</span><input name="op" defaultValue={Number.isFinite(op) ? op : ""} type="text" inputMode="decimal" placeholder="เช่น -0.73" className="input w-28" disabled={!hasOpenPct(key)} /></label>
          <button className="btn-primary" disabled={!hasOpenPct(key)}>ดูว่าน่าจะปิดกี่ % และเลขที่ออกบ่อย</button>
          {!hasOpenPct(key) && <span className="text-xs text-slate-400">หน้านี้ไม่มี % เปิดย้อนหลัง — ใช้แท็บรอบเช้า / SENSEX / ดาวโจนส์</span>}
        </div>
        {Number.isFinite(op) && (guess ? (
          <div className="rounded-lg bg-blue-50 p-3 text-blue-950">
            <p>วันที่เคย<b>เปิดใกล้เคียง {op > 0 ? "+" : ""}{op.toFixed(2)}%</b> (เปิด {guess.openLo.toFixed(2)}% ถึง {guess.openHi.toFixed(2)}%) มี <b>{near.length} วัน</b> · ปิดบวก {guess.up} วัน · ปิดลบ {near.length - guess.up} วัน</p>
            <p className="mt-1">ส่วนใหญ่ปิดระหว่าง <b>{guess.lo.toFixed(2)}% ถึง {guess.hi.toFixed(2)}%</b> (กลาง {guess.mid.toFixed(2)}%) → ตารางด้านล่างแสดงเลขที่ออกในช่วงปิดนี้ให้แล้ว</p>
            <p className="mt-1 text-xs">เลขที่ออกใน {near.length} วันที่เปิดใกล้เคียง: {DIG.map((d) => ({ d, n: near.filter((x) => x.digits.includes(d)).length })).sort((a, b) => b.n - a.n).map((x) => `${x.d} (${x.n})`).join(" · ")}</p>
          </div>
        ) : <p className="text-xs text-slate-400">ข้อมูลยังไม่พอ</p>)}
      </form>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left">% {kindUsed === "open" ? "เปิด" : "ปิด"}</th>
              <th className="px-2 py-2 text-right">วัน</th>
              {DIG.map((d) => <th key={d} className="px-1.5 py-2 text-center font-mono text-sm text-slate-700">{d}</th>)}
              <th className="px-2 py-2 text-left">ทุกวันในช่วงนี้: ดัชนี · เปลี่ยน · % · ผล (กดเพื่อดู)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.b} className={r.list.length ? "" : "text-slate-300"}>
                <td className="px-2 py-1 whitespace-nowrap font-medium tabular-nums">{fmtP(r.b, step)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{r.list.length}</td>
                {cells(r.list)}
                <td className="px-2 py-1 text-xs">{r.list.length ? (
                  <details open={r.list.length <= 20}>
                    <summary className="cursor-pointer font-mono text-slate-500">{r.list.slice(0, 5).map((x) => `${x.top}/${x.bottom}`).join("  ")}{r.list.length > 5 ? `  +${r.list.length - 5}` : ""}</summary>
                    <table className="mt-1 text-[11px] tabular-nums">
                      <tbody>{r.list.map((x) => (
                        <tr key={x.date} className="text-slate-600">
                          <td className="pr-3 whitespace-nowrap text-slate-400">{x.date}</td>
                          <td className="pr-3 text-right whitespace-nowrap">ดัชนี {fmtNum(x.close)}</td>
                          <td className={`pr-3 text-right whitespace-nowrap ${x.change < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtChange(x.change)}</td>
                          <td className={`pr-3 text-right whitespace-nowrap ${x.closePct < 0 ? "text-red-600" : "text-emerald-600"}`}>{x.closePct > 0 ? "+" : ""}{x.closePct.toFixed(2)}%</td>
                          {x.openPct !== null && <td className="pr-3 text-right whitespace-nowrap text-slate-400">เปิด {x.openPct > 0 ? "+" : ""}{x.openPct.toFixed(2)}%</td>}
                          <td className="font-mono font-semibold text-slate-800">{x.top}/{x.bottom}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </details>
                ) : null}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td className="px-2 py-1 font-semibold">รวมช่วงนี้</td>
              <td className="px-2 py-1 text-right font-semibold tabular-nums">{inRange.length}</td>
              {cells(inRange, true)}
              <td className="px-2 py-1 text-xs text-slate-500">เลขที่ออกบ่อยสุด: {inRange.length ? [...DIG].sort((a, b) => rate(inRange, b) - rate(inRange, a)).slice(0, 3).join(" · ") : "–"}</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="px-2 py-1 text-slate-500">ทุกวัน (ค่าปกติ)</td>
              <td className="px-2 py-1 text-right tabular-nums text-slate-500">{base.length}</td>
              {cells(base)}
              <td className="px-2 py-1 text-xs text-slate-400">ใช้เทียบว่าช่วงที่เลือกต่างจากปกติแค่ไหน</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
