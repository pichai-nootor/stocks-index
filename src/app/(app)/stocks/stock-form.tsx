"use client";

import { useActionState, useEffect, useRef } from "react";
import { createStock } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

export function StockForm() {
  const [state, action, pending] = useActionState(createStock, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === undefined) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="mt-4 space-y-3">
      <div>
        <label htmlFor="symbol" className="label">ชื่อหุ้น / สัญลักษณ์</label>
        <input id="symbol" name="symbol" className="input uppercase" placeholder="เช่น PTT, SET50" required />
      </div>
      <div>
        <label htmlFor="name" className="label">ชื่อเต็ม (ไม่บังคับ)</label>
        <input id="name" name="name" className="input" placeholder="เช่น ปตท." />
      </div>
      <FormError message={state?.error} />
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "กำลังบันทึก..." : "เพิ่มหุ้น"}
      </button>
    </form>
  );
}
