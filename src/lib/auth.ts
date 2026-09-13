import { redirect } from "next/navigation";
import { getSession } from "./session";

/** บังคับให้ login ก่อน — ใช้ใน page / server action ทุกตัวที่ต้องมีผู้ใช้ */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
