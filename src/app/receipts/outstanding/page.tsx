import { connection } from "next/server"
import OutstandingView from "@/features/receipts/OutstandingView"
import { getConfirmedTaxInvoiceRowsAction } from "@/app/receipts/actions"

function todayInKorea(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// 경과일을 오늘 기준으로 계산해야 하므로 정적 프리렌더링하지 않고 요청마다 렌더링한다.
// 오늘 날짜는 서버(UTC)에서 한국시간으로 맞춰 내려보내 서버/브라우저 렌더 결과를 일치시킨다.
export default async function OutstandingPage() {
  await connection()
  const [salesRows, purchaseRows] = await Promise.all([
    getConfirmedTaxInvoiceRowsAction("SALES"),
    getConfirmedTaxInvoiceRowsAction("PURCHASE"),
  ])
  return <OutstandingView initialSalesRows={salesRows} initialPurchaseRows={purchaseRows} today={todayInKorea()} />
}
