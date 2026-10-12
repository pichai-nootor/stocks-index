/**
 * ชิ้นแสดงผลฟันที่ใช้ร่วมกันระหว่างหน้า VIP และหน้าหุ้น (แค่หน้าตา — ไม่มีการคำนวณ)
 *   PickDigits: เลขฟัน 2 ตัว (★ = ตัวเด่น) · สีเดิม: เข้า = เหลืองเข้ม · ไม่เข้า = เทาขีดฆ่า · รอผล = เหลืองอ่อน
 *   DrillChips: เลขเจาะ 2 ชุด เป็นชิปเล็ก · ตัวที่มา = เขียวอ่อน
 *   HitBadge: ป้ายผลของงวด (★ เข้า / ตัวรองเข้า / ไม่เข้า / รอผล) + เจาะเข้า
 */

const SIZES = {
  xs: { box: "h-7 w-7 rounded-md text-base", label: "text-[8px] -top-1.5" },
  sm: { box: "h-10 w-10 rounded-xl text-2xl", label: "text-[9px] -top-2" },
  lg: { box: "h-16 w-16 rounded-2xl text-4xl", label: "text-xs -top-2.5" },
} as const;

/**
 * เลขฟัน 2 ตัว — สีเดิมของแอป (ผู้ใช้สั่ง 13 ต.ค. 69): เข้า = เหลืองเข้ม · ไม่เข้า = เทา ขีดฆ่า · รอผล = เหลืองอ่อน · ★ = กรอบแดง + ป้ายดาวแดง
 */
export function PickDigits({ digits, star, hit, size = "sm" }: {
  digits: string[];
  /** ตัวเด่น (ไม่ระบุ = ตัวแรก) */
  star?: string;
  /** เลขที่ออก — null/undefined = ยังไม่ออก */
  hit?: string[] | null;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const main = star ?? digits[0];
  const ordered = [main, ...digits.filter((d) => d !== main)];
  return (
    <span className="inline-flex items-center gap-1.5">
      {ordered.map((d) => {
        const ok = hit ? hit.includes(d) : null;
        const isStar = d === main;
        const tone = ok ? "bg-amber-400 text-white" : ok === false ? "bg-slate-200 text-slate-500 line-through" : "bg-amber-100 text-amber-900";
        return (
          <span key={d} className={`relative inline-flex items-center justify-center font-mono font-bold shadow-sm ${s.box} ${tone} ${isStar ? "ring-2 ring-red-400" : ""}`}>
            {d}
            {isStar && <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 px-1 text-[9px] leading-4 text-white" title="ตัวเด่น">★</span>}
          </span>
        );
      })}
    </span>
  );
}

export function DrillChips({ sets, isHit, size = "sm", inline = false }: {
  sets: { digit: string; numbers: string[] }[];
  /** เลขนี้มาไหม (ตรงหรือกลับ) — ไม่ส่ง = ยังไม่ออกผล */
  isHit?: (m: string) => boolean;
  size?: "sm" | "lg";
  /** วางข้างเลขฟัน (ตาราง) — ไม่เว้นบรรทัดด้านบน */
  inline?: boolean;
}) {
  const chip = size === "lg" ? "px-1.5 py-0.5 text-sm" : "px-1 text-[11px] leading-4";
  return (
    <span className={`flex flex-col gap-1 ${inline ? "" : "mt-1.5"}`}>
      {sets.map((set) => (
        <span key={set.digit} className="flex items-center gap-0.5 whitespace-nowrap font-mono">
          <span className={`mr-0.5 rounded bg-amber-50 font-semibold text-amber-700 ${chip}`}>{set.digit}</span>
          {set.numbers.map((m) => (
            <span key={m} className={`rounded ${chip} ${isHit?.(m) ? "bg-emerald-100 font-semibold text-emerald-800" : "bg-slate-50 text-slate-500"}`}>{m}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

/** ป้ายผลของงวด — hits = เลขฟันที่ออก (ตามลำดับ [★, ตัวรอง]), drillHits = เลขเจาะที่มา */
export function HitBadge({ pick, hits, drillHits, pending }: { pick: string[]; hits: string[] | null; drillHits?: string[] | null; pending?: string }) {
  if (!hits) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{pending ?? "รอผล"}</span>;
  const star = hits.includes(pick[0]);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {hits.length === 2 ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">✓ เข้าทั้งคู่</span>
        : star ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ ★ {pick[0]}</span>
        : hits.length ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ ตัวรอง {hits[0]}</span>
        : <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">✗ ไม่เข้า</span>}
      {drillHits && drillHits.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">เจาะ {drillHits.join(" ")}</span>}
    </span>
  );
}

/** แบบแถวเดียวสำหรับตาราง: เลขฟันซ้าย · เลขเจาะ 2 ชุดขวา (ประหยัดความสูงแถว) */
export function PickRow({ digits, star, hit, drill, isHit, muted = false }: {
  digits: string[];
  star?: string;
  hit?: string[] | null;
  drill: { digit: string; numbers: string[] }[];
  isHit?: (m: string) => boolean;
  /** สูตรรอง (ทดลอง/แผน C) — เล็กและจางกว่าสูตรหลัก */
  muted?: boolean;
}) {
  return (
    <span className={`flex items-center gap-3 whitespace-nowrap ${muted ? "opacity-60 grayscale-[40%]" : ""}`}>
      <PickDigits digits={digits} star={star} hit={hit} size={muted ? "xs" : "sm"} />
      <DrillChips sets={drill} isHit={isHit} inline />
    </span>
  );
}
