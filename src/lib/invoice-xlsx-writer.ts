import "server-only"
import ExcelJS from "exceljs"

import type { InvoiceCellWrite } from "./invoice-xls-generator"
import { WRITE_COL } from "./invoice-xls-generator"

// 세금계산서 양식(.xlsx)의 열너비·행높이·셀 서식(음영 등)은 ExcelJS로 기존
// 워크북을 그대로 읽어 셀 값(value)만 바꾸는 방식으로 보존한다 — 워크북을 새로
// 만드는 게 아니라 기존 셀을 그대로 두고 값만 덮어쓰므로 style은 건드리지 않는다.
//
// 과거에는 이 작업을 PowerShell로 로컬 Excel(COM)을 띄워 처리했다(SheetJS
// 커뮤니티 에디션은 스타일 저장을 지원하지 않아 재직렬화하면 서식이 소실되기
// 때문). 하지만 Vercel 서버리스(Linux) 환경에는 Excel도 PowerShell도 없어서
// 배포된 사이트에서는 항상 실패했다 — ExcelJS는 순수 JS라 서버리스에서도
// 로컬과 동일하게 동작한다.
export async function writeInvoiceValues(
  filePath: string,
  sheetName: string,
  writes: InvoiceCellWrite[],
): Promise<void> {
  if (writes.length === 0) return

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) {
    throw new Error(`양식 파일에서 "${sheetName}" 시트를 찾을 수 없습니다.`)
  }

  for (const w of writes) {
    sheet.getCell(`${WRITE_COL.WRITE_DATE}${w.row}`).value = w.writeDate
    sheet.getCell(`${WRITE_COL.SUPPLY_AMOUNT}${w.row}`).value = w.supplyAmount
    sheet.getCell(`${WRITE_COL.VAT_AMOUNT}${w.row}`).value = w.vatAmount
    sheet.getCell(`${WRITE_COL.ITEM1}${w.row}`).value = w.item1
    sheet.getCell(`${WRITE_COL.SUPPLY_AMOUNT1}${w.row}`).value = w.supplyAmount
    sheet.getCell(`${WRITE_COL.VAT_AMOUNT1}${w.row}`).value = w.vatAmount
  }

  await workbook.xlsx.writeFile(filePath)
}
