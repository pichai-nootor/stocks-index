import { pairLevel, PAIR_BASE, DRILL_BASE, DRILL_PER_DIGIT, dayStrength, type DigitDetail, type PairPick, type TwoPick } from "@/lib/digits";

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;

/** ตำแหน่งที่เลขนี้จะมา: บน/ล่าง × สิบ/หน่วย และสรุปว่า "ถ้ามา" อยู่หลักไหน */
function PositionTable({ d }: { d: DigitDetail }) {
  const lean = d.tens - d.units;
  return (
    <div className="text-xs">
      <table className="w-full tabular-nums">
        <thead className="text-slate-400">
          <tr><th className="text-left font-normal"></th><th className="text-right font-normal">หลักสิบ</th><th className="text-right font-normal">หลักหน่วย</th></tr>
        </thead>
        <tbody>
          <tr><td className="text-slate-500">บน</td><td className="text-right">{pct(d.pos.topTens)}</td><td className="text-right">{pct(d.pos.topUnits)}</td></tr>
          <tr><td className="text-slate-500">ล่าง</td><td className="text-right">{pct(d.pos.botTens)}</td><td className="text-right">{pct(d.pos.botUnits)}</td></tr>
          <tr className="border-t border-slate-200 font-semibold">
            <td className="text-slate-600">รวม</td>
            <td className={`text-right ${lean > 0.02 ? "text-emerald-700" : ""}`}>{pct(d.tens)}</td>
            <td className={`text-right ${lean < -0.02 ? "text-emerald-700" : ""}`}>{pct(d.units)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-slate-600">
        ถ้ามา → หลักสิบ <span className="font-semibold">{pct(d.givenTens)}</span> · หลักหน่วย <span className="font-semibold">{pct(d.givenUnits)}</span>
        {Math.abs(lean) <= 0.02 && <span className="text-slate-400"> (ไม่เอียง)</span>}
      </p>
    </div>
  );
}

/** ฟัน 2 ตัวจากเลขเดี่ยว พร้อม % ต่อตำแหน่ง — ใช้ทั้งการ์ดวันนี้และหน้าวิเคราะห์ */
/** ตำแหน่งเอียงจริง (D ลงท้าย 0/9) — วันอื่นทุกตำแหน่ง 10% เท่ากัน ไม่มีอะไรให้ดู */
const leans = (d: DigitDetail) => Math.abs(d.tens - d.units) > 0.02;

export function TwoPickCard({ two, tied, score, open }: {
  two: TwoPick;
  tied?: PairPick;
  /** เลขเปิดของวัน (บน 2 / ล่าง 2) — ใช้ตัดสิน "★ มีโอกาสเบิ้ล" (หลักสิบ+หน่วย = 10) แสดงเฉพาะวันที่เข้าเงื่อนไข */
  open?: { top: string; bottom: string };
  /** ผลย้อนหลังของผู้ใช้ (ถ้ามี) */
  score?: { days: number; pair?: { both: number; any: number }; tied?: { both: number; any: number }; single?: number; drill?: { set: number; any: number } };
}) {
  const ds = dayStrength(two.digits[0].p);
  const dsCls = ds.level === "แข็ง" ? "bg-emerald-100 text-emerald-800" : ds.level === "อ่อน" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600";
  return (
    <div>
      <div className={`mb-2 rounded-md px-3 py-1.5 text-sm ${dsCls}`}>
        วันนี้: <span className="font-semibold">วัน{ds.level}</span> สำหรับเลขเดี่ยว (เลขเด่นมีโอกาส {pct(ds.p, 1)}) — {ds.hint}
      </div>
      {/* ★ มีโอกาสเบิ้ล: ขึ้นเฉพาะวันที่เลขเปิด (บนหรือล่าง) หลักสิบ+หน่วย = 10 และปิดวันก่อนไม่เบิ้ล (10 ปี ~24% เทียบปกติ 19%) — วันอื่นไม่บอก */}
      {open && two.pDouble >= 0.15 && (() => {
        const sum = (x: string) => Number(x[0]) + Number(x[1]);
        const hit = sum(open.top) === 10 ? `บน ${open.top[0]}+${open.top[1]}` : sum(open.bottom) === 10 ? `ล่าง ${open.bottom[0]}+${open.bottom[1]}` : null;
        return hit ? <div className="mb-2 rounded-md bg-violet-100 px-3 py-1.5 text-sm text-violet-800"><span className="font-semibold">★ วันนี้มีโอกาสเบิ้ล</span> <span className="text-xs">(เลขเปิด{hit} = 10 · 10 ปี ~24%)</span></div> : null;
      })()}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-800">ฟันเลข 2 ตัว</p>
        <p className="text-sm text-slate-700">
          โผล่อย่างน้อย 1 ตัว <span className="font-semibold">{pct(two.pAny)}</span>
          {score?.pair && <span className="text-xs text-slate-400"> · ของคุณ {score.days} วัน: 2 ตัว {pct(score.pair.any)}</span>}
        </p>
      </div>
      {two.tiedWithMain.length > 1 && (
        <p className="mt-1 text-xs text-slate-600">
          วันนี้เสมอกัน {two.tiedWithMain.length} ตัว: <span className="font-mono font-semibold">{two.tiedWithMain.join(" ")}</span> ทุกตัว {pct(two.digits[0].p)} เท่ากันเป๊ะ
          — ตัวหลักเลือกเลขมากสุดในกลุ่ม ตัวอื่นในกลุ่มโอกาสเท่ากัน
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {two.digits.map((d) => {
          const star = d.digit === two.standout.digit;
          return (
            <div key={d.digit} className="flex flex-col items-center">
              <span className={`relative flex h-20 w-20 items-center justify-center rounded-2xl font-mono text-6xl font-bold shadow ${star ? "bg-amber-400 text-white ring-4 ring-amber-300" : "bg-amber-200 text-amber-900"}`}>
                {d.digit}
                {star && <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">★</span>}
              </span>
              <span className={`mt-1 text-xs ${star ? "font-semibold text-red-600" : "text-slate-500"}`}>{star ? "ตัวเด่น" : "ตัวคู่"}</span>
            </div>
          );
        })}
        <p className="ml-2 self-center text-xs text-slate-500">
          10 ปี: 2 ตัว ≥1 = 63% (สุ่ม 59%)<br />
          ★ ตัวเด่น = ตัวที่โผล่บ่อยกว่าในประวัติ (ฐาน 10 ปี + หุ้นนี้: {pct(two.standoutRate, 1)})
        </p>
      </div>
      {two.digits.some(leans) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {two.digits.map((d) => (
            <div key={d.digit} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="mb-1 text-xs font-medium text-emerald-800">วันนี้เลข {d.digit} เอียงไปหลัก{d.tens > d.units ? "สิบ" : "หน่วย"} (D ลงท้าย 0/9)</p>
              <PositionTable d={d} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800">เลขเจาะ <span className="font-normal normal-case text-slate-500">— เลข 2 ตัว ชุดละ {DRILL_PER_DIGIT} ตัว กลับได้</span></p>
          <p className="text-xs text-slate-500">
            ทั้ง {DRILL_PER_DIGIT * 2} ตัว มาอย่างน้อย 1 <span className="font-semibold text-slate-700">{pct(two.drill.pAny)}</span>
            {score?.drill && <span className="text-slate-400"> · ของคุณ {score.days} วัน: {pct(score.drill.any)}</span>}
          </p>
        </div>
        <div className="mt-2 space-y-2">
          {two.drill.sets.map((s) => {
            const star = s.digit === two.standout.digit;
            return (
              <div key={s.digit} className="flex flex-wrap items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-lg font-bold ${star ? "bg-amber-400 text-white" : "bg-amber-200 text-amber-900"}`}>{s.digit}</span>
                <span className="text-slate-400">→</span>
                <span className="flex flex-wrap gap-1.5 font-mono text-lg font-semibold text-amber-900">
                  {s.numbers.map((n) => <span key={n.number} className="rounded-md bg-amber-100 px-2 py-0.5">{n.number}</span>)}
                </span>
                <span className="text-xs text-slate-500">ชุดนี้มา {pct(s.pAny)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          10 ปี: ต่อชุด {pct(DRILL_BASE.set10y)} · ทั้งวัน {pct(DRILL_BASE.day10y)} (สุ่ม {pct(DRILL_BASE.setRandom)} / {pct(DRILL_BASE.dayRandom)}) — เลข 2 ตัวทุกตัวมีโอกาส ~4% เท่ากันเมื่อกลับได้ เจาะได้แค่ “ไม่แย่กว่าสุ่ม”
        </p>
      </div>
      {tied && (
        <p className="mt-2 text-xs text-slate-600">
          คู่ผูกกัน (เลือกจากโอกาสมาทั้งคู่): <span className="font-mono text-base font-bold text-amber-900">{tied.pair.join(" ")}</span> มาทั้งคู่ <span className="font-semibold">{pct(tied.pBoth)}</span>
          {" "}<span className="rounded bg-amber-100 px-1 py-0.5 text-amber-900">{pairLevel(tied.pBoth)}</span> · อย่างน้อย 1 {pct(tied.pAny)}
          <span className="text-slate-400"> · 10 ปี {pct(PAIR_BASE.both10y)} · สุ่ม {pct(PAIR_BASE.bothRandom)}{score?.tied ? ` · ของคุณ ครบ ${pct(score.tied.both)}` : ""}</span>
        </p>
      )}
    </div>
  );
}
