"use client"

import dynamic from "next/dynamic"
import type { ReceiptCardRowDTO } from "@/app/receipts/actions"

// 카드 닉네임(카드 마스터)이 여전히 이 브라우저의 localStorage에서 관리되므로 window 접근이 남아있다 —
// SSR을 끄지 않으면 서버에서 에러가 난다.
const MonthlyReceiptsView = dynamic(() => import("@/features/receipts/MonthlyReceiptsView"), {
  ssr: false,
})

export function MonthlyReceiptsClient({ initialEntries }: { initialEntries: ReceiptCardRowDTO[] }) {
  return <MonthlyReceiptsView initialEntries={initialEntries} />
}
