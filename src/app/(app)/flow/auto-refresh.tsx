"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** render หน้าใหม่ทุก `sec` วินาที — ให้สัญญาณ "เล่นได้เลย" ขึ้นเองเมื่อผลรอบก่อนหน้าเข้า */
export function AutoRefresh({ sec = 60 }: { sec?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), sec * 1000);
    return () => clearInterval(id);
  }, [router, sec]);
  return null;
}
