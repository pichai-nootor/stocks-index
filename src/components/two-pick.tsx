import { pairLevel, PAIR_BASE, type DigitDetail, type PairPick, type TwoPick } from "@/lib/digits";

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
export function TwoPickCard({ two, tied, score }: {
  two: TwoPick;
  tied?: PairPick;
  /** ผลย้อนหลังของผู้ใช้ (ถ้ามี) */
  score?: { days: number; pair?: { both: number; any: number }; tied?: { both: number; any: number }; single?: number };
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-800">ฟันเลข 2 ตัว (จากเลขเดี่ยว)</p>
        <p className="text-xs text-slate-600">
          อย่างน้อย 1 ใน 2 โผล่ <span className="font-semibold">{pct(two.pAny)}</span> · มาทั้งคู่ {pct(two.pBoth)}
          {score?.pair && <span className="text-slate-400"> · ของคุณ {score.days} วัน: ≥1 {pct(score.pair.any)} · ครบ {pct(score.pair.both)}</span>}
        </p>
      </div>
      {two.tiedWithMain.length > 1 && (
        <p className="mt-1 text-xs text-slate-600">
          วันนี้เสมอกัน {two.tiedWithMain.length} ตัว: <span className="font-mono font-semibold">{two.tiedWithMain.join(" ")}</span> ทุกตัว {pct(two.digits[0].p)} เท่ากันเป๊ะ
          — ตัวหลักเลือกเลขมากสุดในกลุ่ม ตัวอื่นในกลุ่มโอกาสเท่ากัน
        </p>
      )}
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {two.digits.map((d, i) => (
          <div key={d.digit} className={`flex gap-3 rounded-xl border p-3 ${i === 0 ? "border-amber-300 bg-amber-50" : "border-amber-200 bg-white"}`}>
            <div className="flex flex-col items-center">
              <span className={`flex h-16 w-16 items-center justify-center rounded-2xl font-mono text-5xl font-bold shadow ${i === 0 ? "bg-amber-400 text-white" : "bg-amber-200 text-amber-900"}`}>{d.digit}</span>
              <span className="mt-1 text-xs text-slate-500">{i === 0 ? "ตัวหลัก" : "ตัวรอง"}</span>
              <span className="text-sm font-semibold">โผล่ {pct(d.p)}</span>
            </div>
            <div className="flex-1"><PositionTable d={d} /></div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-amber-200 px-3 py-2 text-sm">
        <span className="text-xs uppercase tracking-wide text-amber-800">ตัวสำรอง</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300 bg-white font-mono text-2xl font-bold text-amber-900">{two.third.digit}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-white font-mono text-2xl font-bold text-amber-700">{two.fourth.digit}</span>
        <span className="text-slate-700">
          ฟัน 3 ตัว (หลัก+รอง+{two.third.digit}) โผล่ ≥1 <span className="font-semibold">{pct(two.pAny3)}</span> <span className="text-slate-400">(10 ปี 82% · สุ่ม 71%)</span>
          {" "}· ฟัน 4 ตัว (+{two.fourth.digit}) <span className="font-semibold">{pct(two.pAny4)}</span> <span className="text-slate-400">(10 ปี 94% · สุ่ม 87%)</span>
        </span>
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
