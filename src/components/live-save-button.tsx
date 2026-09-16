"use client";

import { useActionState } from "react";
import { saveLiveFromYahoo } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";

/** ปุ่มเล็กสำหรับตารางประวัติ: บันทึกราคาสดตอนนี้เป็นคำฟันของวัน */
export function LiveSaveButton({ recordId, label = "บันทึกฟันสด" }: { recordId: string; label?: string }) {
  const [state, action, pending] = useActionState(saveLiveFromYahoo, undefined);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={recordId} />
      <button className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700" disabled={pending}>{pending ? "..." : label}</button>
      <FormError message={state?.error} />
    </form>
  );
}
