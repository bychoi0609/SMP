import MonthlyInvoicesView from "@/features/receipts/MonthlyInvoicesView"
import { getConfirmedTaxInvoiceRowsAction } from "@/app/receipts/actions"

export default async function MonthlyInvoicesPage() {
  const [salesRows, purchaseRows] = await Promise.all([
    getConfirmedTaxInvoiceRowsAction("SALES"),
    getConfirmedTaxInvoiceRowsAction("PURCHASE"),
  ])
  return <MonthlyInvoicesView initialSalesRows={salesRows} initialPurchaseRows={purchaseRows} />
}
