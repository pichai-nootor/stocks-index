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
/** ตำแหน่งเอียงจริง (D ลงท้าย 0/9) — วันอื่นทุกตำแหน่ง 10% เท่ากัน ไม่มีอะไรให้ดู */
const leans = (d: DigitDetail) => Math.abs(d.tens - d.units) > 0.02;

export function TwoPickCard({ two, tied, score }: {
  two: TwoPick;
  tied?: PairPick;
  /** ผลย้อนหลังของผู้ใช้ (ถ้ามี) */
  score?: { days: number; pair?: { both: number; any: number }; tied?: { both: number; any: number }; single?: number };
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-800">ฟันเลข 2 ตัว + สำรอง 2 ตัว</p>
        <p className="text-sm text-slate-700">
          โผล่อย่างน้อย 1 ตัว: 2 ตัว <span className="font-semibold">{pct(two.pAny)}</span> · 3 ตัว <span className="font-semibold">{pct(two.pAny3)}</span> · 4 ตัว <span className="font-semibold">{pct(two.pAny4)}</span>
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
        {two.digits.map((d, i) => (
          <div key={d.digit} className="flex flex-col items-center">
            <span className={`flex h-20 w-20 items-center justify-center rounded-2xl font-mono text-6xl font-bold shadow ${i === 0 ? "bg-amber-400 text-white" : "bg-amber-200 text-amber-900"}`}>{d.digit}</span>
            <span className="mt-1 text-xs text-slate-500">{i === 0 ? "ตัวหลัก" : "ตัวรอง"}</span>
          </div>
        ))}
        <span className="mx-1 self-center text-2xl text-amber-300">+</span>
        {[two.third, two.fourth].map((d, i) => (
          <div key={d.digit} className="flex flex-col items-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-white font-mono text-4xl font-bold text-amber-800">{d.digit}</span>
            <span className="mt-1 text-xs text-slate-500">สำรอง {i + 1}</span>
          </div>
        ))}
        <p className="ml-2 self-center text-xs text-slate-500">10 ปี: 2 ตัว 63% · 3 ตัว 82% · 4 ตัว 94% (สุ่ม 59 / 71 / 87%)</p>
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
