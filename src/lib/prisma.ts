import { Pool } from "pg"
import { attachDatabasePool } from "@vercel/functions"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

// Fluid Compute에서 함수 인스턴스가 재사용되는 동안 커넥션 풀도 재사용한다.
// attachDatabasePool은 인스턴스가 스핀다운될 때 풀을 안전하게 정리해준다.
const pool =
  globalForPrisma.pgPool ??
  (() => {
    const p = new Pool({ connectionString: process.env.DATABASE_URL })
    attachDatabasePool(p)
    return p
  })()

const adapter = new PrismaPg(pool)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.pgPool = pool
}
