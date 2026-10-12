"use client";

import { useActionState } from "react";
import { importEgyptCsv, openEgyptNextDay, setEgyptOpen } from "@/app/actions/egypt";
import { FormError } from "@/components/form-error";

/** กรอกราคาเปิดของวันนี้จาก investing.com (วางตัวเลข → ระบบคิดค่าเปลี่ยนแปลงให้) */
export function EgyptOpenPasteForm({ recordId, current, prevClose }: { recordId: string; current: number; prevClose: number }) {
  const [state, action, pending] = useActionState(setEgyptOpen, undefined);
  return (
    <form action={action} className="card flex flex-wrap items-center gap-2 border-blue-200 bg-blue-50/60 text-sm">
      <input type="hidden" name="recordId" value={recordId} />
      <a href="https://th.investing.com/indices/egx30" target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">เปิด investing.com ↗</a>
      <span className="text-slate-600">แล้ววาง “ราคาเปิด” ตรงนี้:</span>
      <input name="open" inputMode="decimal" placeholder="55,014.23" className="input w-36 px-2 py-1" required />
      <button className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึกราคาเปิด"}</button>
      <span className="text-xs text-slate-500">ตอนนี้ใช้ {current.toLocaleString("en-US", { minimumFractionDigits: 2 })} (จาก mubasher) · ปิดวันก่อน {prevClose.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      {state?.ok && <span className="text-xs text-emerald-700">✓ {state.ok}</span>}
      <FormError message={state?.error} />
    </form>
  );
}

/** ปุ่มเปิดวันซื้อขายถัดไปทันที (เปิด = ปิดเมื่อวาน) — ฟันธงได้ก่อนตลาดเปิด */
export function EgyptOpenNextButton({ nextDate, open }: { nextDate: string; open: number }) {
  const [state, action, pending] = useActionState(openEgyptNextDay, undefined);
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50/60">
      <div className="text-sm">
        <span className="font-medium">EGX30</span> วัน {new Date(nextDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}:
        เปิด <span className="tabular-nums">{open.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
        <span className="text-slate-500"> (= ปิดเมื่อวาน — ตลาดอียิปต์ประกาศแบบนี้ จึงฟันได้เลยไม่ต้องรอตลาดเปิด)</span>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึกเปิดนี้ + ฟันธง"}</button>
      <FormError message={state?.error} />
    </form>
  );
}

/** นำเข้าประวัติ EGX30 จากไฟล์ CSV ของ investing.com ที่ผู้ใช้โหลดเอง (ประวัติใช้ไฟล์นี้อย่างเดียว) */
export function EgyptSetup() {
  const [state, action, pending] = useActionState(importEgyptCsv, undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
      <span className="text-xs text-slate-500">นำเข้าประวัติจากไฟล์ CSV ของ investing.com:</span>
      <input type="file" name="file" accept=".csv,text/csv" className="text-xs" required />
      <button type="submit" className="btn-ghost border border-slate-200 text-xs" disabled={pending}>{pending ? "กำลังนำเข้า..." : "นำเข้า"}</button>
      {state && !state.error && <span className="text-xs text-emerald-700">✓ เพิ่ม {state.added} · แก้ {state.updated} · รวม {state.total} วัน</span>}
      <FormError message={state?.error} />
    </form>
  );
}
