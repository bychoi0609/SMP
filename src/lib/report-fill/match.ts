import type { ReportTarget } from "./workbook"

// 파일 속 이름 → 앱 발전소 추천(처음 올릴 때만 쓰고, 사용자가 확인하면 매핑으로 저장한다).
type MatchPlant = { id: number; name: string; plantName: string; capacityKw: number | null }

const compactName = (s: string) => s.replace(/[\s_()+\-.,/·]/g, "")

// 용량이 같은(또는 1% 안쪽인) 발전소가 하나면 그 발전소, 여럿이면 이름 조각이 가장 많이 겹치는 발전소를 추천한다.
export function suggestPlant(target: ReportTarget, plants: MatchPlant[], taken: Set<number>): number | null {
  const free = plants.filter((p) => !taken.has(p.id))
  // 용량이 정확히 같은 발전소, 없으면 1% 안쪽(엑셀에 반올림해 적은 경우, 예: 206 ↔ 205.92)
  const withinCapacity = (tolerance: (cap: number) => number) =>
    target.capacityKw !== null
      ? free.filter(
          (p) =>
            p.capacityKw !== null &&
            Math.abs(p.capacityKw - target.capacityKw!) <= tolerance(target.capacityKw!),
        )
      : []
  const exact = withinCapacity(() => 0.01)
  const byCapacity = exact.length > 0 ? exact : withinCapacity((cap) => cap * 0.01)
  if (byCapacity.length === 1) return byCapacity[0].id

  const pool = byCapacity.length > 1 ? byCapacity : free
  const tokens = target.label
    .split(/[\s_()+\-.,/·]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
  let best: { id: number; score: number } | null = null
  let tie = false
  for (const plant of pool) {
    const haystack = compactName(`${plant.name}${plant.plantName}`)
    const score = tokens.filter((t) => haystack.includes(compactName(t))).length
    if (score === 0) continue
    if (!best || score > best.score) {
      best = { id: plant.id, score }
      tie = false
    } else if (score === best.score) {
      tie = true
    }
  }
  return best && !tie ? best.id : null
}
