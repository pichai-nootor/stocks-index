"use client";

import { useState } from "react";
import { BET } from "@/lib/bet";

type Item = { label: string; pick: string[] | null; drill?: string[][]; status: string };

/**
 * ข้อความก๊อป: ชื่อหุ้น · "รูด ★/ตัวรอง <เงิน> บ" · เลขเจาะชุดละบรรทัด ต่อท้ายชุดสุดท้ายด้วย "บลก <เงิน> บ" (ตามตัวอย่างผู้ใช้) — เฉพาะงวดที่ผลยังไม่ออกและมีเลขแล้ว
 *   (ผู้ใช้ขอ 25 ต.ค. 69 · ใส่เงินต่อเลขตามที่เลือกบนหน้า 2 พ.ย. 69)
 */
export function pendingText(items: Item[], stake: number = BET.stake) {
  return items
    .filter((x) => x.status === "pending" && x.pick)
    .map((x) => {
      const sets = (x.drill ?? []).filter((set) => set.length).map((set) => set.join(" "));
      if (sets.length) sets[sets.length - 1] += ` บลก ${stake}บ`; // บลก = บน ล่าง กลับ
      return [x.label, `รูด ${x.pick!.join("/")}   ${stake}บ`, ...sets].join("\n");
    })
    .join("\n\n");
}

/** title = บรรทัดหัวข้อบนสุดของข้อความที่ copy (เช่น "หุ้น VIP งวดถัดไป · จ. 26 ต.ค. 69") */
/** one = ปุ่มเล็ก copy ทีละหุ้น (ไม่มีตัวเลขจำนวน) · stake = เงินต่อเลขที่เลือกบนหน้า */
export function CopyPending({ items, title, one = false, stake }: { items: Item[]; title?: string; one?: boolean; stake?: number }) {
  const [done, setDone] = useState<"ok" | "fail" | null>(null);
  const body = pendingText(items, stake);
  if (!body) return null;
  const n = body.split("\n\n").length;
  const text = title ? `${title}\n\n${body}` : body;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone("ok");
    } catch {
      setDone("fail");
    }
    setTimeout(() => setDone(null), 2000);
  };
  return (
    <button type="button" onClick={copy} title={text} className={`rounded border border-slate-200 text-slate-600 hover:bg-slate-100 ${one ? "px-1.5 text-[11px]" : "px-2 py-0.5 text-xs"}`}>
      {done === "ok" ? "✓ copied" : done === "fail" ? "copy ไม่ได้" : one ? "📋 copy" : `📋 copy (${n})`}
    </button>
  );
}
