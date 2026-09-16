"use client";

import { useActionState } from "react";
import { saveLiveManual } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

/** กรอกราคาที่เห็นจริงตอนนี้ (แทน Yahoo ที่ดีเลย์ ~15 นาที) แล้วบันทึกเป็นจุดฟันสด */
export function LiveManualForm({ recordId, compact = false }: { recordId: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(saveLiveManual, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={recordId} />
      <input name="price" type="number" step="any" inputMode="decimal" placeholder="ราคาที่เห็นตอนนี้" className={`input ${compact ? "h-7 w-36 px-2 text-xs" : "w-44"}`} required />
      <button className={compact ? "rounded bg-slate-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-slate-800" : "btn-primary"} disabled={pending}>{pending ? "..." : "ฟันสดด้วยราคานี้"}</button>
      <FormError message={state?.error} />
    </form>
  );
}
