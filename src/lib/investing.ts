/**
 * ดึงข้อมูลรายวันจาก investing.com (api.investing.com/api/financialdata/historical/<pairId>)
 *   investing บล็อก fetch ของ Node (403 ทุกทาง) — ผ่านได้เมื่อปลอมเป็น Chrome ด้วย Python curl_cffi (pip3 install curl_cffi)
 *   จึงเรียก python3 จากเครื่องที่รันแอป · ล้มเหลวคืน [] ให้ผู้เรียกใช้แหล่งสำรอง
 */
import { execFile } from "node:child_process";

const PY = `
import sys, json
from curl_cffi import requests
pid, start, end = sys.argv[1:4]
r = requests.get(f"https://api.investing.com/api/financialdata/historical/{pid}?start-date={start}&end-date={end}&time-frame=Daily&add-missing-rows=false",
                 impersonate="chrome", headers={"domain-id": "th"}, timeout=20)
r.raise_for_status()
print(json.dumps([[d["rowDateTimestamp"][:10], d["last_openRaw"], d["last_closeRaw"]] for d in r.json()["data"]]))
`;
const PYTHONS = [process.env.INVESTING_PYTHON, "/Library/Frameworks/Python.framework/Versions/3.13/bin/python3", "python3"].filter(Boolean) as string[];
const r2 = (x: number) => Math.round(x * 100) / 100;

export type InvestingDay = { date: string; open: number; close: number };

/** แถวรายวัน เรียงเก่า→ใหม่ · ราคาปัด 2 ตำแหน่ง (ค่า raw ของ investing เป็น float เช่น 52854.94921875 → 52,854.95 ตามหน้าเว็บ) */
export async function investingDaily(pairId: number, start: string, end: string): Promise<InvestingDay[]> {
  for (const py of PYTHONS) {
    const out = await new Promise<string | null>((resolve) =>
      execFile(py, ["-c", PY, String(pairId), start, end], { timeout: 30000 }, (err, stdout) => resolve(err ? null : stdout)));
    if (!out) continue;
    try {
      const rows = (JSON.parse(out) as [string, number | string, number | string][]).map(([date, o, c]) => ({ date, open: r2(Number(o)), close: r2(Number(c)) }));
      return rows.filter((r) => Number.isFinite(r.open) && Number.isFinite(r.close)).sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      continue;
    }
  }
  return [];
}
