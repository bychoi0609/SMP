import "server-only"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { Browser, Page } from "puppeteer-core"

// Vercel의 서버리스 Chromium(Amazon Linux)에는 "맑은 고딕" 등 한글 시스템 폰트가
// 없어 한글이 통째로 누락된 PDF가 나온다. 이미 의존성에 있는 Pretendard(가변 X,
// 정적 woff2)를 base64로 인라인 임베드해 어느 환경에서든 동일하게 렌더링되게 한다.
function loadFontBase64(weight: "Regular" | "Bold"): string {
  const fontPath = path.join(
    process.cwd(),
    "node_modules/pretendard/dist/web/static/woff2",
    `Pretendard-${weight}.woff2`,
  )
  return readFileSync(fontPath).toString("base64")
}

let fontFacesCss: string | null = null
function getFontFacesCss(): string {
  if (!fontFacesCss) {
    fontFacesCss = `
  @font-face {
    font-family: "Pretendard";
    font-weight: 400;
    src: url(data:font/woff2;base64,${loadFontBase64("Regular")}) format("woff2");
  }
  @font-face {
    font-family: "Pretendard";
    font-weight: 700;
    src: url(data:font/woff2;base64,${loadFontBase64("Bold")}) format("woff2");
  }`
  }
  return fontFacesCss
}

// Vercel(서버리스) 환경에서는 puppeteer 완전판의 번들 Chromium을 그대로 못 쓰므로
// @sparticuz/chromium이 제공하는 서버리스 전용 바이너리로 puppeteer-core를 띄운다.
// 로컬 개발 환경(Vercel이 아님)에서는 puppeteer 완전판이 내려받은 Chrome을 그대로 재사용한다.
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, puppeteerCore] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ])
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  const puppeteer = await import("puppeteer")
  const browser = await puppeteer.default.launch({ headless: true })
  return browser as unknown as Browser
}

export type EmailPdfSource = {
  subject: string
  receivedDate: Date | null
  html: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// 원본 메일에서 실제로 보던 "받은 날짜" 표기(예: Thu, 13 Aug 2026 17:56:37 +0900)를 재현.
function formatMailDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const hour = get("hour") === "24" ? "00" : get("hour")
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")} ${hour}:${get("minute")}:${get("second")} +0900`
}

function buildFullHtml({ subject, receivedDate, html }: EmailPdfSource): string {
  const dateLabel = receivedDate ? formatMailDate(receivedDate) : ""

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
${getFontFacesCss()}
  * { box-sizing: border-box; }
  body {
    font-family: "Pretendard", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
    font-size: 12px;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .mail-header {
    font-size: 11px;
    color: #444;
    margin-bottom: 14px;
  }
  .mail-header div { margin: 1px 0; }
  .mail-header b { font-weight: 700; }
  table { border-collapse: collapse; }
  /* 브라우저 기본값(monospace)을 쓰는 pre 태그는 한글 글리프가 없는 폰트로
     떨어질 수 있어 본문 폰트를 명시적으로 강제한다. */
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

let browserPromise: Promise<Browser> | null = null

function getSharedBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser()
  }
  return browserPromise
}

async function renderOnPage(page: Page, source: EmailPdfSource): Promise<Buffer> {
  // 외부 리소스(이미지 등)가 없는 정적 HTML이라 "load" 이벤트까지 기다릴 필요 없이
  // DOM 구성만 끝나면 바로 인쇄해도 된다 — 대량 생성 시 체감 속도에 영향이 큼.
  // 다만 인라인 임베드한 한글 폰트(Pretendard)는 비동기로 디코딩되므로 그것만 대기한다.
  await page.setContent(buildFullHtml(source), { waitUntil: "domcontentloaded" })
  await page.evaluateHandle("document.fonts.ready")
  const pdf = await page.pdf({
    format: "a4",
    printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
  })
  return Buffer.from(pdf)
}

// 단건 생성 — 브라우저를 매번 새로 켜고 끈다 (개별 다운로드 버튼용).
export async function renderEmailToPdf(source: EmailPdfSource): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    return await renderOnPage(page, source)
  } finally {
    await browser.close()
  }
}

// 탭 하나 새로 만들고 닫는 데도 비용이 드므로, 워커별로 탭을 하나만 만들어
// 재사용한다. 이 머신은 코어가 넉넉해 동시 처리량을 높여도 안전하다.
const CONCURRENCY = 12

// 여러 건 생성 — 브라우저 하나를 재사용하고, 탭 여러 개(워커)로 나눠 동시에 렌더링한다
// (한 탭씩 순차 처리하면 46건 기준 3분 이상 걸려 다운로드 버튼 UX가 나빠짐).
// onProgress는 건별 렌더링이 끝날 때마다(완료 순서, 원래 인덱스와 무관) 호출된다 —
// 다운로드 진행률 표시용.
export async function renderEmailsToPdfBatch(
  sources: EmailPdfSource[],
  onProgress?: (index: number, buffer: Buffer) => void,
): Promise<Buffer[]> {
  const browser = await getSharedBrowser()
  const buffers: Buffer[] = new Array(sources.length)

  let cursor = 0
  async function worker() {
    const page = await browser.newPage()
    try {
      while (cursor < sources.length) {
        const index = cursor++
        const buffer = await renderOnPage(page, sources[index])
        buffers[index] = buffer
        onProgress?.(index, buffer)
      }
    } finally {
      await page.close()
    }
  }

  const workerCount = Math.min(CONCURRENCY, sources.length)
  await Promise.all(Array.from({ length: workerCount }, worker))

  return buffers
}
