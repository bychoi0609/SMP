"use client"

import dynamic from "next/dynamic"

// 브라우저(localStorage)에만 저장된 데이터를 조회하는 클라이언트 전용 화면이라 서버 렌더링이
// 필요 없다 — SSR을 끄지 않으면 window 접근 때문에 서버에서 에러가 난다.
const MonthlyReceiptsView = dynamic(() => import("@/features/receipts/MonthlyReceiptsView"), {
  ssr: false,
})

export function MonthlyReceiptsClient() {
  return <MonthlyReceiptsView />
}
