"use client";

import { useActionState, useRef } from "react";
import { updateRecord } from "@/app/actions/stocks";
import { fmtNum } from "@/lib/stats";

/** "แก้เปิด" ในช่องเปิดของตาราง (แถวที่รอปิด) — พิมพ์เปิดแล้วคิด +/− จากปิดวันก่อนเดิมให้ แก้เองได้ */
export function OpenInlineEdit({ id, open, change }: { id: string; open: number; change: number }) {
  const [state, action, pending] = useActionState(updateRecord, undefined);
  const changeRef = useRef<HTMLInputElement>(null);
  const prevClose = Math.round((open - change) * 100) / 100;
  const onOpen = (v: string) => {
    const x = Number(v);
    if (changeRef.current && v.trim() !== "" && Number.isFinite(x)) changeRef.current.value = String(Math.round((x - prevClose) * 100) / 100);
  };
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-blue-600 hover:underline">แก้เปิด</summary>
      <form key={`${open}-${change}`} action={action} className="mt-1 grid w-36 gap-1">
        <input type="hidden" name="id" value={id} />
        <input name="openValue" type="number" step="any" inputMode="decimal" className="input px-2 py-1 text-xs" defaultValue={open} placeholder="เปิด" required onChange={(e) => onOpen(e.target.value)} />
        <input ref={changeRef} name="openChange" type="number" step="any" inputMode="decimal" className="input px-2 py-1 text-xs" defaultValue={change} placeholder="+/−" required />
        <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={pending}>{pending ? "..." : "บันทึกเปิด"}</button>
        <span className="text-slate-500">ปิดวันก่อน {fmtNum(prevClose)}</span>
        {state?.error && <span className="text-red-600">{state.error}</span>}
      </form>
    </details>
  );
}
