"use client";

import { useActionState } from "react";
import { setupNikkei } from "@/app/actions/nikkei";
import { FormError } from "@/components/form-error";

/** ปุ่มเดียว: เพิ่มนิเคอิเช้า/บ่าย + นำเข้าประวัติจาก Yahoo (กดซ้ำได้ เพิ่มเฉพาะวันที่ยังไม่มี) */
export function NikkeiSetup() {
  const [state, action, pending] = useActionState(setupNikkei, undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
      <button type="submit" className="btn-ghost border border-slate-200 text-xs" disabled={pending}>{pending ? "กำลังซิงก์..." : "ซิงก์วันที่ขาดจาก Yahoo (เช้า+บ่าย)"}</button>
      {state && !state.error && <p className="mt-2 text-sm text-emerald-700">✓ เพิ่มใหม่ บ่าย {state.pm} วัน · เช้า {state.am} วัน{state.pm === 0 && state.am === 0 ? " (ครบอยู่แล้ว)" : ""}</p>}
      <FormError message={state?.error} />
    </form>
  );
}
