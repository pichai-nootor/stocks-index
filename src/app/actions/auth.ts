"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";

export type ActionState = { error?: string } | undefined;

const loginSchema = z.object({
  username: z.string().trim().min(1, "กรุณากรอกชื่อผู้ใช้"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
  next: z.string().optional(),
});

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { username, password, next } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };

  await createSession({ userId: user.id, username: user.username });
  redirect(next && next.startsWith("/") ? next : "/summary");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
