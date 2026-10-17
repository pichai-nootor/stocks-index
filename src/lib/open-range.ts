/**
 * วิธีของผู้ใช้ (ทดลอง · 15–16 ต.ค. 69): % ปิดงวดก่อน + % เปิดวันนี้ → คาดช่วง % ปิด → เลขที่ออกบ่อยในช่วงนั้น → รูด 2 ตัว
 *   1) % ปิดงวดก่อน + % เปิดวันนี้ → หา 40 วันในอดีตที่ 2 ค่านี้ใกล้เคียงที่สุด
 *   2) ช่วงปิดที่น่าจะเป็น = ช่วงกลางของ % ปิดใน 40 วันนั้น (25%–75%)
 *   3) ทุกวันในอดีตที่ปิดอยู่ในช่วงนี้ → นับเลข 0–9 ที่ออก
 *   4) 2 เลขที่ออกบ่อยสุด = เลขรูด
 *   แสดงทุกขั้นบนหน้าหุ้น (ผู้ใช้อยากเห็นว่าคิดยังไง) + ไล่ทุกราคาปิดในช่วง (ทีละสตางค์) ว่าเลขไหนมาบ่อย
 *   ทดสอบ 16 ต.ค. 69 (ทุกวันย้อนหลัง): เข้า 55–62% · สูตรเดิม 60–64% · ไม่ใช้กับรอบบ่าย (ผู้ใช้สั่ง)
 * ใช้เฉพาะวันก่อนหน้าวันนั้น (ไม่เห็นผลล่วงหน้า) · ข้อมูลจาก IndexDay (หน้า "สถิติ %")
 * รอบบ่ายไม่มี % เปิดบ่ายย้อนหลัง → ใช้ % ปิดภาคเช้าวันเดียวกันแทน (ราคาเปิดบ่ายใกล้ปิดเช้า)
 */
import { prisma } from "@/lib/prisma";
import { top2, bottom2 } from "@/lib/digits";
import { syncIndexDays, type PctIndex } from "@/lib/pct-stats";

export type RangeDay = { date: string; prevPct: number | null; openPct: number; closePct: number; digits: string };
const pct = (a: number, b: number) => ((a - b) / b) * 100;

/** ประวัติของดัชนีสำหรับวิธีนี้ (เก่า→ใหม่) — null = ดัชนีนี้ไม่มี % เปิดย้อนหลัง (อียิปต์) */
export async function openRangeHistory(key: PctIndex): Promise<RangeDay[] | null> {
  if (key === "eg") return null;
  const amKey = key === "hk-pm16" ? "hk-am" : key.endsWith("-pm") ? (key.replace("-pm", "-am") as PctIndex) : null;
  // เก็บข้อมูลเพิ่มเมื่อว่างหรือเก่าเกิน 3 วัน (ไม่ดึงทุกครั้งที่เปิดหน้า)
  for (const k of amKey ? [key, amKey] : [key]) {
    const last = await prisma.indexDay.findFirst({ where: { key: k }, orderBy: { date: "desc" }, select: { date: true } });
    if (!last || Date.now() - new Date(`${last.date}T00:00:00Z`).getTime() > 3 * 86400000) await syncIndexDays(k);
  }
  const rows = await prisma.indexDay.findMany({ where: { key }, orderBy: { date: "asc" } });
  const am = amKey ? new Map((await prisma.indexDay.findMany({ where: { key: amKey } })).map((r) => [r.date, r])) : null;
  const out: RangeDay[] = [];
  let prevPct: number | null = null;
  for (const r of rows) {
    const closePct = pct(r.close, r.prevClose), before = prevPct;
    prevPct = closePct;
    const openPct = am ? (am.get(r.date) ? pct(am.get(r.date)!.close, r.prevClose) : null) : r.open !== null && r.open !== r.prevClose ? pct(r.open, r.prevClose) : null;
    if (openPct === null) continue;
    out.push({ date: r.date, prevPct: before, openPct, closePct, digits: top2(r.close) + bottom2(r.close - r.prevClose) });
  }
  return out;
}

/** เลขรูดของวันนั้นตามวิธีนี้ พร้อมทุกขั้นของการคิด */
/** prevPct = % ปิดงวดก่อน (จากแถวของหุ้นในแอป) · null = ไม่มี → ใช้ % เปิดอย่างเดียว */
export function openRangePick(hist: RangeDay[], date: string, openPct: number, prevClose: number, prevPct: number | null) {
  const past = hist.filter((d) => d.date < date);
  if (past.length < 100) return null;
  const dist = (d: RangeDay) => (prevPct === null || d.prevPct === null ? Math.abs(d.openPct - openPct) : Math.hypot(d.prevPct - prevPct, d.openPct - openPct));
  const similar = [...past].sort((a, b) => dist(a) - dist(b)).slice(0, 40);
  const near = similar.map((d) => d.closePct).sort((a, b) => a - b);
  const lo = near[10], hi = near[29];
  const band = past.filter((d) => d.closePct >= lo && d.closePct <= hi);
  const cnt = "0123456789".split("").map((d) => ({ d, n: band.filter((x) => x.digits.includes(d)).length })).sort((a, b) => b.n - a.n);
  // ไล่ทุกราคาปิดในช่วง (ทีละสตางค์) → บน/ล่างของแต่ละราคา → เลขไหนมาบ่อย
  const P = Math.round(prevClose * 100), a = Math.round(prevClose * (1 + lo / 100) * 100), b = Math.round(prevClose * (1 + hi / 100) * 100);
  const pc = new Array(10).fill(0);
  for (let c = a; c <= b; c++) for (const d of new Set(String(c % 100).padStart(2, "0") + String(Math.abs(c - P) % 100).padStart(2, "0"))) pc[+d]++;
  const prices = b - a + 1;
  return {
    prevPct, openPct, lo, hi, days: band.length, pick: [cnt[0].d, cnt[1].d], rate: [cnt[0].n / band.length, cnt[1].n / band.length], digitRate: cnt.map((x) => ({ d: x.d, p: x.n / band.length })),
    similar: similar.slice(0, 5).map((d) => ({ date: d.date, prevPct: d.prevPct, openPct: d.openPct, closePct: d.closePct })),
    price: { lo: a / 100, hi: b / 100, n: prices, digitRate: pc.map((n, d) => ({ d: String(d), p: n / prices })).sort((x, y) => y.p - x.p) },
  };
}
