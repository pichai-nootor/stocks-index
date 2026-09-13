import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stocks Index — สถิติเปิด/ปิดหุ้น",
  description: "บันทึกสถิติราคาเปิด/ปิดหุ้น เพื่อคาดการณ์ราคาปิดครั้งถัดไป",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
