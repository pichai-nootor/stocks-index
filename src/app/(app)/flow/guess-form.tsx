"use client";

import { useActionState } from "react";
import { saveFlowGuess } from "@/app/actions/flow";
import { FormError } from "@/components/form-error";

/** ทายเลขไหลล่วงหน้า 2 ตัว + ชื่อวิธี (แยกวิธีไว้เทียบกันว่าวิธีไหนทายได้จริง) */
export function GuessForm({ date, methods }: { date: string; methods: string[] }) {
  const [state, action, pending] = useActionState(saveFlowGuess, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="space-y-1"><span className="block text-xs text-slate-500">วันที่ทาย</span><input name="date" type="date" defaultValue={date} className="input" /></label>
      <label className="space-y-1"><span className="block text-xs text-slate-500">เลข 2 ตัว</span><input name="digits" inputMode="numeric" maxLength={3} placeholder="34" className="input w-20 font-mono" /></label>
      <label className="space-y-1"><span className="block text-xs text-slate-500">วิธี / ที่มา</span>
        <input name="method" list="flow-methods" defaultValue={methods[0] ?? "คิดเอง"} className="input w-40" />
        <datalist id="flow-methods">{methods.map((m) => <option key={m} value={m} />)}</datalist>
      </label>
      <button className="btn-primary" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</button>
      {state?.saved && <span className="text-xs text-emerald-700">✓ บันทึก {state.saved}</span>}
      <FormError message={state?.error} />
    </form>
  );
}
