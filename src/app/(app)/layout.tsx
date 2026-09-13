import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireUser();
  return (
    <>
      <Nav username={session.username} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
