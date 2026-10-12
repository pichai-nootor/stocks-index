"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRecord } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";
import { OpenMismatch } from "@/components/open-mismatch";

/** กรอกเปิดเอง — การ์ดแถวเดียว: วันที่ · เปิด · เปลี่ยนแปลง → ระบบฟันธงทันทีในตารางประวัติ */
export function RecordForm({ stockId, symbol, today }: { stockId: string; symbol: string; today: string }) {
  const [state, action, pending] = useActionState(createRecord, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const changeRef = useRef<HTMLInputElement>(null);
  const useSuggested = (v: number) => {
    if (changeRef.current) changeRef.current.value = String(v);
    ref.current?.requestSubmit();
  };

  useEffect(() => {
    if (state === undefined) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="card flex flex-wrap items-end gap-2 border-blue-200 bg-blue-50/60 text-sm">
      <input type="hidden" name="stockId" value={stockId} />
      <span className="self-center font-semibold">{symbol} — กรอกเปิด</span>
      <label className="flex flex-col text-xs text-slate-600">วันที่
        <input name="date" type="date" className="input w-40 px-2 py-1 text-sm" defaultValue={today} required />
      </label>
      <label className="flex flex-col text-xs text-slate-600">ค่าดัชนีตอนเปิด
        <input name="openValue" type="number" step="any" inputMode="decimal" className="input w-36 px-2 py-1 text-sm" placeholder="74781.76" required />
      </label>
      <label className="flex flex-col text-xs text-slate-600">เปลี่ยนแปลง (+/−)
        <input ref={changeRef} name="openChange" type="number" step="any" inputMode="decimal" className="input w-28 px-2 py-1 text-sm" placeholder="-120.83" required />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึกเปิด + ฟันธง"}</button>
      <p className="w-full text-xs text-slate-500">แก้เปิดของแถวที่รอปิดได้ที่ช่อง “เปิด” ในตาราง · ตอนเย็นมาเติม “ปิด” ในตารางประวัติ</p>
      {state?.mismatch ? <div className="w-full"><OpenMismatch state={state} onUse={useSuggested} /></div> : <FormError message={state?.error} />}
    </form>
  );
}
