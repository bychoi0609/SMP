// SMP PDF 서식(글씨크기/폰트/색상 등)이 건마다 다르게 보이는 원인을 진단하기 위한
// 비교 스크립트. SmpMonthly.rawEmailHtml(원본 메일 HTML 캐시)을 여러 건 가져와
// - 실제 메일 HTML(parsedMail.html)인지, 표/서식이 사라진 textAsHtml 폴백인지
// - font-size / font-family / color 값이 건마다 어떻게 다른지
// 를 뽑아 비교하고, 필요하면 원본 HTML을 파일로 덤프해 브라우저로 육안 비교할 수 있게 한다.
//
// 사용법:
//   npx tsx scripts/compare-smp-html.ts --ids 12,34,56
//   npx tsx scripts/compare-smp-html.ts --month 2026-08
//   npx tsx scripts/compare-smp-html.ts --month 2026-08 --dump
import dotenv from "dotenv"
dotenv.config({ path: ".env" })
dotenv.config({ path: ".env.local", override: true })

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

type Args = { ids?: number[]; month?: string; dump?: boolean }

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ids") {
      args.ids = argv[++i].split(",").map((s) => Number.parseInt(s.trim(), 10))
    } else if (argv[i] === "--month") {
      args.month = argv[++i]
    } else if (argv[i] === "--dump") {
      args.dump = true
    }
  }
  return args
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort()
}

function extractFontSizes(html: string): string[] {
  return uniqueSorted(
    Array.from(html.matchAll(/font-size\s*:\s*([\d.]+\s*(?:px|pt|%))/gi)).map((m) =>
      m[1].replace(/\s+/g, "").toLowerCase(),
    ),
  )
}

function extractFontFamilies(html: string): string[] {
  return uniqueSorted(
    Array.from(html.matchAll(/font-family\s*:\s*([^;"'}]+)/gi)).map((m) =>
      m[1].trim().toLowerCase(),
    ),
  )
}

function extractColors(html: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/([\w-]*color)\s*:\s*([^;"'}]+)/gi)) {
    out.add(`${m[1].toLowerCase()}=${m[2].trim().toLowerCase()}`)
  }
  for (const m of html.matchAll(/\b(bgcolor|color)\s*=\s*"([^"]+)"/gi)) {
    out.add(`${m[1].toLowerCase()}(속성)=${m[2].trim().toLowerCase()}`)
  }
  return uniqueSorted(out)
}

type Row = {
  id: number
  billingYearMonth: string
  mailSubject: string | null
  rawEmailHtml: string | null
  extractedPlantName: string | null
  plant: { plantName: string } | null
}

type Fingerprint = {
  id: number
  plant: string
  billingYearMonth: string
  subject: string | null
  htmlLength: number
  sourceGuess: "html" | "textAsHtml 폴백(추정, 서식 없음)" | "empty(내용 없음)"
  hasStyleTag: boolean
  tableCount: number
  tdCount: number
  fontSizes: string[]
  fontFamilies: string[]
  colors: string[]
}

function fingerprint(row: Row): Fingerprint {
  const html = row.rawEmailHtml ?? ""
  const hasTable = /<table/i.test(html)
  const hasTd = /<td/i.test(html)

  let sourceGuess: Fingerprint["sourceGuess"] = "html"
  if (!html) sourceGuess = "empty(내용 없음)"
  else if (!hasTable && !hasTd) sourceGuess = "textAsHtml 폴백(추정, 서식 없음)"

  return {
    id: row.id,
    plant: row.plant?.plantName ?? row.extractedPlantName ?? "(미매칭)",
    billingYearMonth: row.billingYearMonth,
    subject: row.mailSubject,
    htmlLength: html.length,
    sourceGuess,
    hasStyleTag: /<style[\s>]/i.test(html),
    tableCount: (html.match(/<table/gi) ?? []).length,
    tdCount: (html.match(/<td/gi) ?? []).length,
    fontSizes: extractFontSizes(html),
    fontFamilies: extractFontFamilies(html),
    colors: extractColors(html),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.ids && !args.month) {
    console.error(
      "사용법: npx tsx scripts/compare-smp-html.ts --ids 1,2,3  또는  --month 2026-08  [--dump]",
    )
    process.exitCode = 1
    return
  }

  const rows = await prisma.smpMonthly.findMany({
    where: {
      ...(args.ids ? { id: { in: args.ids } } : {}),
      ...(args.month ? { billingYearMonth: args.month } : {}),
    },
    include: { plant: { select: { plantName: true } } },
    orderBy: { id: "asc" },
  })

  if (rows.length === 0) {
    console.log("조건에 맞는 SmpMonthly 행이 없습니다.")
    return
  }

  const prints = rows.map(fingerprint)

  console.log(`\n총 ${prints.length}건 비교\n`)
  for (const p of prints) {
    console.log(`- #${p.id} [${p.billingYearMonth}] ${p.plant}`)
    console.log(`    제목: ${p.subject ?? "(없음)"}`)
    console.log(
      `    추정 소스: ${p.sourceGuess} | HTML 길이: ${p.htmlLength} | <table>: ${p.tableCount}개 | <td>: ${p.tdCount}개 | <style> 태그: ${p.hasStyleTag ? "있음" : "없음"}`,
    )
    console.log(`    font-size: ${p.fontSizes.join(", ") || "(없음)"}`)
    console.log(`    font-family: ${p.fontFamilies.join(" | ") || "(없음)"}`)
    console.log(`    색상: ${p.colors.join(", ") || "(없음)"}`)
    console.log("")
  }

  console.log("=== 차이점 요약 (값이 2가지 이상으로 갈리는 항목만 표시) ===")
  const dims: [string, (p: Fingerprint) => string][] = [
    ["추정 소스(html vs textAsHtml 폴백)", (p) => p.sourceGuess],
    ["<style> 태그 유무", (p) => (p.hasStyleTag ? "있음" : "없음")],
    ["font-size 집합", (p) => p.fontSizes.join(",") || "(없음)"],
    ["font-family 집합", (p) => p.fontFamilies.join(",") || "(없음)"],
    ["색상 집합", (p) => p.colors.join(",") || "(없음)"],
  ]
  let anyDiff = false
  for (const [label, fn] of dims) {
    const values = new Set(prints.map(fn))
    if (values.size > 1) {
      anyDiff = true
      console.log(`\n[${label}]`)
      for (const v of values) {
        const ids = prints
          .filter((p) => fn(p) === v)
          .map((p) => `#${p.id}`)
          .join(", ")
        console.log(`  "${v}" → ${ids}`)
      }
    }
  }
  if (!anyDiff) console.log("(비교 대상 전체가 동일한 값을 가짐)")

  if (args.dump) {
    const dir = path.join(process.cwd(), "scratchpad", "smp-html-compare")
    mkdirSync(dir, { recursive: true })
    for (const row of rows) {
      const plantLabel = (row.plant?.plantName ?? row.extractedPlantName ?? "unknown").replace(
        /[\\/:*?"<>|]/g,
        "_",
      )
      const file = path.join(dir, `${row.id}_${row.billingYearMonth}_${plantLabel}.html`)
      writeFileSync(
        file,
        `<!doctype html><meta charset="utf-8"><title>#${row.id} ${row.billingYearMonth}</title><body>${
          row.rawEmailHtml ?? "(rawEmailHtml 없음)"
        }</body>`,
        "utf-8",
      )
    }
    console.log(
      `\n원본 HTML ${rows.length}건을 ${dir} 에 저장했습니다. 브라우저에서 열어 나란히 놓고 육안으로 비교하세요.`,
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
