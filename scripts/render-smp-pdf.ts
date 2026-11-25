// SMP 요금안내 PDF 양식을 실제 메일 1건으로 뽑아보는 확인용 스크립트.
// email-pdf-render.ts는 "server-only" 가드가 있어 tsx로 직접 못 띄우므로,
// 같은 HTML 조립부(email-pdf-html.ts)를 공유해 프로덕션과 동일한 양식으로 렌더링한다.
// 사용: npx tsx scripts/render-smp-pdf.ts [SmpMonthly id] (생략 시 원본 HTML이 있는 최신 건)
import dotenv from "dotenv"
dotenv.config({ path: ".env" })
dotenv.config({ path: ".env.local", override: true })

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import puppeteer from "puppeteer"
import { buildEmailPdfHtml, EMAIL_PDF_OPTIONS } from "../src/lib/email-pdf-html"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const arg = process.argv[2]
  const row = arg
    ? await prisma.smpMonthly.findUnique({ where: { id: Number(arg) }, include: { plant: true } })
    : await prisma.smpMonthly.findFirst({
        where: { rawEmailHtml: { not: null }, mailSubject: { not: null } },
        orderBy: { id: "desc" },
        include: { plant: true },
      })
  if (!row) throw new Error(`SmpMonthly ${arg ? `id=${arg}` : "(원본 HTML 보유 건)"} 없음`)
  if (!row.rawEmailHtml || !row.mailSubject) throw new Error(`id=${row.id}에 rawEmailHtml/mailSubject 캐시 없음`)

  // kepco-mail.ts의 ensureRawEmailData와 같은 대체 규칙: 받는사람이 없으면 IMAP 계정 주소.
  const account = process.env.DAUM_EMAIL?.trim()
  const toLabel = row.mailTo ?? (account ? `${account}<${account}>` : "")

  console.log(`대상: #${row.id} [${row.billingYearMonth}] ${row.plant?.plantName} / 제목: ${row.mailSubject}`)

  const fullHtml = buildEmailPdfHtml({
    subject: row.mailSubject,
    receivedDate: row.receivedDate,
    html: row.rawEmailHtml,
    toLabel,
  })

  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" })
    await page.evaluateHandle("document.fonts.ready")
    const pdf = await page.pdf(EMAIL_PDF_OPTIONS)
    const outDir = path.join(process.cwd(), "scratchpad", "smp-html-compare")
    mkdirSync(outDir, { recursive: true })
    const outFile = path.join(outDir, `app-generated-${row.id}.pdf`)
    writeFileSync(outFile, pdf)
    console.log(`앱 렌더링 PDF 저장: ${outFile}`)
  } finally {
    await browser.close()
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
