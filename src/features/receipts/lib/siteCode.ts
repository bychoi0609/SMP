import { SITE_CODE_DETAIL_MAP } from '../types/tables'

// "구분번호" 입력 시 "세부내역"을 자동으로 채운다 (6→공사, 7→제조, 8→SC본사 기본값).
// 매핑에 없는 값이면 기존 세부내역을 그대로 둔다 — 사용자가 직접 수정한 값을 지우지 않기 위함.
export function deriveDetailForSiteCode(siteCode: number | null, currentDetail: string): string {
  if (siteCode === null) return currentDetail
  return SITE_CODE_DETAIL_MAP[siteCode] ?? currentDetail
}
