import "server-only"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"

import { prisma } from "@/lib/prisma"
import type { SmpMonthly } from "@/generated/prisma/client"
import { parseKepcoNotice } from "@/lib/kepco-notice-parser"

const KEPCO_SENDER = "kepco@kepco.co.kr"
const SUBJECT_PREFIX = "신재생에너지 요금안내"

// 계좌 관리용으로 만들어둔 시스템/휴지통성 폴더는 스캔 대상에서 제외.
const EXCLUDED_FOLDERS = new Set([
  "Sent Messages",
  "Drafts",
  "Deleted Messages",
  "스팸편지함",
  "내게쓴편지함",
])

export type ScanResult = {
  scannedFolders: number
  matchedMails: number
  created: number
  skippedDuplicate: number
  skippedOtherClient: number
  needsReview: number
  erroredFolders: string[]
}

export function daumClient() {
  const user = process.env.DAUM_EMAIL
  const pass = process.env.DAUM_APP_PASSWORD
  if (!user || !pass) {
    throw new Error(
      "DAUM_EMAIL / DAUM_APP_PASSWORD 환경변수가 설정되어 있지 않습니다.",
    )
  }
  return new ImapFlow({
    host: "imap.daum.net",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    socketTimeout: 30_000,
    greetingTimeout: 15_000,
    connectionTimeout: 15_000,
  })
}

// 한전 메일은 항상 "적용월(발전기간 해당월)"의 다음 달에 도착하므로,
// 적용월로부터 메일 수신 범위(그 다음 달 1일 ~ 다다음 달 1일 전)를 계산한다.
function receivedRangeForBillingMonth(billingYearMonth: string): {
  since: Date
  before: Date
} {
  const [year, month] = billingYearMonth.split("-").map(Number) // month: 1~12
  const since = new Date(year, month, 1) // 발전기간 다음 달 1일
  const before = new Date(year, month + 1, 1)
  return { since, before }
}

// 적용월이 지정되지 않은 경우의 기본값: 전월(가장 최근에 메일이 도착했을 달).
function previousBillingMonth(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

type Candidate = {
  uid: number
  subject: string
  envelopeDate: Date | null
}

// 거래처별로 지정해둔 메일함 폴더 목록(쉼표 구분)을 하나의 집합으로 모은다.
// 지정된 폴더가 하나도 없으면 null을 반환해 "전체 메일함 검색"으로 대체한다.
async function allowedFoldersFromClientGroups(): Promise<Set<string> | null> {
  const clientGroups = await prisma.clientGroup.findMany({
    where: { mailFolders: { not: null } },
    select: { mailFolders: true },
  })

  const folders = new Set<string>()
  for (const { mailFolders } of clientGroups) {
    if (!mailFolders) continue
    for (const raw of mailFolders.split(",")) {
      const folder = raw.trim()
      if (folder) folders.add(folder)
    }
  }

  return folders.size > 0 ? folders : null
}

export async function scanKepcoNotices(
  targetBillingMonth?: string,
  clientGroupId?: number,
): Promise<ScanResult> {
  const client = daumClient()
  const { since, before } = receivedRangeForBillingMonth(
    targetBillingMonth ?? previousBillingMonth(),
  )
  const allowedFolders = await allowedFoldersFromClientGroups()

  const result: ScanResult = {
    scannedFolders: 0,
    matchedMails: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedOtherClient: 0,
    needsReview: 0,
    erroredFolders: [],
  }

  await client.connect()
  try {
    const mailboxes = await client.list()

    for (const mailbox of mailboxes) {
      if (mailbox.flags?.has("\\Noselect")) continue
      if (EXCLUDED_FOLDERS.has(mailbox.path)) continue
      if (allowedFolders && !allowedFolders.has(mailbox.path)) continue

      result.scannedFolders++

      try {
        const candidates = await withMailboxLock(client, mailbox.path, async () => {
          const uids = await client.search({ since, before }, { uid: true })
          if (!uids || uids.length === 0) return []

          // 후보 목록을 먼저 전부 모은 뒤(같은 커넥션에서 fetch 제너레이터를
          // 끝까지 소진하지 않은 채 새 명령을 보내면 프로토콜이 꼬인다),
          // 실제 본문 조회는 이 락 밖에서 순차적으로 진행한다.
          const found: Candidate[] = []
          for await (const msg of client.fetch(
            uids,
            { envelope: true },
            { uid: true },
          )) {
            const fromAddress = msg.envelope?.from?.[0]?.address?.toLowerCase()
            const subject = msg.envelope?.subject ?? ""
            if (
              fromAddress !== KEPCO_SENDER ||
              !subject.startsWith(SUBJECT_PREFIX)
            ) {
              continue
            }
            found.push({
              uid: msg.uid,
              subject,
              envelopeDate: msg.envelope?.date ?? null,
            })
          }
          return found
        })

        for (const candidate of candidates) {
          result.matchedMails++
          await processCandidate({
            client,
            mailboxPath: mailbox.path,
            candidate,
            result,
            clientGroupId,
          })
        }
      } catch (err) {
        result.erroredFolders.push(mailbox.path)
        console.error(`[kepco-mail] ${mailbox.path} 처리 실패:`, err)
      }
    }
  } finally {
    await client.logout().catch(() => client.close())
  }

  return result
}

export async function withMailboxLock<T>(
  client: ImapFlow,
  path: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = await client.getMailboxLock(path)
  try {
    return await fn()
  } finally {
    lock.release()
  }
}

async function processCandidate({
  client,
  mailboxPath,
  candidate,
  result,
  clientGroupId,
}: {
  client: ImapFlow
  mailboxPath: string
  candidate: Candidate
  result: ScanResult
  clientGroupId?: number
}) {
  const existing = await prisma.smpMonthly.findUnique({
    where: {
      mailFolder_mailUid: { mailFolder: mailboxPath, mailUid: candidate.uid },
    },
  })
  if (existing) {
    result.skippedDuplicate++
    return
  }

  const source = await withMailboxLock(client, mailboxPath, async () => {
    let buf: Buffer | undefined
    for await (const part of client.fetch(
      candidate.uid,
      { source: true },
      { uid: true },
    )) {
      buf = part.source
    }
    return buf
  })
  if (!source) return

  const parsedMail = await simpleParser(source)
  const html = (parsedMail.html || parsedMail.textAsHtml || "") as string
  const receivedDate = candidate.envelopeDate ?? parsedMail.date ?? null

  const parsed = parseKepcoNotice(html, candidate.subject, receivedDate)

  const billingYearMonth = parsed.billingYearMonth ?? "unknown"
  const extractedPlantName = parsed.plantName?.trim() ?? null

  // 발전월·발전소명·발전량이 동일한 건은 다른 메일(다른 폴더/UID)로 다시
  // 들어와도 새 행을 만들지 않고 건너뛴다(내용 기준 중복 방지).
  const contentDuplicate = await prisma.smpMonthly.findFirst({
    where: {
      billingYearMonth,
      extractedPlantName,
      generationKwh: parsed.generationKwh,
    },
  })
  if (contentDuplicate) {
    result.skippedDuplicate++
    return
  }

  // 발전소 마스터에 등록된 계약번호가 실제 값이 아니라 임시값(엑셀 일괄 등록
  // 당시 계약번호 없이 넣어둔 플레이스홀더)인 경우가 많아, 계약번호 매칭을
  // 우선시하면 오히려 실패한다. 메일 본문에서 뽑은 발전소명으로 먼저
  // 매칭하고, 실패 시에만 계약번호로 보조 매칭한다.
  let matchedPlant = extractedPlantName
    ? await prisma.plantMaster.findFirst({
        where: { plantName: extractedPlantName },
      })
    : null
  if (!matchedPlant && parsed.contractNumber) {
    matchedPlant = await prisma.plantMaster.findUnique({
      where: { contractNumber: parsed.contractNumber },
    })
  }

  // 특정 거래처를 선택해 수집한 경우, 발전소명 매칭으로 확인된 다른 거래처의
  // 데이터는 이번 수집에서 만들지 않는다(메일함/UID 기준 미생성 상태로 남아
  // 있어 이후 "전체 거래처" 또는 해당 거래처 선택 수집 시 정상적으로 잡힌다).
  if (clientGroupId && matchedPlant && matchedPlant.clientGroupId !== clientGroupId) {
    result.skippedOtherClient++
    return
  }

  const parseStatus = matchedPlant ? "OK" : "NEEDS_REVIEW"
  if (!matchedPlant) result.needsReview++

  try {
    await prisma.smpMonthly.create({
      data: {
        plantId: matchedPlant?.id ?? null,
        extractedPlantName,
        extractedContractNumber: parsed.contractNumber,
        extractedSubBizNumber: parsed.subBizNumber,
        extractedAddress: parsed.address,
        extractedCapacityKw: parsed.capacityKw,
        extractedKepcoContactEmail: parsed.kepcoContactEmail,
        billingYearMonth,
        receivedDate,
        prevReading: parsed.prevReading,
        currReading: parsed.currReading,
        meterMultiplier: parsed.meterMultiplier,
        generationKwh: parsed.generationKwh,
        baseUnitPrice: parsed.baseUnitPrice,
        smpUnitPrice: parsed.smpUnitPrice,
        lossUnitPrice: parsed.lossUnitPrice,
        supplyAmount: parsed.supplyAmount,
        vatAmount: parsed.vatAmount,
        parseStatus,
        mailFolder: mailboxPath,
        mailUid: candidate.uid,
        mailSubject: candidate.subject,
        rawEmailHtml: html,
      },
    })
    result.created++
  } catch {
    // plantId+billingYearMonth 유니크 충돌(이미 확정된 데이터 존재) 등은 건너뜀
    result.skippedDuplicate++
  }
}

export type RawEmailData = {
  subject: string
  html: string
  receivedDate: Date | null
}

// PDF를 "원본 메일 그대로" 인쇄하기 위한 HTML을 반환한다.
// DB에 캐시된 게 있으면 그대로 쓰고, 없으면 메일함 폴더/UID로 다시 조회해 캐시해둔다.
export async function ensureRawEmailData(
  ids: number[],
): Promise<Map<number, RawEmailData>> {
  const rows = await prisma.smpMonthly.findMany({ where: { id: { in: ids } } })

  const result = new Map<number, RawEmailData>()
  const toFetch: SmpMonthly[] = []

  for (const row of rows) {
    if (row.rawEmailHtml && row.mailSubject) {
      result.set(row.id, {
        subject: row.mailSubject,
        html: row.rawEmailHtml,
        receivedDate: row.receivedDate,
      })
    } else if (row.mailFolder && row.mailUid !== null) {
      toFetch.push(row)
    }
  }

  if (toFetch.length === 0) return result

  const byFolder = new Map<string, SmpMonthly[]>()
  for (const row of toFetch) {
    const list = byFolder.get(row.mailFolder!) ?? []
    list.push(row)
    byFolder.set(row.mailFolder!, list)
  }

  const client = daumClient()
  await client.connect()
  try {
    for (const [folder, folderRows] of byFolder) {
      await withMailboxLock(client, folder, async () => {
        for (const row of folderRows) {
          let source: Buffer | undefined
          for await (const part of client.fetch(
            row.mailUid!,
            { source: true },
            { uid: true },
          )) {
            source = part.source
          }
          if (!source) continue

          const parsedMail = await simpleParser(source)
          const html = (parsedMail.html || parsedMail.textAsHtml || "") as string
          const subject = parsedMail.subject ?? row.mailSubject ?? ""

          await prisma.smpMonthly.update({
            where: { id: row.id },
            data: { rawEmailHtml: html, mailSubject: subject },
          })

          result.set(row.id, { subject, html, receivedDate: row.receivedDate })
        }
      })
    }
  } finally {
    await client.logout().catch(() => client.close())
  }

  return result
}
