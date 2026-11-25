// SMP 요금안내 메일을 PDF로 인쇄하기 위한 HTML 조립부.
// email-pdf-render.ts(server-only)와 확인용 스크립트(scripts/render-smp-pdf.ts)가
// 같은 양식을 쓰도록 "server-only" 가드 없이 분리해 둔다.
import { readFileSync } from "node:fs"
import path from "node:path"

export type EmailPdfSource = {
  subject: string
  receivedDate: Date | null
  html: string
  // 받는사람 표기 — "이름<주소>" 형식. 비어 있으면 줄 자체는 남기되 값만 비운다.
  toLabel: string
}

// 한전 요금안내 메일의 발신자는 고정이다.
const SENDER_LABEL = "한국전력공사<kepco@kepco.co.kr>"

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const WEEKDAY_KO: Record<string, string> = {
  Sun: "일",
  Mon: "월",
  Tue: "화",
  Wed: "수",
  Thu: "목",
  Fri: "금",
  Sat: "토",
}

// 다음 웹메일 인쇄본의 받은 날짜 표기(예: 26.11.17 (화) 14:15)를 Asia/Seoul 기준으로 재현.
export function formatMailDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const hour = get("hour") === "24" ? "00" : get("hour")
  const weekday = WEEKDAY_KO[get("weekday")] ?? get("weekday")
  return `${get("year")}.${get("month")}.${get("day")} (${weekday}) ${hour}:${get("minute")}`
}

export function buildEmailPdfHtml({ subject, receivedDate, html, toLabel }: EmailPdfSource): string {
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
  /* 다음 웹메일 인쇄본 머리말: 굵은 제목 + 보낸사람(오른쪽 끝 날짜) + 받는사람 */
  .mail-header { margin-bottom: 12px; }
  .mail-subject {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 10px;
    line-height: 1.4;
  }
  .mail-meta {
    display: flex;
    align-items: baseline;
    font-size: 12px;
    line-height: 1.6;
  }
  .mail-meta .label {
    flex: none;
    width: 56px;
    color: #888;
  }
  .mail-meta .value { flex: 1; min-width: 0; word-break: break-all; }
  .mail-meta .date { flex: none; margin-left: 12px; color: #888; }
  .mail-divider {
    border: 0;
    border-top: 1px solid #ddd;
    margin: 0 0 16px;
  }
  table { border-collapse: collapse; }
  /* 본문 HTML은 그대로 두고, border 속성이 켜진 표만 웹메일 인쇄본처럼
     진한 검은색 1px 실선으로 그린다(레이아웃용 border="0" 표는 제외). */
  table[border]:not([border="0"]),
  table[border]:not([border="0"]) > * > tr > td,
  table[border]:not([border="0"]) > * > tr > th {
    border: 1px solid #000 !important;
  }
  /* 브라우저 기본값(monospace)을 쓰는 pre 태그는 한글 글리프가 없는 폰트로
     떨어질 수 있어 본문 폰트를 명시적으로 강제한다. */
  pre { font-family: inherit; }
</style>
</head>
<body>
<div class="mail-header">
  <h1 class="mail-subject">${escapeHtml(subject)}</h1>
  <div class="mail-meta">
    <span class="label">보낸사람</span>
    <span class="value">${escapeHtml(SENDER_LABEL)}</span>
    <span class="date">${escapeHtml(dateLabel)}</span>
  </div>
  <div class="mail-meta">
    <span class="label">받는사람</span>
    <span class="value">${escapeHtml(toLabel)}</span>
  </div>
</div>
<hr class="mail-divider" />
${html}
</body>
</html>`
}

// 웹메일 인쇄본처럼 배경색(회색 머리칸·노란 강조줄 등)은 인쇄하지 않는다.
export const EMAIL_PDF_OPTIONS = {
  format: "a4",
  printBackground: false,
  margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
} as const
