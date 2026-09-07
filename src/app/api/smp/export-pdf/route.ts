import { prisma } from "@/lib/prisma"
import { ensureRawEmailData } from "@/lib/kepco-mail"
import { renderEmailsToPdfBatch } from "@/lib/email-pdf-render"

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_")
}

// 응답을 한 번에 몰아 보내는 대신 줄바꿈으로 구분된 JSON(NDJSON)을 스트리밍한다 —
// 다운로드 다이얼로그가 렌더링 진행률(완료 건수/전체 건수)을 실시간으로 표시할 수 있도록.
// 이벤트 종류: {type:"meta",total} → {type:"file",fileName,base64} * N → {type:"done"} | {type:"error",message}
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? undefined
  const rows = await prisma.smpMonthly.findMany({
    where: month ? { billingYearMonth: month } : undefined,
    orderBy: [{ billingYearMonth: "desc" }, { createdAt: "asc" }],
    include: { plant: true },
  })

  const rawDataById = await ensureRawEmailData(rows.map((r) => r.id))
  const usableRows = rows.filter((row) => rawDataById.has(row.id))
  const sources = usableRows.map((row) => rawDataById.get(row.id)!)

  const usedNames = new Set<string>()
  const fileNames = usableRows.map((row) => {
    const displayName =
      row.plant?.plantAlias ??
      row.plant?.plantName ??
      row.extractedPlantName ??
      `SMP-${row.id}`
    let fileName = sanitizeFileName(`${displayName}.pdf`)
    let suffix = 2
    while (usedNames.has(fileName)) {
      fileName = sanitizeFileName(`${displayName}(${suffix}).pdf`)
      suffix++
    }
    usedNames.add(fileName)
    return fileName
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))

      send({ type: "meta", total: sources.length })
      try {
        await renderEmailsToPdfBatch(sources, (index, buffer) => {
          send({
            type: "file",
            fileName: fileNames[index],
            base64: buffer.toString("base64"),
          })
        })
        send({ type: "done" })
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "PDF 생성 중 오류가 발생했습니다.",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  })
}
