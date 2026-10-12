/**
 * วิธีแทงของผู้ใช้ (12 ต.ค. 69) — ใช้คำนวณทุน/กำไรในหน้าสรุป
 *   รูดเลขฟันทั้ง 2 ตัว: 19 ประตูต่อตัว (เช่น รูด 7 = 07 17 … 97 + 70 … 79) เลขละ 20 บาท ทั้งบนและล่าง
 *   เจาะ 12 ตัว: ตัวละ 20 บาท กลับเลข (78 + 87) ทั้งบนและล่าง
 *   อัตราจ่าย 2 ตัวบน/ล่าง บาทละ 100
 *   → ทุนต่องวด = รูด 2 × 19 × 2 × 20 (1,520) + เจาะ 12 × 2 × 2 × 20 (960) = 2,480 บาท · ถูก 1 ใบ = 2,000 บาท
 *   เลขที่มีทั้ง 2 ตัวฟัน (เช่น 72 เมื่อรูด 7 และ 2) ถูกซื้อซ้ำในรูดทั้งสองชุด → ถูกได้ 2 ใบ
 */
export const BET = { stake: 20, payout: 100, rudDoors: 19 } as const;
export const WIN_PER_TICKET = BET.stake * BET.payout;
/** เงินต่อเลขที่เลือกดูได้ในหน้าสรุป (ค่าเริ่มต้น BET.stake) — ทุน/ได้/กำไรเป็นสัดส่วนตรงกับเงินต่อเลข */
export const STAKES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;
export const parseStake = (x: unknown): number => (STAKES as readonly number[]).includes(Number(x)) ? Number(x) : BET.stake;

/** ทุนต่องวด: รูด (เลขฟัน × 19 ประตู × บน/ล่าง) + เจาะ (เลข × กลับ 2 แบบ × บน/ล่าง) */
export const betCost = (pickCount: number, drillCount: number, stake: number = BET.stake) => stake * 2 * (pickCount * BET.rudDoors + drillCount * 2);

/** จำนวนใบที่ถูกของ 1 ฝั่ง (เลข 2 ตัว n) */
function ticketsOn(n: string, pick: string[], drill: string[]): number {
  const rud = pick.filter((d) => n.includes(d)).length; // รูดแต่ละตัวมี n อยู่ 1 ใบ (เลขเบิ้ลก็ 1 ใบ)
  const dr = drill.filter((m) => m === n || m[1] + m[0] === n).length; // ซื้อทั้งตรงและกลับ → ตรงกับผล 1 ใบ
  return rud + dr;
}

/** ผลการแทงของงวด: ทุน · ใบที่ถูก · เงินที่ได้ · กำไร */
export function betResult(pick: string[], drill: string[], top: string, bottom: string, stake: number = BET.stake) {
  const cost = betCost(pick.length, drill.length, stake);
  const tickets = ticketsOn(top, pick, drill) + ticketsOn(bottom, pick, drill);
  const win = tickets * stake * BET.payout;
  return { cost, tickets, win, profit: win - cost };
}
