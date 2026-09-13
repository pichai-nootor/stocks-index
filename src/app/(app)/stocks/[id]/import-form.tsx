"use client";

import { useActionState } from "react";
import { importCsv } from "@/app/actions/stocks";

export function ImportForm({ stockId }: { stockId: string }) {
  const [state, action, pending] = useActionState(importCsv, undefined);
  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-medium">นำเข้าประวัติจาก CSV (Investing.com)</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="stockId" value={stockId} />
        <input name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm" required />
        <p className="text-xs text-slate-500">
          ต้องมีคอลัมน์ วันที่ / ล่าสุด(ปิด) / ราคาเปิด — ระบบคำนวณ "เปลี่ยนแปลง" จากปิดของแถวก่อนหน้าให้เอง · วันที่ที่มีอยู่แล้วจะถูกข้าม · แนะนำโหลดแบบ <b>รายวัน</b>
        </p>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "กำลังนำเข้า..." : "นำเข้า"}</button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.imported !== undefined && (
          <p className="text-sm text-emerald-700">✓ นำเข้า {state.imported} วัน · ซ้ำ {state.duplicates} · ข้าม {state.skipped} (แถวแรกสุดใช้เป็นฐานปิดก่อนหน้า)</p>
        )}
      </form>
    </details>
  );
}
