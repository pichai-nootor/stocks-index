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
        <p className="mt-1 text-sm text-slate-500">ทดสอบกับ BSE SENSEX รายวัน 10 ปี (2,462 วัน) และรายชั่วโมง 2 ปี (718 วัน) · อัปเดต 18 ก.ย. 2569</p>
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
        <h2 className="font-medium">2b. “จะเอาหลักสิบหรือหลักหน่วยของเปิดมา ตอนไหน?” — ทดสอบตามเงื่อนไข 352 แบบ</h2>
        <p className="text-sm">ดูว่าตำแหน่งไหนของเลขเปิด (บน/ล่าง × สิบ/หน่วย) มาโผล่ตอนปิดบ่อยขึ้น <b>เมื่อ</b> เปิดบวก/ลบ, ห่างกี่ %, วันในสัปดาห์, หลักของ D, หลักของเลขเปิด, ขนาดจุดที่เปลี่ยน, ระดับดัชนี — รวม 352 ช่อง ถ้าไม่มีอะไรจริง ช่องสูงสุดจากโชคล้วนจะอยู่ราว z ≈ 3.0–3.3</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">ตำแหน่งเปิด → มาปิด (%) เมื่อ D ลงท้ายด้วย</th>{[...Array(10)].map((_, k) => <th key={k} className="py-1 text-right">{k}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[["บน หลักสิบ", [32, 36, 37, 34, 31, 35, 35, 29, 36, 30]], ["บน หลักหน่วย", [28, 34, 33, 35, 35, 33, 40, 38, 33, 33]], ["ล่าง หลักสิบ", [27, 35, 31, 37, 37, 35, 36, 35, 37, 34]], ["ล่าง หลักหน่วย", [28, 38, 29, 31, 39, 38, 33, 36, 34, 44]]].map(([name, xs]) => (
                <tr key={String(name)}><td className="py-1 pr-3">{name}</td>{(xs as number[]).map((x, k) => <td key={k} className={`py-1 text-right ${x >= 41 ? "font-semibold text-amber-700" : x <= 29 ? "text-slate-400" : ""}`}>{x}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>ฐาน 34.5% · แต่ละช่อง n≈245 · แกว่ง ±5 คือปกติ · ช่องสูงสุดทั้งการทดสอบ (ล่างหน่วย เมื่อ D ลงท้าย 9 = 44%) อยู่ที่ z 3.1 = ระดับที่โชคทำได้พอดีเมื่อลอง 352 ช่อง และในข้อมูลของคุณมีแค่ 5 วัน</li>
          <li>แถว D ลงท้าย 0 ต่ำทุกตำแหน่ง (27–32%) อันนี้เป็นโครงสร้างจริง: D_หน่วย=0 ทำให้หลักหน่วยของบนกับล่างซ้ำกัน เลขปิดจึงมีตัวไม่ซ้ำน้อยลง — ระบบรู้อยู่แล้วผ่านการไล่กรณี</li>
          <li>เงื่อนไขอื่น (เปิดบวก/ลบ, ห่างกี่ %, วัน, ระดับดัชนี) ไม่มีช่องไหนพ้นเส้นโชค → <b>ไม่มีสัญญาณบอกว่าวันไหนควรเอาหลักสิบหรือหลักหน่วย</b></li>
        </ul>
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
        <h2 className="font-medium">3c. ค้นอัตโนมัติ 1,648 สูตร (ผสม 1–3 ตำแหน่ง × บวก/ลบ/คูณ/หยิบตรง) — 16 ก.ย. 2569</h2>
        <p className="text-sm">ใช้เครื่องมือหน้า “ทดลองสูตร” วิ่งทุกชุดผสมของ 16 ตำแหน่งตัวเปิด (ทศนิยมบน/ล่าง, D, หลักของดัชนี, หลักของจุดที่เปลี่ยน, ปิดเมื่อวาน) บน 10 ปี แล้วจัดอันดับตาม “ชนะสุ่มกี่จุด”</p>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">สูตร (ดีสุด 5 อันดับ)</th><th className="py-1 pr-3 text-right">10 ปี</th><th className="py-1 pr-3 text-right">5 ปีแรก / หลัง</th><th className="py-1 text-right">ของคุณ 75 วัน</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[["บนหน่วย + หลักร้อยของจุดเปลี่ยน (mod 10)", "37.2%", "39.4 / 35.0", "36.0%"], ["หลักร้อยดัชนี + หลักร้อยจุดเปลี่ยน + ปิดเมื่อวานบนสิบ", "37.0%", "36.8 / 37.1", "31.1%"], ["Dสิบ + หลักร้อยดัชนี + หลักร้อยจุดเปลี่ยน", "37.0%", "36.8 / 37.1", "32.0%"], ["ล่างหน่วย + Dหน่วย + หลักร้อยจุดเปลี่ยน", "36.8%", "37.8 / 35.9", "42.7%"], ["ล่างหน่วย + หลักสิบจุดเปลี่ยน + ปิดเมื่อวานล่างสิบ", "36.8%", "37.1 / 36.6", "40.5%"]].map(([a, b, c, d]) => (
              <tr key={a}><td className="py-1 pr-3">{a}</td><td className="py-1 pr-3 text-right">{b}</td><td className="py-1 pr-3 text-right">{c}</td><td className="py-1 text-right">{d}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">สุ่ม 34.5% · ลอง 1,648 สูตร ค่าสูงสุดที่โชคล้วนให้ได้ ≈ 37.9% → ทุกสูตรอยู่ใต้เส้นนั้น และอันดับต้น ๆ ในข้อมูลของคุณเองได้ 31–43% (แกว่งตามโชค) — <b>ไม่มีสูตรจากตัวเปิดที่ชนะการไล่กรณีจาก D</b></p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">3d. เลขเจาะ (เลข 2 ตัว) — ค้น 101 สูตรแปลง + 25 สูตรจัดชุด (18 ก.ย. 2569)</h2>
        <p className="text-sm">คำถาม: จากตัวเปิดตอนเช้าและสถิติปิดรายวัน มีสูตรไหนบอก “เลข 2 ตัว” (บน หรือ ล่าง, กลับได้) ได้ดีกว่าสุ่มไหม — สุ่ม = เลขละ 4% (ตรง 2%) เพราะทศนิยมปิด 00–99 สม่ำเสมอ (ข้อ 2)</p>
        <p className="text-sm"><b>ก. สูตรแปลง 1 เลข/วัน (101 สูตร)</b> — เปิดบน/เปิดล่าง/D/ปิดบน-ล่างเมื่อวาน แต่ละตัว: ตรง ๆ, กลับ, ±1, ±10, +11, 100−, ×2 และจับคู่กัน บวก/ลบ/ผสมหลัก, รวมทั้ง “ล่างที่คู่กับเปิดบนตามโครงสร้าง” — วัดบน 2,462 วัน</p>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-4">สูตร (ดีสุด)</th><th className="py-1 pr-4 text-right">ตรง</th><th className="py-1 text-right">กลับได้</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[["D + 10", "2.4%", "4.5%"], ["ปิดบนเมื่อวาน + 10", "2.4%", "4.5%"], ["เปิดล่าง (ตรง ๆ)", "2.2%", "4.4%"], ["เปิดล่าง กลับ", "2.4%", "4.4%"], ["ล่างที่คู่กับเปิดบน ตามทิศเปิด", "2.2%", "4.4%"], ["ต่ำสุด: ปิดบนเมื่อวานสิบ+Dสิบ", "–", "1.5%"]].map(([a, b, c]) => (
              <tr key={a}><td className="py-1 pr-4">{a}</td><td className="py-1 pr-4 text-right">{b}</td><td className="py-1 text-right">{c}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm">SE ต่อสูตร ≈ 0.4% · ลอง 101 สูตร ค่าสูงสุดที่โชคให้ได้ ≈ 5.0% → สูตรดีสุด 4.5% อยู่ใต้เส้น <b>ไม่มีสูตรแปลงไหนบอกเลข 2 ตัวได้</b></p>
        <p className="text-sm"><b>ข. สูตรจัดชุด 12 เลข กลับได้ (25 สูตร)</b> — วัด “มาอย่างน้อย 1 ใน 12” บน 2,362 วัน แยกครึ่งแรก/ครึ่งหลัง</p>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">สูตร</th><th className="py-1 pr-3 text-right">10 ปี</th><th className="py-1 pr-3 text-right">ครึ่งแรก / หลัง</th><th className="py-1 text-right">ของคุณ 71 วัน</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[["โมเดลโครงสร้าง D + ทิศทาง, เลือก 12 ตัวไม่ให้ทับกัน (ที่ใช้)", "47.5%", "44.8 / 50.1", "52.1%"], ["เลขร้อนทั้งประวัติ", "43.8%", "42.0 / 45.6", "33.8%"], ["เลขร้อนของวันในสัปดาห์นั้น", "43.4%", "43.3 / 43.6", "36.6%"], ["เลขร้อน 20–250 วัน", "41.7–42.8%", "", "33.8–40.8%"], ["คงที่ 12 ตัว (อ้างอิงสุ่ม)", "41.5%", "40.7 / 42.3", "36.6%"], ["Markov: เปิดบน / D / ปิดเมื่อวาน → วันนี้", "39.0–40.5%", "", "32.4–33.8%"], ["สูตรแปลง 101 ตัว เรียงตามที่เคยถูก (เรียนรู้ 500 วัน)", "38.8%", "38.2 / 39.4", "39.4%"], ["เลขหายนาน (due)", "36.5%", "37.1 / 35.9", "47.9%"], ["เลขเย็น 20–5000 วัน", "26.2–39.4%", "", "45.1–47.9%"], ["เลขที่ประกอบจากหลักของเปิด+D", "32.6%", "35.7 / 29.4", "22.5%"], ["เลขเบิ้ล + ข้างเคียง", "26.5%", "", "26.8%"]].map(([a, b, c, d]) => (
              <tr key={a}><td className="py-1 pr-3">{a}</td><td className="py-1 pr-3 text-right font-semibold">{b}</td><td className="py-1 pr-3 text-right">{c}</td><td className="py-1 text-right">{d}</td></tr>
            ))}
          </tbody>
        </table>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>เพดาน = 12 × 4% = 48% (ถ้าเลขทั้ง 12 ไม่มาในกรณีเดียวกัน) โมเดลโครงสร้างได้ 47.5% ชนเพดานแล้ว — ที่ชนะสุ่ม 7 จุดไม่ได้มาจาก “รู้ว่าเลขไหนจะออก” แต่จาก <b>เลี่ยงเลขที่ทับกัน</b> (D ทำให้บางคู่มาพร้อมกันเสมอ เช่น บน 98 → ล่าง 89) ทิศทางที่ฟันช่วยอีกนิดว่าคู่ไหนทับ</li>
          <li>เลขเย็น/เลขหายนาน แย่กว่าสุ่ม (26–37%) อย่างเป็นระบบ ไม่ใช่โชค: เลขที่ “เย็น” ที่สุดคือเลขเบิ้ล 00 11 … 99 ซึ่งมีโอกาสแค่ 2% (กลับแล้วก็ตัวเดิม) — ในข้อมูลของคุณ 71 วัน สูตรเย็นได้ 45–48% ดูดีเพราะตัวอย่างเล็ก บน 10 ปีกลับด้าน</li>
          <li>เลขร้อนชนะ “คงที่” แค่ 1–2 จุด (ระดับโชคเมื่อลอง 25 สูตร) และแพ้โมเดลโครงสร้าง 4 จุด · Markov (จำว่าเลขเมื่อวาน/D/เปิดเท่านี้ วันถัดมาออกอะไร) = สุ่ม</li>
          <li className="font-medium">สรุป: เลข 2 ตัวไม่มีสูตรทำนาย เพราะทศนิยมของราคาปิดสุ่มจริง สิ่งที่ทำได้คือจัดชุดให้ไม่ทับกัน (ทำอยู่แล้ว) และเลือกจำนวนเลขตามงบ — 12 ตัว ≈ 48%, ทุก 1 ตัวที่เพิ่ม ≈ +4%</li>
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
