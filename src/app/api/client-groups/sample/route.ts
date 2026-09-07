import { NextResponse } from "next/server"
import { buildClientGroupSampleWorkbook } from "@/lib/client-group-import"

export async function GET() {
  const buffer = buildClientGroupSampleWorkbook()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        "거래처_업로드_샘플.xlsx",
      )}`,
    },
  })
}
