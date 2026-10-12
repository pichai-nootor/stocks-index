"use client";

import { useActionState, useRef } from "react";
import { saveManualOpen } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

const fmt = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * กรอกเปิดเองของรอบที่ Yahoo ดึงเปิดผิด (รอบบ่าย ฮั่งเส็ง · จีน · นิเคอิ) — การ์ดเตี้ยแถวเดียว: วันที่ · เปิด · เปลี่ยนแปลง
 *   พิมพ์เปิดแล้ว ช่องเปลี่ยนแปลงคิดจากปิดวันก่อนให้ (แก้เองได้)
 */
export function ManualOpenForm({ title, stockId, date, prevClose, current, currentChange, yahooOpen }: {
  /** หัวการ์ด เช่น "HSI บ่าย" */
  title: string;
  stockId: string; date: string;
  /** ปิดวันก่อน (ถ้ารู้) — ใช้คิดเปลี่ยนแปลงให้ */
  prevClose?: number;
  /** เปิด/เปลี่ยนแปลงที่บันทึกไว้แล้ว (ถ้ามีแถวรอปิด) */
  current?: number; currentChange?: number;
  /** เปิดที่ Yahoo ให้ — แสดงเป็นข้อมูลอ้างอิงเท่านั้น */
  yahooOpen?: number;
}) {
  const [state, action, pending] = useActionState(saveManualOpen, undefined);
  const changeRef = useRef<HTMLInputElement>(null);
  const onOpen = (v: string) => {
    const x = Number(v);
    if (prevClose !== undefined && changeRef.current && v.trim() !== "" && Number.isFinite(x)) changeRef.current.value = String(Math.round((x - prevClose) * 100) / 100);
  };
  return (
    <form key={`${date}-${current}`} action={action} className="card flex flex-wrap items-end gap-2 border-blue-200 bg-blue-50/60 text-sm">
      <input type="hidden" name="stockId" value={stockId} />
      <span className="self-center font-semibold">{title} — กรอกเปิด</span>
      <label className="flex flex-col text-xs text-slate-600">วันที่
        <input name="date" type="date" className="input w-40 px-2 py-1 text-sm" defaultValue={date} required />
      </label>
      <label className="flex flex-col text-xs text-slate-600">ค่าดัชนีตอนเปิด
        <input name="openValue" type="number" step="any" inputMode="decimal" className="input w-36 px-2 py-1 text-sm" defaultValue={current} placeholder="24237.85" onChange={(e) => onOpen(e.target.value)} required />
      </label>
      <label className="flex flex-col text-xs text-slate-600">เปลี่ยนแปลง (+/−)
        <input ref={changeRef} name="openChange" type="number" step="any" inputMode="decimal" className="input w-28 px-2 py-1 text-sm" defaultValue={currentChange} placeholder="+26.50" required />
      </label>
      <button className="btn-primary" disabled={pending}>{pending ? "..." : current === undefined ? "บันทึกเปิด + ฟันธง" : "แก้เปิด"}</button>
      <p className="w-full text-xs text-slate-500">
        {prevClose !== undefined ? `ปิดวันก่อน ${fmt(prevClose)} — พิมพ์เปิดแล้วระบบคิด +/− ให้ (แก้เองได้)` : "กรอก +/− เทียบปิดวันก่อน"}
        {current !== undefined ? ` · ตอนนี้ใช้ ${fmt(current)}` : ""}{yahooOpen !== undefined ? ` · Yahoo ให้ ${fmt(yahooOpen)} (อาจผิด)` : ""}
        {" · ตอนเย็นมาเติม “ปิด” ในตารางประวัติ"}
      </p>
      {state?.ok && <span className="text-xs text-emerald-700">✓ บันทึกแล้ว</span>}
      <FormError message={state?.error} />
    </form>
  );
}
