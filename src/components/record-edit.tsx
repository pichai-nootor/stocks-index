"use client";

import { useActionState } from "react";
import { updateRecord } from "@/app/actions/stocks";

type Rec = { id: string; openValue: number; openChange: number; closeValue: number | null; closeChange: number | null };

/** "แก้ไข" ในตารางประวัติ: กางฟอร์มเล็ก ๆ แก้เปิด/ปิดของวันนั้น */
export function RecordEdit({ record }: { record: Rec }) {
  const [state, action, pending] = useActionState(updateRecord, undefined);
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-blue-600 hover:underline">แก้ไข</summary>
      <form action={action} className="mt-1 grid w-56 gap-1">
        <input type="hidden" name="id" value={record.id} />
        <label className="grid grid-cols-[3.5rem_1fr] items-center gap-1"><span className="text-slate-500">เปิด</span><input name="openValue" type="number" step="any" inputMode="decimal" className="input px-2 py-1 text-xs" defaultValue={record.openValue} required /></label>
        <label className="grid grid-cols-[3.5rem_1fr] items-center gap-1"><span className="text-slate-500">เปิด +/−</span><input name="openChange" type="number" step="any" inputMode="decimal" className="input px-2 py-1 text-xs" defaultValue={record.openChange} required /></label>
        <label className="grid grid-cols-[3.5rem_1fr] items-center gap-1"><span className="text-slate-500">ปิด</span><input name="closeValue" type="number" step="any" inputMode="decimal" className="input px-2 py-1 text-xs" defaultValue={record.closeValue ?? ""} placeholder="ว่าง = ยังไม่ปิด" /></label>
        <label className="grid grid-cols-[3.5rem_1fr] items-center gap-1"><span className="text-slate-500">ปิด +/−</span><input name="closeChange" type="number" step="any" inputMode="decimal" className="input px-2 py-1 text-xs" defaultValue={record.closeChange ?? ""} /></label>
        <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={pending}>{pending ? "..." : "บันทึก"}</button>
        {state?.error && <span className="text-red-600">{state.error}</span>}
      </form>
    </details>
  );
}
