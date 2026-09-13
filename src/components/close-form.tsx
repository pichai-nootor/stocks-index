"use client";

import { useActionState } from "react";
import { fillClose } from "@/app/actions/stocks";

/** เย็น: เติมค่าปิดให้แถวที่มีแค่เปิด */
export function CloseForm({ recordId }: { recordId: string }) {
  const [state, action, pending] = useActionState(fillClose, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={recordId} />
      <input name="closeValue" type="number" step="any" inputMode="decimal" className="input w-28 px-2 py-1 text-xs" placeholder="ค่าปิด" required />
      <input name="closeChange" type="number" step="any" inputMode="decimal" className="input w-24 px-2 py-1 text-xs" placeholder="+/−" required />
      <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={pending}>{pending ? "..." : "บันทึกปิด"}</button>
      {state?.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
