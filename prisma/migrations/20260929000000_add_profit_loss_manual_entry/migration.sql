-- CreateEnum
CREATE TYPE "profit_loss_section" AS ENUM ('REVENUE', 'CONSTRUCTION_COST', 'MANUFACTURING_COST', 'MERCHANDISE_COST', 'SGA', 'NON_OPERATING_INCOME', 'NON_OPERATING_EXPENSE');

-- CreateTable
CREATE TABLE "profit_loss_manual_entry" (
    "id" SERIAL NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "section" "profit_loss_section" NOT NULL,
    "accountCode" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_loss_manual_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profit_loss_manual_entry_billingYearMonth_idx" ON "profit_loss_manual_entry"("billingYearMonth");

