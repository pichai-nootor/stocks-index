"use client";

import { useActionState } from "react";
import { saveLatePrice } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

/** ฟันช่วงท้าย: บันทึกราคาก่อนปิด (ดึงอัตโนมัติ หรือพิมพ์ราคาที่เห็น) */
export function LateCard({ recordId, prevClose, saved }: { recordId: string; prevClose: number; saved: { price: number; at: string } | null }) {
  const [state, action, pending] = useActionState(saveLatePrice, undefined);
  const pct = saved ? ((saved.price - prevClose) / prevClose) * 100 : null;
  const time = saved ? new Date(new Date(saved.at).getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16) : null;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="id" value={recordId} />
      <span className="text-xs font-medium text-slate-600">ฟันช่วงท้าย (ทดลอง)</span>
      {saved && pct !== null && <span className={`rounded px-2 py-0.5 text-xs font-medium ${pct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>บันทึกไว้ {saved.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({pct > 0 ? "+" : ""}{pct.toFixed(2)}%) เวลา {time} น. → {pct >= 0 ? "▲ ปิดบวก (ตารางเขียว)" : "▼ ปิดลบ (ตารางแดง)"}</span>}
      <button className="btn-ghost text-xs" disabled={pending} name="mode" value="auto">{pending ? "กำลังดึง…" : saved ? "อัปเดตด้วยราคาตอนนี้" : "บันทึกราคาตอนนี้"}</button>
      <input name="price" placeholder="หรือพิมพ์ราคาที่เห็น" inputMode="decimal" className="input w-40 text-xs" />
      <button className="btn-ghost text-xs" disabled={pending} name="mode" value="manual">บันทึกราคาที่พิมพ์</button>
      <FormError message={state?.error} />
    </form>
  );
}
