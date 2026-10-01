// 키스트론 발전소의 계약차수(PlantMaster.contractPhase)를 한 번에 채우는 일회성 스크립트.
// 매핑은 사용자가 준 `양식/계약 차수.xlsx`와 2번 엑셀(통합 확정본) 2026 시트를 대조해
// 2026-10-01 사용자 확인을 받은 표다. HYROPE 1차는 앱에 없어 제외.
// 빠진 차수 번호(13·14·16·17·19·22차 등)는 다른 차수에 합산돼 있어 따로 두지 않는다.
//
// 사용법:
//   npx tsx scripts/import-contract-phase.ts          # 바뀔 내용만 출력
//   npx tsx scripts/import-contract-phase.ts --apply  # 저장
import dotenv from "dotenv"
dotenv.config({ path: ".env", quiet: true })
dotenv.config({ path: ".env.local", override: true, quiet: true })

import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "../src/generated/prisma/client"

const PHASE_BY_PLANT_ID: Record<number, number> = {
  161: 1, 162: 1, 163: 1, 164: 1, 165: 1, 166: 1, 167: 1, 168: 1, 169: 1, 170: 1,
  171: 2, 172: 2, 173: 2, 174: 2,
  175: 3, 176: 3, 177: 3, 178: 3,
  179: 4,
  180: 5,
  181: 6, 182: 6, 183: 6,
  184: 7, 185: 7,
  186: 8,
  187: 9, 188: 9, 189: 9,
  190: 10, 191: 10,
  192: 11, 193: 11, 194: 11,
  195: 12, 196: 12,
  197: 15,
  198: 18,
  199: 20,
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
})

async function main() {
  const apply = process.argv.includes("--apply")
  const ids = Object.keys(PHASE_BY_PLANT_ID).map(Number)
  const plants = await prisma.plantMaster.findMany({
    where: { id: { in: ids } },
    select: { id: true, plantAlias: true, plantName: true, contractPhase: true, clientGroupId: true },
    orderBy: { id: "asc" },
  })
  const missing = ids.filter((id) => !plants.some((p) => p.id === id))
  if (missing.length > 0) throw new Error(`발전소를 찾을 수 없음: ${missing.join(", ")}`)

  const changes = plants.filter((p) => p.contractPhase !== PHASE_BY_PLANT_ID[p.id])
  for (const p of plants) {
    const next = PHASE_BY_PLANT_ID[p.id]
    const mark = p.contractPhase === next ? "  " : "* "
    console.log(`${mark}${p.id} ${p.plantAlias ?? p.plantName}: ${p.contractPhase ?? "-"} -> ${next}차`)
  }
  console.log(`\n변경 ${changes.length}건 / 전체 ${plants.length}건`)

  if (!apply) {
    console.log("저장하지 않았습니다. 저장하려면 --apply를 붙여 실행하세요.")
    return
  }
  if (changes.length === 0) return
  // 발전소별 update를 트랜잭션에 넣으면 원격 DB 왕복이 쌓여 5초 제한을 넘기므로 SQL 한 번으로 저장한다.
  const values = changes.map((p) => Prisma.sql`(${p.id}::int, ${PHASE_BY_PLANT_ID[p.id]}::int)`)
  await prisma.$executeRaw`
    UPDATE "plant_master" AS p SET "contractPhase" = v.phase, "updatedAt" = now()
    FROM (VALUES ${Prisma.join(values)}) AS v(id, phase)
    WHERE p."id" = v.id`
  console.log(`${changes.length}건 저장했습니다.`)
}

main().finally(() => prisma.$disconnect())
