/**
 * วิเคราะห์ "เลข" จากผลเปิด/ปิดของดัชนี (แบบ SENSEX)
 *   3 ตัวบน  = หลักหน่วย + ทศนิยม 2 ตำแหน่ง ของค่าดัชนี   เช่น 74,781.76 → "176"
 *   2 ตัวล่าง = ทศนิยม 2 ตำแหน่ง ของค่าเปลี่ยนแปลง         เช่น −120.83  → "83"
 * แล้วดูว่าเลขโดด (0–9) ตัวไหนโผล่บ่อย / เด้งซ้ำติดกันหลายวัน
 */

export type DigitSource = {
  date: Date;
  openValue: number;
  openChange: number;
  closeValue: number;
  closeChange: number;
};

/** "176" จาก 74781.76 */
export function top3(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  return String(cents % 1000).padStart(3, "0");
}

/** "83" จาก −120.83 */
export function bottom2(change: number): string {
  const cents = Math.round(Math.abs(change) * 100);
  return String(cents % 100).padStart(2, "0");
}

export const uniqueDigits = (s: string) => [...new Set(s.split(""))];

export type DayDigits = {
  date: Date;
  openTop3: string;
  openBottom2: string;
  closeTop3: string;
  closeBottom2: string;
  /** เลขโดดทั้งหมดที่ปรากฏตอนปิด (บน+ล่าง) */
  closeDigits: string[];
  /** เลขโดดทั้งหมดที่ปรากฏตอนเปิด */
  openDigits: string[];
  /** เลขที่ปิดวันนี้ซ้ำกับปิดเมื่อวาน (= "เด้ง") */
  bouncedFromPrev: string[];
  /** เลขที่ปิดวันนี้ซ้ำกับตอนเปิดวันนี้ */
  fromOpen: string[];
};

export function toDayDigits(records: DigitSource[]): DayDigits[] {
  const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
  const out: DayDigits[] = [];
  for (const r of sorted) {
    const closeTop3 = top3(r.closeValue);
    const closeBottom2 = bottom2(r.closeChange);
    const openTop3 = top3(r.openValue);
    const openBottom2 = bottom2(r.openChange);
    const closeDigits = uniqueDigits(closeTop3 + closeBottom2);
    const openDigits = uniqueDigits(openTop3 + openBottom2);
    const prev = out[out.length - 1];
    out.push({
      date: r.date,
      openTop3,
      openBottom2,
      closeTop3,
      closeBottom2,
      closeDigits,
      openDigits,
      bouncedFromPrev: prev ? closeDigits.filter((d) => prev.closeDigits.includes(d)) : [],
      fromOpen: closeDigits.filter((d) => openDigits.includes(d)),
    });
  }
  return out;
}

export type DigitStat = {
  digit: string;
  /** จำนวนวัน (ในช่วงที่ดู) ที่โผล่ในเลขปิด (บนหรือล่าง) */
  days: number;
  inBottom: number; // โผล่ใน 2 ตัวล่าง
  inTop: number; // โผล่ใน 3 ตัวบน
  /** เด้งติดกันกี่วันล่าสุด (นับจากวันล่าสุดย้อนขึ้นไป) */
  streak: number;
  /** ห่างจากครั้งล่าสุดที่โผล่กี่วัน (0 = โผล่วันล่าสุด) */
  gap: number;
  /** โผล่วันนี้แล้ว → พรุ่งนี้โผล่ซ้ำกี่ % (จากประวัติทั้งหมด) */
  repeatRate: number;
  score: number;
};

export type DigitAnalysis = {
  days: DayDigits[];
  window: number;
  stats: DigitStat[]; // เรียงตาม score มาก → น้อย
  hot1: DigitStat | null;
  hot2: DigitStat[];
  /** สัดส่วนวันที่มีเลขปิดซ้ำกับปิดเมื่อวานอย่างน้อย 1 ตัว */
  bounceDayRate: number;
  /** สัดส่วนวันที่มีเลขปิดซ้ำกับตอนเปิดอย่างน้อย 1 ตัว */
  fromOpenDayRate: number;
  /** เลขที่ควรจับตาจากวันล่าสุด (ปิดล่าสุด) */
  lastClose: DayDigits | null;
};

export function analyzeDigits(records: DigitSource[], window = 10): DigitAnalysis {
  const days = toDayDigits(records);
  const recent = days.slice(-window);
  const n = recent.length;

  const stats: DigitStat[] = "0123456789".split("").map((digit) => {
    const inBottom = recent.filter((d) => d.closeBottom2.includes(digit)).length;
    const inTop = recent.filter((d) => d.closeTop3.includes(digit)).length;
    const daysCount = recent.filter((d) => d.closeDigits.includes(digit)).length;

    let streak = 0;
    for (let i = days.length - 1; i >= 0 && days[i].closeDigits.includes(digit); i--) streak++;

    let gap = days.length; // ไม่เคยโผล่
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].closeDigits.includes(digit)) { gap = days.length - 1 - i; break; }
    }

    let appeared = 0, repeated = 0;
    for (let i = 0; i < days.length - 1; i++) {
      if (days[i].closeDigits.includes(digit)) {
        appeared++;
        if (days[i + 1].closeDigits.includes(digit)) repeated++;
      }
    }
    const repeatRate = appeared ? repeated / appeared : 0;

    // คะแนน: ความถี่ช่วงหลัง + โบนัสเด้งติดกัน + แนวโน้มซ้ำ
    const score = n
      ? (daysCount / n) * 0.5 + (Math.min(streak, 3) / 3) * 0.3 + repeatRate * 0.2 * (streak > 0 ? 1 : 0)
      : 0;

    return { digit, days: daysCount, inBottom, inTop, streak, gap, repeatRate, score };
  });

  const ranked = [...stats].sort((a, b) => b.score - a.score || b.streak - a.streak || b.days - a.days);
  const withPrev = days.slice(1);

  return {
    days,
    window: n,
    stats: ranked,
    hot1: n ? ranked[0] : null,
    hot2: n ? ranked.slice(0, 2) : [],
    bounceDayRate: withPrev.length ? withPrev.filter((d) => d.bouncedFromPrev.length > 0).length / withPrev.length : 0,
    fromOpenDayRate: days.length ? days.filter((d) => d.fromOpen.length > 0).length / days.length : 0,
    lastClose: days[days.length - 1] ?? null,
  };
}
