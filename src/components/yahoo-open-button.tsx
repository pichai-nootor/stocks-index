"use client";

import { useActionState } from "react";
import { saveOpenFromYahoo } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";
import { fmtNum, fmtChange } from "@/lib/stats";

/** ปุ่มดึงค่าเปิดวันซื้อขายล่าสุดแล้วบันทึกทันที (แทนการกรอกเอง) — sourceLabel = ชื่อแหล่งของหุ้นตัวนั้น */
export function YahooOpenButton({ stockId, symbol, quote, redirectTo = "dashboard", sourceLabel = "Yahoo" }: {
  stockId: string; symbol: string;
  quote: { tradingDate: string; dateLabel: string; open: number; prevClose: number } | null;
  /** บันทึกแล้วไปหน้าไหน: หน้าแรก หรืออยู่หน้าหุ้นตัวนั้น */
  redirectTo?: "dashboard" | "stock";
  sourceLabel?: string;
}) {
  const [state, action, pending] = useActionState(saveOpenFromYahoo, undefined);
  if (!quote) return null;
  const change = quote.open - quote.prevClose;
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50/60">
      <input type="hidden" name="stockId" value={stockId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="text-sm">
        <span className="font-medium">{symbol}</span> วัน {quote.dateLabel} จาก {sourceLabel}:
        เปิด <span className="tabular-nums">{fmtNum(quote.open)}</span> <span className={change < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(change)}</span>
        <span className="text-slate-500"> (ปิดก่อนหน้า {fmtNum(quote.prevClose)})</span>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึกเปิดนี้ + ฟันธง"}</button>
      <FormError message={state?.error} />
    </form>
  );
}
