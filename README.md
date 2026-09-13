# Stocks Index — สถิติเปิด/ปิดหุ้น

ระบบบันทึกสถิติราคา **เปิด/ปิด** ของหุ้นด้วยตัวเอง แล้วใช้สถิติที่สะสมไว้คาดการณ์ราคาปิดครั้งถัดไป

## Stack
- Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind v4
- Prisma 6 + SQLite (ไฟล์ `prisma/dev.db`)
- Auth: username/password (bcrypt) + JWT ใน httpOnly cookie (`jose`)

## เริ่มใช้งาน
```bash
npm install
cp .env.example .env     # แก้ AUTH_SECRET และ SEED_USERNAME/SEED_PASSWORD ตามต้องการ
npm run setup            # generate client + สร้าง DB + สร้างผู้ใช้เริ่มต้น
npm run dev              # http://localhost:3000
```
ผู้ใช้เริ่มต้น: `admin` / `admin1234` (เปลี่ยนได้ใน `.env` ก่อนรัน `npm run setup`)

## เมนู
| หน้า | ทำอะไร |
|---|---|
| `/login` | เข้าสู่ระบบ |
| `/dashboard` | ภาพรวมทุกหุ้น: จำนวนสถิติ, สัดส่วนปิดบวก, ค่าเฉลี่ย % |
| `/stocks` | เพิ่ม/ดูรายการหุ้น |
| `/stocks/[id]` | บันทึกสถิติต่อวัน: ค่าดัชนี + เปลี่ยนแปลง (+/−) ตอนเปิดและปิด + ตาราง 2×2 รูปแบบ เปิด→ปิด |
| `/predict` | เลือกหุ้น + ใส่ "เปลี่ยนแปลงตอนเปิด" (+/−) → โอกาสปิดบวก/ลบ และค่าปิดคาดการณ์ |

## ข้อมูลที่บันทึก (ต่อวัน)
จากหน้าจอดัชนี เช่น `74,781.76  −120.83  −0.16%`
- **ตอนเปิด**: ค่าดัชนี (74,781.76) และเปลี่ยนแปลงเทียบปิดวันก่อน (−120.83)
- **ตอนปิด**: ค่าดัชนี และเปลี่ยนแปลงเทียบปิดวันก่อน
- ระบบคำนวณ % และ "ปิดวันก่อน" (= ค่าเปิด − เปลี่ยนแปลงตอนเปิด) ให้เอง

## วิธีคาดการณ์ (`src/lib/stats.ts`)
แยกวิเคราะห์ตาม **เครื่องหมายตอนเปิด** — 4 รูปแบบ: เปิด+ปิด+, เปิด+ปิด−, เปิด−ปิด+, เปิด−ปิด−

เมื่อใส่ค่าเปิดวันนี้ (เช่น −120.83) จะดูประวัติ 3 กลุ่ม แล้วให้ "โอกาสปิดบวก" + ค่าปิดเฉลี่ย/มัธยฐาน ของแต่ละกลุ่ม
1. **ทุกครั้งที่เปิดเครื่องหมายเดียวกัน** (เปิด − ทั้งหมด)
2. **เปิดเครื่องหมายเดียวกัน + ขนาดใกล้เคียง** (±50% ของจุดที่เปิด)
3. **10 ครั้งล่าสุด** ที่เปิดเครื่องหมายเดียวกัน

ถ้าใส่ค่าดัชนีตอนเปิดด้วย จะได้ **ค่าปิดคาดการณ์** = ปิดวันก่อน + ค่าปิดเฉลี่ยของกลุ่ม พร้อมช่วง ±1 SD

## โครงสร้าง
```
prisma/schema.prisma        User → Stock → Record(date, openValue, openChange, closeValue, closeChange, note)
src/proxy.ts                redirect ไป /login ถ้ายังไม่ได้ login
src/lib/session.ts          สร้าง/ตรวจ JWT cookie
src/lib/auth.ts             requireUser()
src/lib/stats.ts            สถิติ + คาดการณ์
src/app/actions/            server actions (login, stocks, records)
src/app/(auth)/login        หน้า login
src/app/(app)/              หน้าใน (dashboard, stocks, predict) — มี Nav
```

## Scripts
- `npm run db:push` — sync schema ไป SQLite
- `npm run db:seed` — สร้างผู้ใช้เริ่มต้น
- `npm run db:studio` — เปิด Prisma Studio ดู/แก้ข้อมูล
