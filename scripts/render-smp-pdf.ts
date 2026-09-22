// email-pdf-render.ts는 "server-only" 가드가 있어 tsx로 직접 못 띄우므로,
// 비교 목적으로 동일한 로직만 재현한 1회성 스크립트. 프로덕션 코드는 건드리지 않음.
import dotenv from "dotenv"
dotenv.config({ path: ".env" })
dotenv.config({ path: ".env.local", override: true })

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import puppeteer from "puppeteer"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

function loadFontBase64(weight: "Regular" | "Bold"): string {
  const fontPath = path.join(
    process.cwd(),
    "node_modules/pretendard/dist/web/static/woff2",
    `Pretendard-${weight}.woff2`,
  )
  return readFileSync(fontPath).toString("base64")
}

function getFontFacesCss(): string {
  return `
  @font-face { font-family: "Pretendard"; font-weight: 400; src: url(data:font/woff2;base64,${loadFontBase64("Regular")}) format("woff2"); }
  @font-face { font-family: "Pretendard"; font-weight: 700; src: url(data:font/woff2;base64,${loadFontBase64("Bold")}) format("woff2"); }`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function formatMailDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const hour = get("hour") === "24" ? "00" : get("hour")
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")} ${hour}:${get("minute")}:${get("second")} +0900`
}

// email-pdf-render.ts의 buildFullHtml과 완전히 동일한 로직
function buildFullHtml({ subject, receivedDate, html }: { subject: string; receivedDate: Date | null; html: string }): string {
  const dateLabel = receivedDate ? formatMailDate(receivedDate) : ""
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${getFontFacesCss()}
  * { box-sizing: border-box; }
  body { font-family: "Pretendard", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif; font-size: 12px; color: #000; margin: 0; padding: 0; }
  .mail-header { font-size: 11px; color: #444; margin-bottom: 14px; }
  .mail-header div { margin: 1px 0; }
  .mail-header b { font-weight: 700; }
  table { border-collapse: collapse; }
  pre { font-family: inherit; }
</style>
</head>
<body>
<div class="mail-header">
  <div><b>제목:</b> ${escapeHtml(subject)}</div>
  <div><b>보낸사람:</b> "한국전력공사"</div>
  <div><b>받은 날짜:</b> ${escapeHtml(dateLabel)}</div>
</div>
${html}
</body>
</html>`
}

async function main() {
  const id = Number(process.argv[2] ?? 835)
  const row = await prisma.smpMonthly.findUnique({ where: { id }, include: { plant: true } })
  if (!row) throw new Error(`SmpMonthly id=${id} 없음`)
  if (!row.rawEmailHtml || !row.mailSubject) throw new Error(`id=${id}에 rawEmailHtml/mailSubject 캐시 없음`)

  console.log(`대상: #${row.id} [${row.billingYearMonth}] ${row.plant?.plantName} / 제목: ${row.mailSubject}`)

  const fullHtml = buildFullHtml({ subject: row.mailSubject, receivedDate: row.receivedDate, html: row.rawEmailHtml })

  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" })
    await page.evaluateHandle("document.fonts.ready")
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    })
    const outDir = path.join(process.cwd(), "scratchpad", "smp-html-compare")
    const outFile = path.join(outDir, `app-generated-${id}.pdf`)
    writeFileSync(outFile, pdf)
    console.log(`앱 렌더링 PDF 저장: ${outFile}`)
  } finally {
    await browser.close()
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); await pool.end() })
