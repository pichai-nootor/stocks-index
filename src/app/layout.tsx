import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stocks Index — สถิติเปิด/ปิดหุ้น",
  description: "บันทึกสถิติราคาเปิด/ปิดหุ้น เพื่อคาดการณ์ราคาปิดครั้งถัดไป",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      {/* suppressHydrationWarning: extension (ColorZilla ฯลฯ) ใส่ attribute ลง body ก่อน React hydrate — ไม่ใช่ปัญหาจากโค้ด */}
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900" suppressHydrationWarning>{children}</body>
    </html>
  );
}
