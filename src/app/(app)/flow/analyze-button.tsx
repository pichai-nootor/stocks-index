"use client";

import { useActionState } from "react";
import { analyzeFlowNow } from "@/app/actions/flow";
import { FormError } from "@/components/form-error";

/** ปุ่ม "วิเคราะห์เลย" — แสดงตลอด · กดแล้วระบบคิดจากผลที่มีตอนนี้ (ถ้าล็อกแล้วบอกเลขที่ล็อกไว้) */
export function AnalyzeButton() {
  const [state, action, pending] = useActionState(analyzeFlowNow, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <button className="btn-primary" disabled={pending}>{pending ? "กำลังวิเคราะห์..." : "วิเคราะห์เลย"}</button>
      {state?.msg && <span className="text-sm text-emerald-700">✓ {state.msg}</span>}
      <FormError message={state?.error} />
    </form>
  );
}
