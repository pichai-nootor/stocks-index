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
| `/stocks/[id]` | บันทึกสถิติ เปิด/ปิด ต่อวัน + ตารางประวัติ + สถิติสรุปของหุ้นนั้น |
| `/predict` | เลือกหุ้น + ใส่ราคาเปิด → คาดการณ์ราคาปิด |

## วิธีคาดการณ์ (`src/lib/stats.ts`)
คำนวณ `% เปลี่ยน = (ปิด − เปิด) / เปิด` ของทุกสถิติ แล้วให้ค่าคาดการณ์ 4 แบบ
1. **ค่าเฉลี่ย** — เปิด × (1 + avg%)
2. **มัธยฐาน** — ทนต่อค่าผิดปกติ
3. **N ครั้งล่าสุด** — จับแนวโน้มช่วงหลัง (ค่าเริ่มต้น 10 ครั้ง)
4. **ราคาเปิดใกล้เคียง ±3%** — ใช้เฉพาะครั้งที่ราคาเปิดใกล้กับวันนี้

พร้อมช่วงคาดการณ์ ±1 SD และโอกาสปิดบวก (นับจากประวัติ)

## โครงสร้าง
```
prisma/schema.prisma        User → Stock → Record(date, open, close, note)
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
