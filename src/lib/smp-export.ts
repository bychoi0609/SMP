import "server-only"
import * as XLSX from "xlsx"

import { prisma } from "@/lib/prisma"

const HEADERS = [
  "매칭 상태",
  "발전소명",
  "거래처",
  "귀속월",
  "발전량(kWh)",
  "SMP단가",
  "공급가액",
  "세액",
  "발행상태",
  "메일함",
  "메일 수신일",
]

function toNum(value: unknown): number | "" {
  if (value === null || value === undefined) return ""
  return Number(value)
}

// SMP 카테고리 데이터(매칭 성공 + 검토 필요)를 하나의 엑셀로 내보낸다.
// month가 주어지면 해당 귀속월(적용월) 데이터만 대상으로 한다.
export async function buildSmpExportWorkbook(month?: string): Promise<Buffer> {
  const rows = await prisma.smpMonthly.findMany({
    where: month ? { billingYearMonth: month } : undefined,
    orderBy: [{ billingYearMonth: "desc" }, { createdAt: "asc" }],
    include: { plant: { include: { clientGroup: true } } },
  })

  const aoa = [
    HEADERS,
    ...rows.map((row) => [
      row.parseStatus === "OK" ? "정상" : "검토필요",
      row.plant?.plantAlias ?? row.plant?.plantName ?? row.extractedPlantName ?? "",
      row.plant?.clientGroup.name ?? "",
      row.billingYearMonth,
      toNum(row.generationKwh),
      toNum(row.smpUnitPrice),
      toNum(row.supplyAmount),
      toNum(row.vatAmount),
      row.taxInvoiceStatus === "ISSUED" ? "발행완료" : "미발행",
      row.mailFolder ?? "",
      row.receivedDate ? row.receivedDate.toISOString().slice(0, 10) : "",
    ]),
  ]

  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "SMP 데이터")
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
