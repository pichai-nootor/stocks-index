"use client";

import { useEffect, useRef } from "react";

/** เลื่อนจอมาที่ตำแหน่งนี้ทันทีที่แสดง (ใช้กับผลวิเคราะห์ที่อยู่ลึกในตาราง หลังกดปุ่มแล้วหน้าโหลดใหม่) */
export function ScrollHere() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    return () => clearTimeout(t);
  }, []);
  return <span ref={ref} />;
}
