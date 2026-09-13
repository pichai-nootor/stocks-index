import Link from "next/link";

export const PAGE_SIZE = 20;

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((current - 1) * size, current * size), current, totalPages, total: items.length, size };
}

/** แถบเลื่อนหน้า — สร้าง URL จาก base + page (คง query อื่นไว้) */
export function Pagination({ current, totalPages, total, size, href }: {
  current: number; totalPages: number; total: number; size: number; href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const from = (current - 1) * size + 1, to = Math.min(current * size, total);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - current) <= 1,
  );
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm";
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-sm">
      <span className="text-slate-500">แสดง {from}–{to} จาก {total} วัน</span>
      <div className="flex items-center gap-1">
        {current > 1 ? <Link href={href(current - 1)} className={`${btn} border-slate-200 hover:bg-slate-50`}>‹</Link> : <span className={`${btn} border-slate-100 text-slate-300`}>‹</span>}
        {pages.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
            {p === current
              ? <span className={`${btn} border-blue-600 bg-blue-600 text-white`}>{p}</span>
              : <Link href={href(p)} className={`${btn} border-slate-200 hover:bg-slate-50`}>{p}</Link>}
          </span>
        ))}
        {current < totalPages ? <Link href={href(current + 1)} className={`${btn} border-slate-200 hover:bg-slate-50`}>›</Link> : <span className={`${btn} border-slate-100 text-slate-300`}>›</span>}
      </div>
    </nav>
  );
}
