"use client";

import { useActionState } from "react";
import { fillCloseFromYahoo } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

/** เติมค่าปิดของแถวจาก Yahoo/BSE (ใช้ได้หลังตลาดปิด) — วางคู่กับฟอร์มกรอกเอง */
export function CloseYahooButton({ recordId, label = "เติมปิดจาก Yahoo" }: { recordId: string; label?: string }) {
  const [state, action, pending] = useActionState(fillCloseFromYahoo, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={recordId} />
      <button type="submit" className="btn-ghost border border-blue-200 px-2 py-1 text-xs text-blue-700" disabled={pending}>{pending ? "..." : label}</button>
      <FormError message={state?.error} />
    </form>
  );
}
