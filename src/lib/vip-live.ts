/**
 * "เลขจากราคาสด" ของหุ้น VIP — ผล VIP = หลักหน่วย + ทศนิยมของราคา ณ เวลาออกผล
 *   ตรวจ 23 ก.ย. 69 (จีน VIP รอบเช้า): ราคาสดเวลา 11:05 = 32,823.60 → ผลจริง บน 360 ✓ ตรงเป๊ะ
 * ดังนั้นราคาสดก่อนออกผล = เลขตั้งต้นที่ใกล้ผลที่สุดเท่าที่มีข้อมูล (คนละทางกับโมเดลพฤติกรรม)
 * ไฟล์นี้ไม่ยุ่งกับสูตรของตลาดไหน — เป็นการ "อ่านราคา" ล้วน ๆ และเก็บ log ไว้วัดผลภายหลัง
 */
import fs from "node:fs/promises";
import path from "node:path";

/** เลขที่จะออกถ้าผลถูกประกาศ ณ ราคานี้: บน 3 หลัก (หลักหน่วย+ทศนิยม) และเลขโดด */
export function liveTop3(price: number) {
  return String(Math.round(Math.abs(price) * 100) % 1000).padStart(3, "0");
}
export function liveDigits(price: number) {
  const top = liveTop3(price);
  return { top, digits: [...new Set(top.slice(-2).split(""))], unit: top[0] };
}

const DIR = path.join(process.cwd(), "data", "vip-live");

/** เก็บราคาสด 1 บรรทัดต่อนาที (JSONL ต่อ ตลาด+วัน) ไว้ทดสอบภายหลังว่าอ่านก่อนออกกี่นาทีแม่นสุด */
export async function logLivePrice(market: string, date: string, time: string, price: number, diff: number) {
  try {
    await fs.mkdir(DIR, { recursive: true });
    const file = path.join(DIR, `${market}-${date}.jsonl`);
    const line = JSON.stringify({ t: time, p: price, d: diff });
    const cur = await fs.readFile(file, "utf8").catch(() => "");
    if (cur.includes(`"t":"${time}"`)) return; // นาทีนี้เก็บแล้ว
    await fs.appendFile(file, line + "\n");
  } catch {
    // เก็บ log ไม่ได้ก็ไม่เป็นไร ไม่ให้กระทบหน้าจอ
  }
}

/** อ่าน log ของวัน (เรียงตามเวลา) */
export async function readLiveLog(market: string, date: string): Promise<{ t: string; p: number; d: number }[]> {
  try {
    const txt = await fs.readFile(path.join(DIR, `${market}-${date}.jsonl`), "utf8");
    return txt.split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.t.localeCompare(b.t));
  } catch {
    return [];
  }
}
