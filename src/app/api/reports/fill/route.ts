import { NextResponse } from "next/server"

import { fillReportFile } from "@/lib/report-fill/fill"

// 제출 엑셀(1·2·3번 매출 보고서)에 고른 귀속월 값을 채운다. 파일이 2~3MB라
// 서버 액션 본문 한도(1MB) 대신 라우트 핸들러로 받는다. 채운 파일은 결과 안내와
// 함께 돌려줘야 해서 JSON(base64)으로 응답한다.
export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  const month = String(form.get("month") ?? "")
  const clientGroupId = Number(form.get("clientGroupId"))

  if (!(file instanceof File)) {
    return NextResponse.json({ status: "error", error: "파일을 올려 주세요." }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(clientGroupId)) {
    return NextResponse.json(
      { status: "error", error: "귀속월과 거래처를 확인해 주세요." },
      { status: 400 },
    )
  }

  const result = await fillReportFile(await file.arrayBuffer(), month, clientGroupId)
  if (result.status !== "ok") {
    return NextResponse.json(result, { status: result.status === "error" ? 422 : 200 })
  }
  return NextResponse.json({
    status: "ok",
    report: result.report,
    fileName: outputFileName(file.name),
    base64: result.file.toString("base64"),
  })
}

// "260921_[쏠라크리닉] …" 처럼 앞에 작성일(YYMMDD_)이 붙은 이름이면 오늘 날짜로 바꾼다.
function outputFileName(original: string): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "")
  const name = original.toLowerCase().endsWith(".xlsx") ? original : `${original}.xlsx`
  return /^\d{6}_/.test(name) ? `${today}_${name.slice(7)}` : `${today}_${name}`
}
