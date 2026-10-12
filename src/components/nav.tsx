"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

const links = [
  // หน้าแรก = "สรุปผลวันนี้" (/summary) เข้าทางโลโก้ Stocks Index · เมนู "ภาพรวม" เอาออกตามที่ผู้ใช้สั่ง
  { href: "/stocks", label: "หุ้น" },
  { href: "/digits", label: "วิเคราะห์เลขปิด" },
  { href: "/vip", label: "หุ้น VIP" },
  { href: "/lab", label: "ทดลองสูตร" },
  { href: "/method", label: "วิธีคิด" },
] as const;

export function Nav({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/summary" className="font-semibold tracking-tight">
          📈 Stocks Index
        </Link>
        <nav className="flex gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-500">{username}</span>
          <button type="submit" className="btn-ghost">ออกจากระบบ</button>
        </form>
      </div>
    </header>
  );
}
