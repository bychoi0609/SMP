-- CreateTable
CREATE TABLE "smp_monthly_confirmation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientGroupId" INTEGER NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "smp_monthly_confirmation_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "smp_monthly_confirmation_clientGroupId_billingYearMonth_key" ON "smp_monthly_confirmation"("clientGroupId", "billingYearMonth");
