"use client";

import { useActionState } from "react";
import { saveOpenFromYahoo } from "@/app/actions/stocks";
import { FormError } from "@/components/form-error";
import { fmtNum, fmtChange } from "@/lib/stats";

/** ปุ่มดึงค่าเปิดวันซื้อขายล่าสุดจาก Yahoo แล้วบันทึกทันที (แทนการกรอกเอง) */
export function YahooOpenButton({ stockId, symbol, quote }: {
  stockId: string; symbol: string;
  quote: { tradingDate: string; open: number; prevClose: number } | null;
}) {
  const [state, action, pending] = useActionState(saveOpenFromYahoo, undefined);
  if (!quote) return null;
  const change = quote.open - quote.prevClose;
  return (
    <form action={action} className="card flex flex-wrap items-center gap-3 border-blue-200 bg-blue-50/60">
      <input type="hidden" name="stockId" value={stockId} />
      <div className="text-sm">
        <span className="font-medium">{symbol}</span> วัน {new Date(quote.tradingDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} จาก Yahoo:
        เปิด <span className="tabular-nums">{fmtNum(quote.open)}</span> <span className={change < 0 ? "text-red-600" : "text-emerald-600"}>{fmtChange(change)}</span>
        <span className="text-slate-500"> (ปิดก่อนหน้า {fmtNum(quote.prevClose)})</span>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึกเปิดนี้ + ฟันธง"}</button>
      <FormError message={state?.error} />
    </form>
  );
}
