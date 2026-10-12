"use client";

import { useActionState } from "react";
import { setupChina } from "@/app/actions/china";
import { FormError } from "@/components/form-error";

/** ซิงก์วันที่ขาดของหุ้นจีน (เช้า+บ่าย) จาก Yahoo 399001.SZ */
export function ChinaSetup() {
  const [state, action, pending] = useActionState(setupChina, undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
      <button type="submit" className="btn-ghost border border-slate-200 text-xs" disabled={pending}>{pending ? "กำลังซิงก์..." : "ซิงก์วันที่ขาดจาก Yahoo (เช้า+บ่าย)"}</button>
      {state && !state.error && <span className="text-xs text-emerald-700">✓ เพิ่มเช้า {state.am} · บ่าย {state.pm} วัน</span>}
      <FormError message={state?.error} />
    </form>
  );
}
