import { connection } from "next/server"
import ProfitLossView from "@/features/receipts/ProfitLossView"
import {
  getConfirmedReceiptCardRowsAction,
  getConfirmedReceiptMonthsAction,
  getConfirmedTaxInvoiceRowsAction,
} from "@/app/receipts/actions"
import { getProfitLossManualEntriesAction } from "./actions"

function currentMonthInKorea(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)
}

// 확정/확정취소·수기 입력 직후 바로 반영돼야 하므로 요청마다 렌더링한다.
export default async function ProfitLossPage() {
  await connection()
  const [sales, purchases, receipts, manual, salesMonths, purchaseMonths, receiptMonths] = await Promise.all([
    getConfirmedTaxInvoiceRowsAction("SALES"),
    getConfirmedTaxInvoiceRowsAction("PURCHASE"),
    getConfirmedReceiptCardRowsAction(),
    getProfitLossManualEntriesAction(),
    getConfirmedReceiptMonthsAction("SALES"),
    getConfirmedReceiptMonthsAction("PURCHASE"),
    getConfirmedReceiptMonthsAction("RECEIPT"),
  ])
  return (
    <ProfitLossView
      sales={sales}
      purchases={purchases}
      receipts={receipts}
      manual={manual}
      confirmedMonths={{ sales: salesMonths, purchase: purchaseMonths, receipt: receiptMonths }}
      currentMonth={currentMonthInKorea()}
    />
  )
}
