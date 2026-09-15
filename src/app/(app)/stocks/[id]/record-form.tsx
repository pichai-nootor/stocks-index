"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRecord } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";
import { OpenMismatch } from "@/components/open-mismatch";

/** เช้า: บันทึกเฉพาะเลขเปิด → ระบบฟันธงทันทีในตารางประวัติ */
export function RecordForm({ stockId, today }: { stockId: string; today: string }) {
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
    <form ref={ref} action={action} className="mt-4 space-y-4">
      <input type="hidden" name="stockId" value={stockId} />
      <div>
        <label htmlFor="date" className="label">วันที่</label>
        <input id="date" name="date" type="date" className="input" defaultValue={today} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="openValue" className="label">ค่าดัชนีตอนเปิด</label>
          <input id="openValue" name="openValue" type="number" step="any" inputMode="decimal" className="input" placeholder="74781.76" required />
        </div>
        <div>
          <label htmlFor="openChange" className="label">เปลี่ยนแปลง (+/−)</label>
          <input ref={changeRef} id="openChange" name="openChange" type="number" step="any" inputMode="decimal" className="input" placeholder="-120.83" required />
        </div>
      </div>
      <div>
        <label htmlFor="note" className="label">หมายเหตุ (ไม่บังคับ)</label>
        <input id="note" name="note" className="input" />
      </div>
      {state?.mismatch ? <OpenMismatch state={state} onUse={useSuggested} /> : <FormError message={state?.error} />}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "กำลังบันทึก..." : "บันทึกเปิด + ฟันธง"}
      </button>
      <p className="text-xs text-slate-500">ตอนเย็นมาเติม “ปิด” ในตารางประวัติ ระบบจะตรวจให้ว่าเลขที่ฟันโผล่ไหม</p>
    </form>
  );
}
