"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRecord } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

export function RecordForm({ stockId }: { stockId: string }) {
  const [state, action, pending] = useActionState(createRecord, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state === undefined && ref.current) {
      const date = (ref.current.elements.namedItem("date") as HTMLInputElement | null)?.value;
      ref.current.reset();
      // คงวันที่เดิมไว้ให้กรอกต่อเนื่องได้สะดวก
      if (date) (ref.current.elements.namedItem("date") as HTMLInputElement).value = date;
    }
  }, [state]);

  return (
    <form ref={ref} action={action} className="mt-4 space-y-4">
      <input type="hidden" name="stockId" value={stockId} />
      <div>
        <label htmlFor="date" className="label">วันที่</label>
        <input id="date" name="date" type="date" className="input" defaultValue={today} required />
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">ตอนเปิด</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="openValue" className="label">ค่าดัชนี</label>
            <input id="openValue" name="openValue" type="number" step="any" inputMode="decimal" className="input" placeholder="74781.76" required />
          </div>
          <div>
            <label htmlFor="openChange" className="label">เปลี่ยนแปลง (+/−)</label>
            <input id="openChange" name="openChange" type="number" step="any" inputMode="decimal" className="input" placeholder="-120.83" required />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">ตอนปิด</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="closeValue" className="label">ค่าดัชนี</label>
            <input id="closeValue" name="closeValue" type="number" step="any" inputMode="decimal" className="input" placeholder="74900.10" required />
          </div>
          <div>
            <label htmlFor="closeChange" className="label">เปลี่ยนแปลง (+/−)</label>
            <input id="closeChange" name="closeChange" type="number" step="any" inputMode="decimal" className="input" placeholder="2.51" required />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="note" className="label">หมายเหตุ (ไม่บังคับ)</label>
        <input id="note" name="note" className="input" placeholder="เช่น ข่าว, เหตุการณ์" />
      </div>
      <FormError message={state?.error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
      <p className="text-xs text-slate-500">ใส่เครื่องหมายลบ (−) หน้าตัวเลขถ้าเป็นการลดลง เช่น -120.83</p>
    </form>
  );
}
