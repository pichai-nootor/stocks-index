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
    <form ref={ref} action={action} className="mt-4 space-y-3">
      <input type="hidden" name="stockId" value={stockId} />
      <div>
        <label htmlFor="date" className="label">วันที่</label>
        <input id="date" name="date" type="date" className="input" defaultValue={today} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="open" className="label">ราคาเปิด</label>
          <input id="open" name="open" type="number" step="any" inputMode="decimal" className="input" required />
        </div>
        <div>
          <label htmlFor="close" className="label">ราคาปิด</label>
          <input id="close" name="close" type="number" step="any" inputMode="decimal" className="input" required />
        </div>
      </div>
      <div>
        <label htmlFor="note" className="label">หมายเหตุ (ไม่บังคับ)</label>
        <input id="note" name="note" className="input" placeholder="เช่น ข่าว, เหตุการณ์" />
      </div>
      <FormError message={state?.error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
