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
  // maxAge를 지정하지 않으면 브라우저 세션 쿠키가 되어, 브라우저(컴퓨터)를 완전히 껐다 켜면
  // 쿠키가 사라져 다시 로그인해야 한다("계속 사용하기/이전 세션 복원" 브라우저 설정이 켜져 있으면
  // 예외적으로 유지될 수 있음).
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })

  redirect(next)
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  redirect("/login")
}
