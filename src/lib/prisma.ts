import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// better-sqlite3 어댑터는 "file:" 접두어 없는 순수 경로를 받으므로 제거해서 전달.
const adapter = new PrismaBetterSqlite3({
  url: (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, ""),
})

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
