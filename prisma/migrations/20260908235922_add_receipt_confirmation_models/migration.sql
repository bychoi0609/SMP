-- CreateEnum
CREATE TYPE "receipt_category" AS ENUM ('SALES', 'PURCHASE', 'RECEIPT');

-- CreateEnum
CREATE TYPE "receipt_confirmation_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "tax_invoice_direction" AS ENUM ('SALES', 'PURCHASE');

-- CreateTable
CREATE TABLE "receipt_monthly_confirmation" (
    "id" SERIAL NOT NULL,
    "category" "receipt_category" NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "status" "receipt_confirmation_status" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_monthly_confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_tax_invoice_row" (
    "id" SERIAL NOT NULL,
    "direction" "tax_invoice_direction" NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "writtenDate" TEXT NOT NULL,
    "counterpartyBizNo" TEXT NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "supplyAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL,
    "itemName" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "siteCode" INTEGER,
    "paymentBasisAccount" TEXT NOT NULL,
    "paymentDate" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "approvalNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_tax_invoice_row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_card_row" (
    "id" SERIAL NOT NULL,
    "last4" TEXT NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "supplyAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "siteName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "siteCode" INTEGER,
    "taxType" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_card_row_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_monthly_confirmation_category_billingYearMonth_key" ON "receipt_monthly_confirmation"("category", "billingYearMonth");

-- CreateIndex
CREATE INDEX "receipt_tax_invoice_row_direction_billingYearMonth_idx" ON "receipt_tax_invoice_row"("direction", "billingYearMonth");

-- CreateIndex
CREATE INDEX "receipt_card_row_billingYearMonth_idx" ON "receipt_card_row"("billingYearMonth");
