// 한전 "신재생에너지 요금안내" 메일(HTML) → 구조화된 SMP 데이터 파서.
// 실제 수신 메일 샘플(양산, 왕정발전1호)을 기준으로 만든 정규식 기반 파서.
// PDF에서 추출하는 대신, 메일 본문 HTML을 직접 파싱한다 — PDF는 거래처 전달용
// 산출물로 별도 생성한다 (파싱 신뢰도가 더 높고 PDF 텍스트 추출 오차를 피할 수 있음).

export type ParsedKepcoNotice = {
  contractNumber: string | null
  plantName: string | null
  address: string | null
  capacityKw: number | null
  billingYearMonth: string | null // "YYYY-MM"
  prevReading: number | null
  currReading: number | null
  meterMultiplier: number | null
  generationKwh: number | null
  baseUnitPrice: number | null
  smpUnitPrice: number | null
  lossUnitPrice: number | null
  supplyAmount: number | null
  vatAmount: number | null
  subBizNumber: string | null // 선행 0 제거
  kepcoContactEmail: string | null
  invoiceDeadline: string | null // "YYYY-MM-DD"
}

function htmlToPlainText(html: string): string {
  // HTML의 원본 줄바꿈/탭은 의미 없는 공백이므로 먼저 한 줄로 합친 뒤,
  // 아래에서 br/tr/td 같은 태그 경계에만 명시적으로 줄바꿈을 넣는다.
  let s = html.replace(/[\r\n\t]+/g, " ")
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<\/(tr|p|div|table)>/gi, "\n")
  s = s.replace(/<\/td>/gi, " ")
  s = s.replace(/<[^>]+>/g, "")
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  const lines = s.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim())
  const collapsed: string[] = []
  for (const line of lines) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue
    collapsed.push(line)
  }
  return collapsed.join("\n")
}

function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null
  const n = Number(raw.replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

export function parseKepcoNotice(
  html: string,
  subject: string,
  receivedDate: Date | null,
): ParsedKepcoNotice {
  const text = htmlToPlainText(html)
  const lines = text.split("\n")

  const contractNumber =
    subject.match(/계약번호\s*[:：]\s*(\d+)/)?.[1] ?? null

  const plantName =
    text.match(/○\s*발전소명\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ?? null

  const address = text.match(/○\s*주\s*소\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ?? null

  const capacityKw = toNumber(
    text.match(/○\s*용\s*량\s*[:：]\s*([\d.]+)\s*kW/)?.[1],
  )

  const periodMatch = text.match(
    /○\s*발전기간\s*[:：]\s*(\d{4})\.(\d{2})\.\d{2}\s*~\s*\d{4}\.\d{2}\.\d{2}/,
  )
  const billingYearMonth = periodMatch
    ? `${periodMatch[1]}-${periodMatch[2]}`
    : null

  // 전월지침/당월지침/차감지침/계기배수/발전량 표: 헤더 다음 줄에서 값 5개 추출
  let prevReading: number | null = null
  let currReading: number | null = null
  let meterMultiplier: number | null = null
  let generationKwh: number | null = null
  const readingHeaderIdx = lines.findIndex((l) =>
    /전월지침\s*당월지침\s*차감지침\s*계기배수\s*발전량/.test(l),
  )
  if (readingHeaderIdx >= 0) {
    const valueLine = lines
      .slice(readingHeaderIdx + 1)
      .find((l) => l.trim() !== "")
    // 열 순서: 전월지침, 당월지침, 차감지침(=당월-전월, 미저장), 계기배수, 발전량
    const tokens = valueLine?.trim().split(/\s+/) ?? []
    if (tokens.length >= 5) {
      prevReading = toNumber(tokens[0])
      currReading = toNumber(tokens[1])
      meterMultiplier = toNumber(tokens[3])
      generationKwh = toNumber(tokens[4])
    }
  }

  // 기준단가/SMP단가/손실단가: "N 원/kWh"가 3번 나오는 줄
  let baseUnitPrice: number | null = null
  let smpUnitPrice: number | null = null
  let lossUnitPrice: number | null = null
  const priceLine = lines.find(
    (l) => (l.match(/원\s*\/\s*kWh/g) ?? []).length === 3,
  )
  if (priceLine) {
    const nums = [...priceLine.matchAll(/([\d.]+)\s*원\s*\/\s*kWh/g)].map(
      (m) => Number(m[1]),
    )
    ;[baseUnitPrice, smpUnitPrice, lossUnitPrice] = nums
  }

  const amountMatch = text.match(
    /공급가액\s*[:：]\s*([\d,]+)\s*원[\s\S]{0,40}?VAT\s*[:：]\s*([\d,]+)\s*원/,
  )
  const supplyAmount = toNumber(amountMatch?.[1])
  const vatAmount = toNumber(amountMatch?.[2])

  const subBizNumberRaw = text.match(/종사업장\s*번호\s*[:：]\s*0*(\d+)/)?.[1]
  const subBizNumber = subBizNumberRaw ?? null

  const kepcoContactEmail =
    text.match(/(ppa\d+@kepco\.co\.kr)/)?.[1] ?? null

  let invoiceDeadline: string | null = null
  const deadlineMatch = text.match(
    /(\d{1,2})\s*\/\s*(\d{1,2})\s*까지\s*세금계산서\s*발행/,
  )
  if (deadlineMatch && receivedDate) {
    const month = deadlineMatch[1].padStart(2, "0")
    const day = deadlineMatch[2].padStart(2, "0")
    invoiceDeadline = `${receivedDate.getFullYear()}-${month}-${day}`
  } else if (receivedDate) {
    // 개별 지정일이 없으면 안내문 공통 문구("25일전에 세금계산서 제출") 기준으로
    // 메일 수신월 25일을 기본 마감일로 삼는다.
    const year = receivedDate.getFullYear()
    const month = String(receivedDate.getMonth() + 1).padStart(2, "0")
    invoiceDeadline = `${year}-${month}-25`
  }

  return {
    contractNumber,
    plantName,
    address,
    capacityKw,
    billingYearMonth,
    prevReading,
    currReading,
    meterMultiplier,
    generationKwh,
    baseUnitPrice,
    smpUnitPrice,
    lossUnitPrice,
    supplyAmount,
    vatAmount,
    subBizNumber,
    kepcoContactEmail,
    invoiceDeadline,
  }
}
