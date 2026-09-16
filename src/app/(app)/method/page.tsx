import Link from "next/link";
import { LIVE_CHECKPOINTS } from "@/lib/intraday";
import { DIRECTION_TIERS } from "@/lib/stats";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * หน้าอธิบายวิธีคิด + หลักฐานจากการทดสอบ (BSE SENSEX 10 ปี 2016-09 → 2026-09, 2,462 วัน)
 * ตัวเลขในหน้านี้มาจากสคริปต์ทดสอบ ณ 2026-09-16 — เป็นค่าคงที่ ไม่ได้คำนวณสด
 */
export default function MethodPage() {
  return (
    <div className="prose-sm max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">วิธีคิด และสิ่งที่ข้อมูลบอก</h1>
        <p className="mt-1 text-sm text-slate-500">ทดสอบกับ BSE SENSEX รายวัน 10 ปี (2,462 วัน) และรายชั่วโมง 2 ปี (718 วัน) · อัปเดต 16 ก.ย. 2569</p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-medium">1. โครงสร้างของเลข — สิ่งเดียวที่ “รู้ได้” ตั้งแต่เช้า</h2>
        <p className="text-sm">2 ตัวล่าง = ทศนิยมของ (ปิด − ปิดวันก่อน) ดังนั้น <span className="font-mono">ล่าง = (บน − D)</span> ถ้าปิดขึ้น หรือ <span className="font-mono">(D − บน)</span> ถ้าปิดลง (mod 100) โดย D = ทศนิยมปิดวันก่อน ซึ่งรู้ตั้งแต่เช้า ตรวจกับประวัติแล้วตรง 100% ทุกวัน</p>
        <p className="text-sm">ฉะนั้นทั้งวันมีตัวไม่รู้แค่ตัวเดียวคือ <b>บน (00–99)</b> ระบบไล่ทุกกรณี 100 ค่า × 2 ทิศทาง แล้วนับว่าเลข 0–9 โผล่กี่ % — เลขที่ได้ ~36% สูงสุด, ~34% ต่ำสุด และวันส่วนใหญ่เสมอกัน 6–8 ตัว</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">2. เลขเปิดบอกเลขปิดได้ไหม — ทดสอบแล้ว: ไม่</h2>
        <p className="text-sm">chi-square ของตาราง 10×10 (เลขในตำแหน่งเปิด → เลขในตำแหน่งปิด) df=81 ถ้าอิสระต่อกันจะได้ ≈ 81 ± 13, เกิน 113 ถึงจะถือว่ามีความสัมพันธ์</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-4">เปิด →</th><th className="py-1 pr-4 text-right">ปิดบน หลักสิบ</th><th className="py-1 text-right">ปิดบน หลักหน่วย</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[["เปิดบน หลักสิบ", 68, 66], ["เปิดบน หลักหน่วย", 92, 108], ["เปิดล่าง หลักสิบ", 72, 84], ["เปิดล่าง หลักหน่วย", 77, 78], ["D หลักสิบ", 71, 81], ["D หลักหน่วย", 86, 73]].map(([n, a, b]) => (
                <tr key={String(n)}><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right">{a}</td><td className="py-1 text-right">{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>ปิดบน = เปิดบน เป๊ะ 0.8% (สุ่ม 1%) · ปิดบน = ปิดบนเมื่อวาน 0.9% (สุ่ม 1%)</li>
          <li>เลขในตำแหน่งใดของเปิด ไปโผล่ตอนปิด 33.5–35.1% ทุกตำแหน่ง (ค่าเฉลี่ยรวม 34.5%) — ไม่มีตำแหน่ง “มาปิด” พิเศษ</li>
          <li>ทศนิยมปิด 00–99 สม่ำเสมอ (chi² 119, df=99) เลขที่ออกบ่อยสุด 10 ปี คือ 15, 84, 08 ออก 36–37 ครั้ง จากคาดหวัง 24.6 — ระดับที่เกิดได้จากสุ่ม</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">3. ให้เครื่องเรียนรู้จากข้อมูลเอง ก็ได้เท่าสุ่ม</h2>
        <p className="text-sm">โมเดลที่เรียนจาก 8 ปีแรก (เลขเปิดทุกตำแหน่ง + D + เลขเด้ง + เลขร้อน) แล้วทดสอบ 2 ปีหลัง 500 วัน:</p>
        <table className="w-full text-sm tabular-nums">
          <tbody className="divide-y divide-slate-100">
            <tr><td className="py-1 pr-4">โมเดลเรียนรู้จากข้อมูล</td><td className="py-1 text-right">ตัวเดียว 34.6% · 2 ตัว ≥1 60.0%</td></tr>
            <tr><td className="py-1 pr-4">โมเดลโครงสร้าง (D + ทิศทาง) ที่ใช้อยู่</td><td className="py-1 text-right font-semibold">ตัวเดียว 38.2% · 2 ตัว ≥1 61.0%</td></tr>
            <tr><td className="py-1 pr-4">สุ่ม</td><td className="py-1 text-right text-slate-500">ตัวเดียว 34.6% · 2 ตัว ≥1 59%</td></tr>
          </tbody>
        </table>
        <p className="text-sm">กฎตัดสินเสมอ 8 แบบ (เลขน้อยก่อน / มากก่อน / ร้อน / เย็น / เด้ง / อยู่ในเปิด / หมุนตามวัน / ตาม D) ได้ 34.6–36.4% เท่ากันหมดบน 10 ปี — ในตัวอย่าง 74 วันแกว่ง 25–47% ตามโชค</p>
        <p className="text-sm font-medium">สรุป: เลขเดี่ยว 36% คือเพดาน · ที่เอาชนะสุ่มได้จริงคือ <b>คู่ผูก</b> (มาทั้งคู่ 18% เทียบสุ่ม 10%) และ <b>2 ตัว ≥1</b> (63% เทียบ 59%) เพราะใช้โครงสร้าง ล่าง = บน ∓ D</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">3b. ค้นสูตรจากเลขเปิดแบบหว่านแห 127 สูตร (16 ก.ย. 2569)</h2>
        <p className="text-sm">ทุกตำแหน่งของเลขเปิดและ D, บวก/ลบ/คูณกันทุกคู่และทุกสาม (mod 10), ผลรวมหลัก, หลักหน่วย/สิบ/ร้อยของดัชนี, จำนวนจุดที่เปลี่ยน, เลขร้อน/เย็น 5–100 วัน, เลขหายนาน, เลขเด้ง, ฟันเลขเดิมตลอด — วัดบน 10 ปี แยกครึ่งแรก/ครึ่งหลังกันโชค</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-4">สูตร</th><th className="py-1 pr-4 text-right">5 ปีแรก</th><th className="py-1 pr-4 text-right">5 ปีหลัง</th><th className="py-1 text-right">10 ปี</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[["ฟัน 1 ตลอด (ดีสุด)", "37.9", "37.4", "37.7"], ["(บนสิบ+ล่างสิบ+ล่างหน่วย) mod 10", "36.6", "36.1", "36.4"], ["เลขร้อน 50 วัน", "36.3", "35.7", "36.0"], ["โมเดลโครงสร้าง D+ทิศทาง (ที่ใช้)", "33.5", "38.3", "35.9"], ["ตำแหน่งเลขเปิดตรง ๆ (ทุกตำแหน่ง)", "33–37", "33–36", "34.5–35.1"], ["ฟัน 5 ตลอด (แย่สุด)", "31.7", "31.9", "31.8"]].map(([n, a, b, c]) => (
                <tr key={n}><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right">{a}%</td><td className="py-1 pr-4 text-right">{b}%</td><td className="py-1 text-right font-semibold">{c}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>สุ่ม = 34.5% · ทดสอบ 127 สูตร ค่าสูงสุดที่เกิดจากโชคล้วนคาดไว้ ≈ 36.9% → มีแค่ “ฟัน 1 ตลอด” ที่โผล่พ้นเส้นนิดเดียว (เลข 1 อยู่ในทศนิยมปิดของ SENSEX 10.8% แทน 10%) แต่ในข้อมูลของคุณ 74 วันได้ 33.8% — ไม่พอจะเอามาใช้</li>
          <li>สูตรที่ดีสุดใน 74 วันของคุณคือ (บนสิบ+ล่างหน่วย+Dหน่วย) mod 10 = 44.6% แต่บน 10 ปีได้ 35.9% — ตัวอย่างเล็กหลอกได้เสมอ</li>
          <li>ลองให้โมเดลโครงสร้างเรียน “ความถี่ทศนิยมปิดของหุ้นตัวนี้” แทนสมมติสม่ำเสมอ (ปรับตามหุ้นแต่ละตัว): 36.3–36.5% เท่าเดิม</li>
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">4. ส่วนที่ทายได้จริง: ทิศทางปิด</h2>
        <p className="text-sm">จากค่าเปิด (เทียบปิดวันก่อน, 10 ปี):</p>
        <p className="text-sm">{DIRECTION_TIERS.map((t) => `≥${t.minPct}%: เปิดบวก ${pct(t.up)} / เปิดลบ ${pct(t.down)}`).join(" · ")}</p>
        <p className="text-sm text-slate-600">เปิดลบเชื่อถือได้กว่าเปิดบวกทุกช่วง — SENSEX มีแนวโน้มไหลลงระหว่างวัน เปิดบวกเล็กน้อยจึงโดนขายจนปิดลบบ่อยกว่าทางกลับ</p>
        <p className="text-sm">จากราคาระหว่างวัน (2 ปี) — ยิ่งสาย + ยิ่งห่าง ยิ่งแม่น:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-4">เวลาไทย</th>{[...LIVE_CHECKPOINTS[0].tiers].reverse().map((t) => <th key={t.minPct} className="py-1 text-right">≥{t.minPct}%</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {LIVE_CHECKPOINTS.map((c) => <tr key={c.ist}><td className="py-1 pr-4">{c.thai}</td>{[...c.tiers].reverse().map((t) => <td key={t.minPct} className={`py-1 text-right ${t.rate >= 0.85 ? "font-semibold text-emerald-700" : ""}`}>{pct(t.rate)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-600">ต้องฟันก่อน 16:30 น. ไทย → จุดสุดท้ายที่ใช้ได้คือ 15:45 น. (ห่าง ≥0.25% → 97%, 0.1–0.25% → 79%) แถว 16:45 มีไว้อ้างอิงเท่านั้น</p>
        <p className="text-sm text-slate-600">ทิศทางที่แม่นขึ้นไม่ช่วยเรื่องเลข (ต่อให้รู้ทิศทาง 100% เลขเดี่ยวก็ 35.5%) แต่ใช้ฟันบวก/ลบได้เกือบทุกวัน — ดู <Link href="/dashboard" className="text-blue-600 hover:underline">หน้าแรก</Link></p>
      </section>
    </div>
  );
}
