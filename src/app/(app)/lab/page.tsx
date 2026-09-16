import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { hasClose } from "@/lib/stats";
import { TERMS, OPS, evaluateRule, SENSEX_10Y, type Term, type Op } from "@/lib/lab";
import { Digits } from "@/components/digit-badges";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** ทดลองสูตรจากตัวเปิดด้วยตัวเอง: เลือกตำแหน่ง + วิธีคิด → เห็นทันทีว่าย้อนหลังถูกกี่ % เทียบสุ่ม */
export default async function LabPage({ searchParams }: PageProps<"/lab">) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const stocks = await prisma.stock.findMany({ where: { userId }, include: { records: { orderBy: { date: "asc" } } }, orderBy: { symbol: "asc" } });
  const stockId = typeof sp.stock === "string" && stocks.some((s) => s.id === sp.stock) ? sp.stock : stocks[0]?.id ?? "";
  const stock = stocks.find((s) => s.id === stockId);
  const own = stock ? stock.records.filter(hasClose) : [];

  const termKeys = Object.keys(TERMS) as Term[];
  const rawTerms = sp.t; const picked = (Array.isArray(rawTerms) ? rawTerms : rawTerms ? [rawTerms] : []).filter((t): t is Term => termKeys.includes(t as Term));
  const op = (typeof sp.op === "string" && sp.op in OPS ? sp.op : "pick") as Op;
  const ran = picked.length > 0;
  const resOwn = ran ? evaluateRule(picked, op, own) : null;
  const res10 = ran ? evaluateRule(picked, op, SENSEX_10Y) : null;

  const verdict = (r: { rate: number; random: number; n: number }) => {
    const se = Math.sqrt((r.random * (1 - r.random)) / Math.max(r.n, 1));
    const z = (r.rate - r.random) / (se || 1);
    return z >= 3 ? { text: "เหนือสุ่มชัดเจน", cls: "bg-emerald-100 text-emerald-800" } : z >= 2 ? { text: "อาจเหนือสุ่ม (ยังไม่ชัด)", cls: "bg-amber-100 text-amber-800" } : z <= -3 ? { text: "แย่กว่าสุ่ม" , cls: "bg-red-100 text-red-800" } : { text: "เท่าสุ่ม", cls: "bg-slate-100 text-slate-600" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ทดลองสูตรจากตัวเปิด</h1>
        <p className="mt-1 text-sm text-slate-500">ประกอบสูตรเอง → ระบบวัดกับประวัติของคุณและ SENSEX 10 ปี (2,462 วัน) ทันที · เกณฑ์: ต้องชนะ “สุ่มเลขจำนวนเท่ากัน” อย่างมีนัย ถึงจะเรียกว่าสูตรใช้ได้</p>
      </div>

      <form method="get" className="card space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor="stock">ข้อมูลของคุณ</label>
            <select id="stock" name="stock" className="input w-auto" defaultValue={stockId}>{stocks.map((s) => <option key={s.id} value={s.id}>{s.symbol}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="op">วิธีคิด</label>
            <select id="op" name="op" className="input w-auto" defaultValue={op}>{(Object.keys(OPS) as Op[]).map((k) => <option key={k} value={k}>{OPS[k]}</option>)}</select>
          </div>
          <button className="btn-primary">วัดผล</button>
        </div>
        <div>
          <p className="label">เลือกตำแหน่งของตัวเปิด (เลือกได้หลายอัน)</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {termKeys.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name="t" value={k} defaultChecked={picked.includes(k)} /> {TERMS[k]}</label>
            ))}
          </div>
        </div>
      </form>

      {ran && resOwn && res10 && (
        <div className="grid gap-4 md:grid-cols-2">
          {[{ title: `ข้อมูลของคุณ (${stock?.symbol ?? "-"})`, r: resOwn }, { title: "SENSEX 10 ปี", r: res10 }].map(({ title, r }) => {
            const v = verdict(r);
            return (
              <section key={title} className="card space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-medium">{title}</h2>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.text}</span>
                </div>
                {r.n === 0 ? <p className="text-sm text-slate-500">ไม่มีวันที่คำนวณได้</p> : (
                  <>
                    <p className="text-3xl font-semibold">{pct(r.rate)} <span className="text-base font-normal text-slate-500">ถูก {r.hits}/{r.n} วัน</span></p>
                    <p className="text-sm text-slate-600">สุ่มเลขจำนวนเท่ากัน ({r.avgDigits.toFixed(1)} เลข/วัน) ≈ <span className="font-semibold">{pct(r.random)}</span> · ครึ่งแรก {pct(r.firstHalf)} / ครึ่งหลัง {pct(r.secondHalf)}</p>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600">10 วันล่าสุด</summary>
                      <table className="mt-2 w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                          {r.recent.map((x) => (
                            <tr key={x.date.toISOString()}>
                              <td className="py-1 pr-3 whitespace-nowrap">{x.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                              <td className="py-1 pr-3">สูตรให้ <Digits value={x.predicted.join("")} hilite={x.predicted.filter((d) => x.actual.includes(d))} /></td>
                              <td className="py-1 pr-3">ปิด <Digits value={x.actual.join("")} tone="blue" hilite={x.predicted.filter((d) => x.actual.includes(d))} /></td>
                              <td className="py-1">{x.hit ? <span className="text-emerald-700">✓</span> : <span className="text-red-600">✗</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className="card text-sm text-slate-600">
        <p className="font-medium text-slate-800">วิธีอ่านผล</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>เลือก 1 เลขแล้วโผล่ ~34.5% คือสุ่ม · เลือก 2 เลข ~59% · 3 เลข ~71% · 4 เลข ~82% — สูตรต้อง<b>สูงกว่าตัวเลขสุ่มของจำนวนเลขเท่ากัน</b> ไม่ใช่แค่ “ดูถูกบ่อย”</li>
          <li>ดู “ครึ่งแรก / ครึ่งหลัง” ของ 10 ปีด้วย: สูตรจริงต้องได้ใกล้เคียงกันทั้งสองครึ่ง ถ้าครึ่งหนึ่งสูงอีกครึ่งต่ำ = โชค</li>
          <li>ข้อมูลของคุณ (ไม่ถึง 100 วัน) แกว่ง ±10% ได้ง่าย ใช้ 10 ปีเป็นตัวตัดสิน</li>
        </ul>
      </section>
    </div>
  );
}
