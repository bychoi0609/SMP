"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  SESSION_COOKIE_NAME,
  createSessionCookieValue,
  verifyPassword,
} from "@/lib/session"

export type LoginState = { error?: string }

function safeNextPath(next: string): string {
  // "//evil.com" 같은 프로토콜 상대 URL로의 오픈 리다이렉트를 막는다.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/"
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "")
  const next = safeNextPath(String(formData.get("next") ?? "/"))

  if (!verifyPassword(password)) {
    return { error: "비밀번호가 올바르지 않습니다." }
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  redirect(next)
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect("/login")
}
