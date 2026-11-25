import "server-only"
import type { Browser, Page } from "puppeteer-core"

import { buildEmailPdfHtml, EMAIL_PDF_OPTIONS, type EmailPdfSource } from "@/lib/email-pdf-html"

export type { EmailPdfSource }

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
  await page.setContent(buildEmailPdfHtml(source), { waitUntil: "domcontentloaded" })
  await page.evaluateHandle("document.fonts.ready")
  const pdf = await page.pdf(EMAIL_PDF_OPTIONS)
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
