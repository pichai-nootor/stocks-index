import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold">เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-slate-500">Stocks Index — สถิติเปิด/ปิดหุ้น</p>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
