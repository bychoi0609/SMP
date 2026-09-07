import { createHmac, timingSafeEqual } from "node:crypto"

// proxy.ts(Node.js 런타임이지만 일반 서버 번들과 다른 방식으로 번들링됨)에서도
// 이 파일을 import하므로, Server Component 전용 번들에서만 동작하는
// "server-only" 가드는 여기서는 쓰지 않는다.

// 1인 운영자 전용 도구라 계정 개념 없이 공용 비밀번호 하나로 전체 사이트를 잠근다.
// 쿠키는 "만료시각.서명" 형태로, AUTH_SECRET으로 서명해 위조/연장을 막는다.
export const SESSION_COOKIE_NAME = "smp_session"
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30일

function sign(value: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET 환경변수가 설정되어 있지 않습니다.")
  return createHmac("sha256", secret).update(value).digest("hex")
}

export function createSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const payload = String(expiresAt)
  return `${payload}.${sign(payload)}`
}

export function isValidSessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false
  const [payload, signature] = value.split(".")
  if (!payload || !signature) return false

  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  const expiresAt = Number(payload)
  return Number.isFinite(expiresAt) && Date.now() < expiresAt
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.SITE_PASSWORD
  if (!expected) throw new Error("SITE_PASSWORD 환경변수가 설정되어 있지 않습니다.")
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  // 길이가 다르면 timingSafeEqual이 바로 던지므로, 길이가 다른 경우엔 항상 실패로 처리한다
  // (그 자체로 타이밍 차이가 나지만, 길이 정보는 애초에 비밀이 아니라 문제되지 않는다).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
