import { NextResponse } from "next/server"
import { buildSmpExportWorkbook } from "@/lib/smp-export"

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? undefined
  const buffer = await buildSmpExportWorkbook(month)

  const fileName = month ? `SMP_${month}.xlsx` : `SMP_데이터_전체.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        fileName,
      )}`,
    },
  })
}
