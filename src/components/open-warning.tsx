import Link from "next/link";
import { fmtChange, fmtNum, type OpenCheck } from "@/lib/stats";

/** แถบเตือนบนการ์ดวิเคราะห์ เมื่อค่าเปิดที่บันทึกไว้ไม่ตรงกับปิดล่าสุด (ผลวิเคราะห์ด้านล่างเชื่อไม่ได้) */
export function OpenWarning({ check, fixHref }: { check: OpenCheck; fixHref?: string }) {
  if (!check.mismatch || !check.lastClose || check.suggestedOpenChange === null) return null;
  const lastDate = check.lastClose.date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">⚠ ค่าเปิดที่กรอกไม่ตรงกับปิดล่าสุด — D และเลขที่ฟันด้านล่างน่าจะผิด</p>
      <p className="mt-1">
        เปิด − เปลี่ยนแปลง = <span className="font-mono">{fmtNum(check.impliedPrevClose)}</span> แต่ปิด {lastDate} = <span className="font-mono">{fmtNum(check.lastClose.closeValue)}</span>
        {" "}→ เปลี่ยนแปลงตอนเปิดควรเป็น <span className="font-mono font-semibold">{fmtChange(check.suggestedOpenChange)}</span>
        {fixHref && <> · <Link href={fixHref} className="font-medium underline">ดูผลด้วยค่าที่ถูก แล้วกดบันทึกทับ →</Link></>}
      </p>
    </div>
  );
}
