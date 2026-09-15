"use client";

import type { OpenState } from "@/app/actions/stocks";
import { fmtChange, fmtNum } from "@/lib/stats";

/** แจ้งเมื่อ เปิด − เปลี่ยนแปลง ไม่ตรงกับปิดล่าสุด: ให้เลือกใช้ค่าที่แนะนำ หรือยืนยันบันทึกตามที่กรอก */
export function OpenMismatch({ state, onUse }: { state: OpenState; onUse: (openChange: number) => void }) {
  if (!state?.mismatch) return null;
  const m = state.mismatch;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">⚠ ค่าเปิดไม่ตรงกับปิดล่าสุด — ถ้าบันทึกไปแบบนี้ D จะผิดและฟันเลขผิดทั้งวัน</p>
      <p className="mt-1">
        เปิด − เปลี่ยนแปลง = <span className="font-mono">{fmtNum(m.impliedPrevClose)}</span> แต่ปิด {m.lastCloseDate} ที่บันทึกไว้ = <span className="font-mono">{fmtNum(m.lastClose)}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => onUse(m.suggestedOpenChange)}>
          ใช้ {fmtChange(m.suggestedOpenChange)} แล้วบันทึก
        </button>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" name="force" value="1" /> ยืนยันบันทึกตามที่กรอก (มีวันก่อนหน้าที่ยังไม่ได้บันทึก)
        </label>
      </div>
    </div>
  );
}
