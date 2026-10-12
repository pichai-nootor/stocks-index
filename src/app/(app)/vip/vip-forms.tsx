"use client";

import { useActionState } from "react";
import { importVipHistory, importVipBundled, addVipResult, deleteVipResult, setVipOpen } from "@/app/actions/vip";
import { FormError } from "@/components/form-error";
import type { VipMarket } from "@/lib/vip";

/** ปุ่มดึงผลย้อนหลังจาก stocks-vip.com (≈15 วัน) — กดซ้ำได้ทุกวัน เพิ่มเฉพาะวันที่ยังไม่มี */
export function VipImportButton({ market, label = "ดึงผลย้อนหลังจากเว็บ", big = false }: { market: VipMarket; label?: string; big?: boolean }) {
  const [state, action, pending] = useActionState(importVipHistory, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="market" value={market} />
      <button type="submit" className={`btn-primary ${big ? "px-5 py-2.5 text-base" : ""}`} disabled={pending}>{pending ? "กำลังดึง..." : label}</button>
      {state && !state.error && (
        <span className="text-sm text-emerald-700">✓ เว็บมี {state.total} รายการ — เพิ่มใหม่ {state.imported}{state.updated ? ` · เติมราคาเปิด/ปิด ${state.updated}` : ""}{state.imported === 0 && !state.updated ? " (ครบอยู่แล้ว)" : ""}</span>
      )}
      <FormError message={state?.error} />
    </form>
  );
}

/** กรอกผลเองสำหรับวันที่เว็บไม่มีแล้ว */
export function VipManualForm({ market, rounds, today }: { market: VipMarket; rounds: readonly number[]; today: string }) {
  const [state, action, pending] = useActionState(addVipResult, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[auto_auto_auto_auto_auto_auto] sm:items-end">
      <input type="hidden" name="market" value={market} />
      <div>
        <label htmlFor="vip-date" className="label">วันที่</label>
        <input id="vip-date" name="date" type="date" className="input" defaultValue={today} required />
      </div>
      {rounds.length > 1 ? (
        <div>
          <label htmlFor="vip-round" className="label">รอบ</label>
          <select id="vip-round" name="round" className="input" defaultValue={2}>
            <option value={1}>เช้า</option>
            <option value={2}>เย็น</option>
          </select>
        </div>
      ) : <input type="hidden" name="round" value={rounds[0]} />}
      <div>
        <label htmlFor="vip-top" className="label">บน (3 หลัก)</label>
        <input id="vip-top" name="top" inputMode="numeric" pattern="\d{3}" maxLength={3} className="input w-24 font-mono" placeholder="429" required />
      </div>
      <div>
        <label htmlFor="vip-bottom" className="label">ล่าง (2 หลัก)</label>
        <input id="vip-bottom" name="bottom" inputMode="numeric" pattern="\d{2}" maxLength={2} className="input w-20 font-mono" placeholder="32" required />
      </div>
      <div>
        <label htmlFor="vip-open" className="label">ราคาเปิด (ถ้ามี)</label>
        <input id="vip-open" name="open" type="number" step="any" inputMode="decimal" className="input w-36" placeholder="969004.43" />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "..." : "บันทึก"}</button>
      <FormError message={state?.error} />
    </form>
  );
}

export function VipDeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteVipResult}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-red-600 hover:underline">ลบ</button>
    </form>
  );
}

/** เติมราคาเปิดให้งวดเก่าในตาราง (แถวที่ระบบไม่ทันเก็บ) */
export function VipOpenForm({ id, open }: { id: string; open: number | null }) {
  const [state, action, pending] = useActionState(setVipOpen, undefined);
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-blue-600 hover:underline">{open === null ? "ใส่ราคาเปิด" : "แก้"}</summary>
      <form action={action} className="mt-1 flex items-center gap-1">
        <input type="hidden" name="id" value={id} />
        <input name="open" type="number" step="any" inputMode="decimal" defaultValue={open ?? ""} className="input w-32 px-2 py-1 text-xs" placeholder="969004.43" required />
        <button type="submit" className="btn-primary px-2 py-1 text-xs" disabled={pending}>{pending ? "..." : "บันทึก"}</button>
        <FormError message={state?.error} />
      </form>
    </details>
  );
}

/** นำเข้าประวัติหลายปีที่แนบมากับโปรแกรม (เฉพาะตลาดที่มีไฟล์) */
export function VipBundledButton({ market, count }: { market: VipMarket; count: number }) {
  const [state, action, pending] = useActionState(importVipBundled, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="market" value={market} />
      <button type="submit" className="btn-ghost border border-slate-200" disabled={pending}>{pending ? "กำลังนำเข้า..." : `นำเข้าประวัติ ${count.toLocaleString()} งวด (2565–2569)`}</button>
      {state && !state.error && <span className="text-sm text-emerald-700">✓ เพิ่มใหม่ {state.imported}{state.imported === 0 ? " (ครบอยู่แล้ว)" : ""}</span>}
      <FormError message={state?.error} />
    </form>
  );
}
