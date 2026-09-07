import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { ensureRawEmailData } from "@/lib/kepco-mail"
import { renderEmailToPdf } from "@/lib/email-pdf-render"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const smpMonthlyId = Number(id)
  if (!Number.isInteger(smpMonthlyId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const row = await prisma.smpMonthly.findUnique({
    where: { id: smpMonthlyId },
    include: { plant: true },
  })

  if (!row) {
    return NextResponse.json({ error: "데이터를 찾을 수 없습니다." }, { status: 404 })
  }

  const rawData = (await ensureRawEmailData([row.id])).get(row.id)
  if (!rawData) {
    return NextResponse.json(
      { error: "원본 메일을 불러오지 못했습니다." },
      { status: 404 },
    )
  }

  const pdf = await renderEmailToPdf(rawData)

  const displayName =
    row.plant?.plantAlias ?? row.plant?.plantName ?? row.extractedPlantName ?? `SMP-${row.id}`
  const fileName = `${displayName}_${row.billingYearMonth}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
