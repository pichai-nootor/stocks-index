"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

/**
 * ป้ายวันที่ที่กดแล้วเปิดปฏิทิน เลือกวันแล้วไปวันนั้นทันที (ผู้ใช้ 4 พ.ย. 69: ไม่ต้องค่อย ๆ เลื่อน)
 * hrefTemplate = ลิงก์ของหน้าที่มี "__DATE__" แทนวันที่ (เก็บ query อื่นไว้ครบ)
 */
export function DateJump({ label, value, max, hrefTemplate }: { label: string; value: string; max: string; hrefTemplate: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={open} className="min-w-28 rounded-md px-2 py-1 text-center font-medium tabular-nums hover:bg-slate-100" title="เลือกวัน">
        {label} <span className="text-xs text-slate-400">▾</span>
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        max={max}
        onChange={(e) => { if (e.target.value) router.push(hrefTemplate.replace("__DATE__", e.target.value)); }}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        tabIndex={-1}
        aria-label="เลือกวัน"
      />
    </span>
  );
}
