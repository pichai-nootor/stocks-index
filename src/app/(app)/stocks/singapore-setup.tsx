"use client";

import { useActionState } from "react";
import { setupSingapore } from "@/app/actions/singapore";
import { FormError } from "@/components/form-error";

/** ซิงก์วันที่ขาดของสิงคโปร์จาก Yahoo ^STI (ปิดทางการ = ผลหวย) — ใช้ได้ทั้งตอนยังไม่มีหุ้น (สร้างให้) และเติมย้อนหลัง */
export function SingaporeSetup({ label = "ซิงก์วันที่ขาดจาก Yahoo" }: { label?: string }) {
  const [state, action, pending] = useActionState(setupSingapore, undefined);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
      <button type="submit" className="btn-ghost border border-slate-200 text-xs" disabled={pending}>{pending ? "กำลังซิงก์..." : label}</button>
      {state && !state.error && <span className="text-xs text-emerald-700">✓ เพิ่ม {state.added} วัน</span>}
      <FormError message={state?.error} />
    </form>
  );
}
