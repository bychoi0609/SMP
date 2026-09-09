import { MonthlyReceiptsClient } from "./monthly-receipts-client"
import { getConfirmedReceiptCardRowsAction } from "@/app/receipts/actions"

export default async function MonthlyReceiptsPage() {
  const entries = await getConfirmedReceiptCardRowsAction()
  return <MonthlyReceiptsClient initialEntries={entries} />
}
