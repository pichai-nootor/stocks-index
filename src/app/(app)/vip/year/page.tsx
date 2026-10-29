import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { todayThai } from "@/lib/intraday";
import { STAKES, parseStake, BET } from "@/lib/bet";
import { vipYear, type Money } from "@/lib/vip-year";

const shift = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const baht = (x: number) => `${x > 0 ? "+" : ""}${Math.round(x).toLocaleString("th-TH")}`;
const tone = (x: number) => (x > 0 ? "text-emerald-600" : x < 0 ? "text-rose-600" : "text-slate-400");
const back = (m: Money) => (m.cost ? `${((100 * m.win) / m.cost).toFixed(0)}` : "—");
const monthLabel = (m: string) => new Date(`${m}-01`).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });

/**
 * สรุปหุ้น VIP ทั้งปี (ผู้ใช้ขอ 29 ต.ค. 69) — 12 เดือนล่าสุดถึงวันนี้
 *   ผลจริง (ล็อกก่อนผลออก) = เชื่อได้ · ย้อนหลังด้วยสูตรปัจจุบัน = สูงเกินจริง (สูตรปรับจากข้อมูลชุดนี้) ดูแนวโน้มเท่านั้น
 */
export default async function VipYearPage({ searchParams }: PageProps<"/vip/year">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stake = parseStake(sp.stake);
  const to = todayThai(), from = shift(to, -365);
  const y = await vipYear(userId, from, to, stake);
  const href = (s: number) => `/vip/year${s !== BET.stake ? `?stake=${s}` : ""}`;
  const counted = y.markets.filter((m) => m.counted), skipped = y.markets.filter((m) => !m.counted);
  const monthTotal = (k: string, which: "retro" | "real") => counted.reduce((a, m) => a + (m[which].months.get(k) ?? 0), 0);
  const realMonths = y.months.filter((k) => counted.some((m) => m.real.months.has(k)));
  const retroMonths = y.months.map((k) => monthTotal(k, "retro"));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">หุ้น VIP · สรุปทั้งปี</h1>
        <span className="text-sm text-slate-500">{new Date(from).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })} – {new Date(to).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span>
        <Link href="/vip" className="btn-ghost ml-auto">← หุ้น VIP</Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-slate-500">ลงทุนเลขละ</span>
        {STAKES.map((s) => (
          <Link key={s} href={href(s)} className={`rounded-md border px-2.5 py-0.5 tabular-nums ${s === stake ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>{s}</Link>
        ))}
        <span className="text-slate-500">บาท · รูดเลขฟัน 2 ตัว + เจาะ 12 ตัว ต่องวด</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card border-emerald-200">
          <div className="text-xs text-slate-500">✅ ผลจริง (เลขที่ล็อกไว้ก่อนผลออก) · เชื่อได้</div>
          <div className={`text-3xl font-semibold tabular-nums ${tone(y.real.win - y.real.cost)}`}>{baht(y.real.win - y.real.cost)} <span className="text-base font-normal">บาท</span></div>
          <div className="text-xs text-slate-600">{y.real.n} งวด · ซื้อ {y.real.cost.toLocaleString("th-TH")} · ได้ {y.real.win.toLocaleString("th-TH")} · ซื้อ 100 ได้คืน {back(y.real)}</div>
          <div className="mt-1 text-xs text-slate-400">เริ่มล็อกเลขจริง {realMonths[0] ? monthLabel(realMonths[0]) : "—"} — ยิ่งเก็บนานยิ่งเชื่อได้</div>
        </div>
        <div className="card border-amber-200">
          <div className="text-xs text-slate-500">⚠️ ถ้าใช้สูตรตอนนี้เล่นย้อนหลังทั้งปี · สูงเกินจริง</div>
          <div className={`text-3xl font-semibold tabular-nums ${tone(y.retro.win - y.retro.cost)}`}>{baht(y.retro.win - y.retro.cost)} <span className="text-base font-normal">บาท</span></div>
          <div className="text-xs text-slate-600">{y.retro.n} งวด · ซื้อ {y.retro.cost.toLocaleString("th-TH")} · ได้ {y.retro.win.toLocaleString("th-TH")} · ซื้อ 100 ได้คืน {back(y.retro)} · เดือนที่เสีย {retroMonths.filter((x) => x < 0).length}/{retroMonths.length}</div>
          <div className="mt-1 text-xs text-amber-700">สูตรถูกปรับจากข้อมูลชุดนี้เอง เหมือนรู้คำตอบก่อนสอบ — ใช้ดูว่าหุ้นไหนแนวโน้มดี อย่าคาดว่าจะได้เท่านี้จริง</div>
        </div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-medium">แยกตามหุ้น</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left">หุ้น</th>
              <th className="px-2 py-1.5 text-right">ผลจริง งวด</th>
              <th className="px-2 py-1.5 text-right">ผลจริง ได้/เสีย</th>
              <th className="px-2 py-1.5 text-right">ย้อนหลัง งวด</th>
              <th className="px-2 py-1.5 text-right">ย้อนหลัง ได้/เสีย</th>
              <th className="px-2 py-1.5 text-right">ซื้อ 100 คืน</th>
              <th className="px-2 py-1.5 text-right">เดือนที่เสีย</th>
              <th className="px-2 py-1.5 text-right">เสียสะสมหนักสุด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...counted, ...skipped].map((m) => {
              const ms = [...m.retro.months.values()];
              return (
                <tr key={m.code} className={m.counted ? "" : "text-slate-400"}>
                  <td className="px-2 py-1"><Link href={`/vip?market=${m.code}`} className="text-blue-700 hover:underline">{m.label}</Link>{!m.counted && <span className="ml-1 text-xs">(ไม่นับในรายงาน)</span>}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.real.n || "—"}</td>
                  <td className={`px-2 py-1 text-right font-medium tabular-nums ${m.real.n ? tone(m.real.win - m.real.cost) : ""}`}>{m.real.n ? baht(m.real.win - m.real.cost) : "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.retro.n}</td>
                  <td className={`px-2 py-1 text-right tabular-nums ${tone(m.retro.win - m.retro.cost)}`}>{baht(m.retro.win - m.retro.cost)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{back(m.retro)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{ms.filter((x) => x < 0).length}/{ms.length}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-rose-600">{m.retro.drawdown ? `−${Math.round(m.retro.drawdown).toLocaleString("th-TH")}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 font-semibold">
            <tr>
              <td className="px-2 py-1.5">รวม {counted.length} หุ้นที่นับ</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{y.real.n}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${tone(y.real.win - y.real.cost)}`}>{baht(y.real.win - y.real.cost)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{y.retro.n}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${tone(y.retro.win - y.retro.cost)}`}>{baht(y.retro.win - y.retro.cost)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{back(y.retro)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-slate-500">ผลจริง = นับเฉพาะงวดที่ระบบล็อกเลขไว้ก่อนผลออก · ย้อนหลัง = เอาสูตรตอนนี้ไปคิดทุกงวดย้อนหลัง (สูงเกินจริง) · หุ้นสีเทาไม่นับในรวม (อินเดีย VIP ยังเก็บสถิติ · อังกฤษ VIP เอาออกจากรายงาน)</p>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-medium">รายเดือน (รวม {counted.length} หุ้นที่นับ)</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left">เดือน</th>
              {counted.map((m) => <th key={m.code} className="px-2 py-1.5 text-right">{m.label.replace(/^หุ้น/, "").replace(/ VIP$/, "")}</th>)}
              <th className="px-2 py-1.5 text-right">รวมย้อนหลัง</th>
              <th className="px-2 py-1.5 text-right">รวมผลจริง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...y.months].reverse().map((k) => {
              const r = monthTotal(k, "retro"), real = monthTotal(k, "real"), hasReal = counted.some((m) => m.real.months.has(k));
              return (
                <tr key={k}>
                  <td className="px-2 py-1">{monthLabel(k)}</td>
                  {counted.map((m) => { const v = m.retro.months.get(k); return <td key={m.code} className={`px-2 py-1 text-right text-xs tabular-nums ${v === undefined ? "" : tone(v)}`}>{v === undefined ? "" : baht(v)}</td>; })}
                  <td className={`px-2 py-1 text-right font-medium tabular-nums ${tone(r)}`}>{baht(r)}</td>
                  <td className={`px-2 py-1 text-right font-semibold tabular-nums ${hasReal ? tone(real) : ""}`}>{hasReal ? baht(real) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">ช่องรายหุ้นและ “รวมย้อนหลัง” = คิดย้อนหลังด้วยสูตรตอนนี้ · “รวมผลจริง” = เลขที่ล็อกไว้จริง (มีเฉพาะเดือนที่เริ่มล็อกแล้ว)</p>
      </section>
    </div>
  );
}
