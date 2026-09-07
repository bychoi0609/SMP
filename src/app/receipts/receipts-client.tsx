"use client"

import dynamic from "next/dynamic"

// 브라우저(localStorage)에만 데이터를 저장하는 클라이언트 전용 도구라 서버 렌더링이 필요
// 없다 — SSR을 끄지 않으면 window 접근 때문에 서버에서 에러가 난다.
const ReceiptsApp = dynamic(() => import("@/features/receipts/ReceiptsApp"), {
  ssr: false,
})

export function ReceiptsClient() {
  return <ReceiptsApp />
}
