import "server-only"
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import type { InvoiceCellWrite } from "./invoice-xls-generator"
import { WRITE_COL } from "./invoice-xls-generator"

const execFileAsync = promisify(execFile)

// 세금계산서 양식(.xls)의 열너비·행높이·셀 서식(음영 등)은 xlsx(SheetJS) 커뮤니티
// 에디션으로 다시 저장하면 소실된다(바이너리 xls 라이터의 한계). 그래서 값을 채울
// 때는 실제 Excel을 백그라운드로 띄워 파일을 열고 지정된 셀 값만 입력한 뒤 그대로
// 저장한다 — 파일을 다시 만드는 게 아니라 그 자리에서 편집하는 방식이라 서식은
// 전혀 건드리지 않는다.
//
// 이 파일들이 위치한 templates/output 폴더는 Excel의 "신뢰할 수 있는 위치"로
// 등록되어 있어야 한다 — 등록되어 있지 않으면 Office의 파일 유효성 검사(File
// Validation)가 레거시 바이너리 .xls를 열지 못하게 막는다(COMException).
const SCRIPT = `
param(
  [Parameter(Mandatory=$true)][string]$FilePath,
  [Parameter(Mandatory=$true)][string]$SheetName,
  [Parameter(Mandatory=$true)][string]$PayloadPath,
  [Parameter(Mandatory=$true)][string]$DateCol,
  [Parameter(Mandatory=$true)][string]$SupplyCol,
  [Parameter(Mandatory=$true)][string]$VatCol,
  [Parameter(Mandatory=$true)][string]$ItemCol,
  [Parameter(Mandatory=$true)][string]$SupplyCol1,
  [Parameter(Mandatory=$true)][string]$VatCol1
)
$ErrorActionPreference = "Stop"
$payload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.AskToUpdateLinks = $false
$excel.ScreenUpdating = $false

$wb = $null
$sheet = $null
try {
  $wb = $excel.Workbooks.Open($FilePath, 0, $false)
  $sheet = $wb.Sheets.Item($SheetName)

  foreach ($w in $payload) {
    # Value2에 문자열/숫자를 번갈아 대입하면 PowerShell의 COM 동적 바인딩
    # 캐시가 꼬여 "Int32를 String으로 캐스팅할 수 없음" 오류가 난다.
    # 매번 명시적으로 캐스팅해 타입을 고정하면 방지된다.
    $sheet.Range("$DateCol$($w.row)").Value2 = [string]$w.writeDate
    $sheet.Range("$SupplyCol$($w.row)").Value2 = [double]$w.supplyAmount
    $sheet.Range("$VatCol$($w.row)").Value2 = [double]$w.vatAmount
    $sheet.Range("$ItemCol$($w.row)").Value2 = [string]$w.item1
    $sheet.Range("$SupplyCol1$($w.row)").Value2 = [double]$w.supplyAmount
    $sheet.Range("$VatCol1$($w.row)").Value2 = [double]$w.vatAmount
  }

  $wb.Save()
} finally {
  if ($wb) { $wb.Close($false) }
  $excel.Quit()
  if ($sheet) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sheet) | Out-Null }
  if ($wb) { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null }
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`

// filePath는 이미 템플릿을 복사해 둔 파일이어야 한다(원본 템플릿을 직접 열지 않는다).
// Excel로 해당 파일을 열어 writes에 담긴 셀 값만 입력하고 같은 파일에 저장한다.
export async function writeInvoiceValuesWithExcel(
  filePath: string,
  sheetName: string,
  writes: InvoiceCellWrite[],
): Promise<void> {
  if (writes.length === 0) return

  const dir = await mkdtemp(path.join(tmpdir(), "smp-invoice-"))
  const scriptPath = path.join(dir, "fill.ps1")
  const payloadPath = path.join(dir, "payload.json")

  try {
    await writeFile(scriptPath, SCRIPT, "utf-8")
    await writeFile(payloadPath, JSON.stringify(writes), "utf-8")

    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-FilePath",
        filePath,
        "-SheetName",
        sheetName,
        "-PayloadPath",
        payloadPath,
        "-DateCol",
        WRITE_COL.WRITE_DATE,
        "-SupplyCol",
        WRITE_COL.SUPPLY_AMOUNT,
        "-VatCol",
        WRITE_COL.VAT_AMOUNT,
        "-ItemCol",
        WRITE_COL.ITEM1,
        "-SupplyCol1",
        WRITE_COL.SUPPLY_AMOUNT1,
        "-VatCol1",
        WRITE_COL.VAT_AMOUNT1,
      ],
      { timeout: 60_000 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Excel로 세금계산서 값을 채우는 중 오류가 발생했습니다 (로컬 PC에 Excel이 설치되어 있고, templates/output 폴더가 Excel의 신뢰할 수 있는 위치로 등록되어 있어야 합니다): ${message}`,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
