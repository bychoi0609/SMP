import * as XLSX from 'xlsx'

export interface RawSheet {
  name: string
  rows: string[][]
}

export interface RawWorkbook {
  fileName: string
  sheets: RawSheet[]
}

export async function readWorkbookFromFile(file: File): Promise<RawWorkbook> {
  const buffer = await file.arrayBuffer()
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    throw new Error(`"${file.name}" 파일을 열 수 없습니다. 엑셀(.xls/.xlsx) 형식이 맞는지 확인해주세요.`)
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error(`"${file.name}" 파일에 시트가 없습니다.`)
  }

  const sheets: RawSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    })
    return { name, rows }
  })

  return { fileName: file.name, sheets }
}
