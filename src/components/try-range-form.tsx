"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** ใส่ช่วง % ที่คาดว่าจะปิด → อัปเดตหน้าเดิม (ไม่โหลดใหม่ ไม่เด้งขึ้นบน ค่าที่พิมพ์ไม่หาย) */
export function TryRangeForm({ recordId, from, to }: { recordId: string; from: string; to: string }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [pf, setPf] = useState(from), [pt, setPt] = useState(to);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pf.trim() || !pt.trim()) { setMsg("พิมพ์ช่วง % ทั้ง 2 ช่องก่อน เช่น -0.7 ถึง -0.8"); return; }
    setMsg("");
    const q = new URLSearchParams(sp.toString());
    q.set("tid", recordId); q.set("pf", pf.trim()); q.set("pt", pt.trim());
    start(() => router.replace(`${path}?${q.toString()}`, { scroll: false }));
  };
  return (
    <form onSubmit={submit} className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
      <span className="text-slate-500">คาดปิด</span>
      <input value={pf} onChange={(e) => setPf(e.target.value)} placeholder="พิมพ์ %" inputMode="decimal" className="input w-20 px-1.5 py-0.5 text-[11px]" />
      <span className="text-slate-400">ถึง</span>
      <input value={pt} onChange={(e) => setPt(e.target.value)} placeholder="พิมพ์ %" inputMode="decimal" className="input w-20 px-1.5 py-0.5 text-[11px]" />
      <span className="text-slate-500">%</span>
      <button className="btn-ghost px-1.5 py-0.5 text-[11px]" disabled={pending}>{pending ? "กำลังวิเคราะห์…" : "วิเคราะห์"}</button>
      {msg && <span className="text-amber-700">{msg}</span>}
    </form>
  );
}
