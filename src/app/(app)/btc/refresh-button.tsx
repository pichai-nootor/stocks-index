"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** ดึงราคา/ข้อมูลล่าสุดจาก Binance ใหม่ (render หน้าใหม่ฝั่งเซิร์ฟเวอร์) */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" onClick={() => start(() => router.refresh())} disabled={pending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
      {pending ? "กำลังดึง…" : "↻ ดึงราคาล่าสุด"}
    </button>
  );
}
