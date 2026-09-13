"use client";

import { useState } from "react";
import { bottomFromTop } from "@/lib/digits";

/** เครื่องคิดเลข: ใส่ 2 ตัวบนที่คิดว่าจะออก → ได้ 2 ตัวล่างทั้ง 2 กรณี */
export function TopToBottom({ D, pUp }: { D: number; pUp: number }) {
  const [top, setTop] = useState("");
  const n = /^\d{1,2}$/.test(top) ? Number(top) : null;
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
      <div>
        <label htmlFor="guessTop" className="label">ถ้า 2 ตัวบน ออก</label>
        <input id="guessTop" value={top} onChange={(e) => setTop(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="เช่น 76" className="input w-24 text-center font-mono text-lg" />
      </div>
      {n !== null ? (
        <div className="flex gap-4 text-sm">
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
            ปิดขึ้น ({Math.round(pUp * 100)}%) → ล่าง <span className="font-mono text-xl font-bold">{bottomFromTop(n, D, true)}</span>
          </div>
          <div className="rounded-md bg-red-50 px-3 py-2 text-red-800">
            ปิดลง ({Math.round((1 - pUp) * 100)}%) → ล่าง <span className="font-mono text-xl font-bold">{bottomFromTop(n, D, false)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">ล่าง = |บน − {String(D).padStart(2, "0")}| (mod 100) — ทายแค่บน ล่างตามมาเอง</p>
      )}
    </div>
  );
}
