/**
 * แปลง CSV ประวัติราคาจาก Investing.com (ไทย/อังกฤษ) เป็นแถวบันทึก
 * คอลัมน์ที่ใช้: วันที่, ล่าสุด/ปิด (Price), ราคาเปิด (Open)
 * "เปลี่ยนแปลง" ตอนเปิด/ปิด คำนวณจาก ปิดของแถวก่อนหน้า (เก่ากว่า 1 แถว)
 */

export type ImportRow = { date: Date; openValue: number; openChange: number; closeValue: number; closeChange: number };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const num = (s: string) => Number(s.replace(/,/g, ""));

function parseDate(s: string): Date | null {
  // MM/DD/YYYY (Investing) หรือ YYYY-MM-DD หรือ DD/MM/YYYY (ถ้าเดือน > 12)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (Number(a) > 12) [a, b] = [b, a]; // DD/MM → MM/DD
    return new Date(`${y}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`);
  }
  return null;
}

export function parseInvestingCsv(text: string): { rows: ImportRow[]; skipped: number; error?: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], skipped: 0, error: "ไฟล์ว่าง" };
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/"/g, "").toLowerCase());
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iDate = find("วันเดือนปี", "date", "วันที่");
  const iClose = find("ล่าสุด", "price", "ปิด", "close");
  const iOpen = find("ราคาเปิด", "open", "เปิด");
  if (iDate < 0 || iClose < 0 || iOpen < 0) {
    return { rows: [], skipped: 0, error: `ไม่พบคอลัมน์ วันที่/ปิด/เปิด (พบ: ${header.join(", ")})` };
  }

  const raw: { date: Date; close: number; open: number }[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const date = parseDate(c[iDate] ?? "");
    const close = num(c[iClose] ?? ""), open = num(c[iOpen] ?? "");
    if (!date || !Number.isFinite(close) || !Number.isFinite(open) || close <= 0 || open <= 0) { skipped++; continue; }
    raw.push({ date, close, open });
  }
  raw.sort((a, b) => a.date.getTime() - b.date.getTime());

  // แถวแรกสุดไม่มี "ปิดก่อนหน้า" → ใช้เป็นฐานเท่านั้น
  const rows: ImportRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1].close, r = raw[i];
    rows.push({
      date: r.date,
      openValue: r.open,
      openChange: Math.round((r.open - prev) * 100) / 100,
      closeValue: r.close,
      closeChange: Math.round((r.close - prev) * 100) / 100,
    });
  }
  return { rows, skipped: skipped + (raw.length ? 1 : 0) };
}
