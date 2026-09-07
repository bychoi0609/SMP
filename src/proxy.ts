import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { SESSION_COOKIE_NAME, isValidSessionCookieValue } from "@/lib/session"

// 1인 운영자 전용 도구라 계정 없이 공용 비밀번호 하나로 사이트 전체(페이지 +
// API 라우트)를 잠근다. 로그인 안 된 요청은 전부 /login으로 보낸다.
export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (isValidSessionCookieValue(cookie)) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|icon|login).*)",
  ],
}
