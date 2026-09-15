"use client";

import { useActionState, useRef } from "react";
import { saveOpenAndForecast } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";
import { OpenMismatch } from "@/components/open-mismatch";

type Stock = { id: string; symbol: string; name: string | null };

export function OpenForm({ stocks, stockId, date, openValue = "", openChange = "", redirectTo = "digits" }: {
  stocks: Stock[]; stockId: string; date: string; openValue?: string; openChange?: string; redirectTo?: "digits" | "dashboard";
}) {
  const [state, action, pending] = useActionState(saveOpenAndForecast, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const changeRef = useRef<HTMLInputElement>(null);
  const useSuggested = (v: number) => {
    if (changeRef.current) changeRef.current.value = String(v);
    formRef.current?.requestSubmit();
  };
  return (
    <form ref={formRef} action={action} className="card space-y-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="stockId" className="label">หุ้น / ดัชนี</label>
          <select id="stockId" name="stockId" className="input" defaultValue={stockId}>
            {stocks.map((s) => <option key={s.id} value={s.id}>{s.symbol}{s.name ? ` — ${s.name}` : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="label">วันที่</label>
          <input id="date" name="date" type="date" className="input" defaultValue={date} required />
        </div>
        <div>
          <label htmlFor="openValue" className="label">ค่าดัชนีตอนเปิด</label>
          <input id="openValue" name="openValue" type="number" step="any" inputMode="decimal" className="input" defaultValue={openValue} placeholder="74309.16" required />
        </div>
        <div>
          <label htmlFor="openChange" className="label">เปิดวันนี้ เปลี่ยนแปลง (+/−)</label>
          <input ref={changeRef} id="openChange" name="openChange" type="number" step="any" inputMode="decimal" className="input" defaultValue={openChange} placeholder="-593.43" required />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึกเปิด + ฟันธง"}</button>
      </div>
      {state?.mismatch ? <OpenMismatch state={state} onUse={useSuggested} /> : <FormError message={state?.error} />}
      <p className="text-xs text-slate-500">เลขเปิดจะถูกบันทึกไว้ ตอนเย็นกลับมาเติมผลปิดได้ที่หน้าแรก</p>
    </form>
  );
}
