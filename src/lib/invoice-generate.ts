import "server-only"
import { copyFile, mkdir, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { prisma } from "@/lib/prisma"
import { matchInvoiceTemplateRows, SHEET_NAME } from "@/lib/invoice-xls-generator"
import { writeInvoiceValuesWithExcel } from "@/lib/invoice-xls-excel-writer"

function outputDir(): string {
  // 파일을 만들고 바로 읽어서 base64로 반환하는 스크래치 용도라 영속 저장이 필요 없다.
  // Vercel(서버리스)은 /tmp만 쓰기 가능하므로 그쪽을, 로컬 개발에서는 OUTPUT_BASE_DIR(기본 ./output)을 쓴다.
  if (process.env.VERCEL) return path.join(os.tmpdir(), "invoice-output")
  return path.resolve(process.cwd(), process.env.OUTPUT_BASE_DIR ?? "./output")
}

export type GenerateInvoiceResult =
  | { fileName: string; base64: string; unmatchedPlantNames: string[] }
  | { error: string }

// 거래처+귀속월의 정상매칭 SMP 데이터를, 거래처에 등록된 한전 세금계산서
// 일괄등록 양식(.xls) 원본을 그대로 불러와 발전소별 행에 숫자·품목·작성일자만
// 채워 넣는다(양식 자체는 수정하지 않음). 발행 이력은 별도로 남기지 않고,
// 누를 때마다 현재 SMP 데이터 기준으로 새로 생성해 바로 다운로드한다.
export async function generateInvoiceFile(
  clientGroupId: number,
  billingYearMonth: string,
): Promise<GenerateInvoiceResult> {
  const clientGroup = await prisma.clientGroup.findUnique({
    where: { id: clientGroupId },
  })
  if (!clientGroup) return { error: "거래처를 찾을 수 없습니다." }
  if (!clientGroup.invoiceTemplatePath) {
    return { error: "이 거래처에는 등록된 세금계산서 양식이 없습니다." }
  }

  const rows = await prisma.smpMonthly.findMany({
    where: { billingYearMonth, parseStatus: "OK", plant: { clientGroupId } },
    include: { plant: true },
  })
  if (rows.length === 0) {
    return { error: "해당 귀속월의 SMP 데이터가 없습니다." }
  }
  rows.sort(
    (a, b) => (a.plant?.constructionOrder ?? 0) - (b.plant?.constructionOrder ?? 0),
  )

  const templatePath = path.resolve(process.cwd(), clientGroup.invoiceTemplatePath)
  const templateBuffer = await readFile(templatePath)

  const { writes, unmatchedPlantNames } = matchInvoiceTemplateRows(
    templateBuffer,
    rows.map((row) => ({ plant: row.plant!, smpMonthly: row })),
    billingYearMonth,
    new Date(),
  )

  await mkdir(outputDir(), { recursive: true })
  const fileName = `${clientGroup.name}_${billingYearMonth}_세금계산서등록양식.xls`
  const filePath = path.join(outputDir(), fileName)
  await copyFile(templatePath, filePath)
  await writeInvoiceValuesWithExcel(filePath, SHEET_NAME, writes)

  const buffer = await readFile(filePath)
  return { fileName, base64: buffer.toString("base64"), unmatchedPlantNames }
}
