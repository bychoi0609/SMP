import { NextResponse } from "next/server"
import { buildPlantSampleWorkbook } from "@/lib/plant-import"

export async function GET() {
  const buffer = buildPlantSampleWorkbook()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        "발전소_업로드_샘플.xlsx",
      )}`,
    },
  })
}
