-- CreateEnum
CREATE TYPE "parse_status" AS ENUM ('OK', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "tax_invoice_status" AS ENUM ('NOT_ISSUED', 'ISSUED');

-- CreateEnum
CREATE TYPE "rec_status" AS ENUM ('TENTATIVE', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "smp_collection_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "client_group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "bizNumber" TEXT NOT NULL,
    "ceoName" TEXT NOT NULL,
    "address" TEXT,
    "bizType" TEXT,
    "bizItem" TEXT,
    "email" TEXT,
    "mailFolders" TEXT,
    "invoiceTemplatePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kepco_buyer_info" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bizNumber" TEXT NOT NULL DEFAULT '1208200052',
    "name" TEXT NOT NULL DEFAULT '한국전력공사',
    "ceoName" TEXT NOT NULL DEFAULT '김동철',
    "address" TEXT DEFAULT '전라남도 나주시 전력로 55(빛가람동)',
    "bizType" TEXT DEFAULT '전기가스',
    "bizItem" TEXT DEFAULT '전기발전공급',
    "email1" TEXT DEFAULT 'kepcoppa@kepco.co.kr',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kepco_buyer_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_master" (
    "id" SERIAL NOT NULL,
    "plantName" TEXT NOT NULL,
    "plantAlias" TEXT,
    "contractNumber" TEXT,
    "subBizNumber" TEXT,
    "kepcoContactEmail" TEXT,
    "address" TEXT,
    "capacityKw" DECIMAL(65,30),
    "constructionOrder" INTEGER NOT NULL,
    "irradianceRegion" TEXT,
    "clientGroupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plant_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smp_monthly" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER,
    "extractedPlantName" TEXT,
    "extractedContractNumber" TEXT,
    "extractedSubBizNumber" TEXT,
    "extractedAddress" TEXT,
    "extractedCapacityKw" DECIMAL(65,30),
    "extractedKepcoContactEmail" TEXT,
    "billingYearMonth" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3),
    "prevReading" DECIMAL(65,30),
    "currReading" DECIMAL(65,30),
    "meterMultiplier" DECIMAL(65,30),
    "generationKwh" DECIMAL(65,30),
    "baseUnitPrice" DECIMAL(65,30),
    "smpUnitPrice" DECIMAL(65,30),
    "lossUnitPrice" DECIMAL(65,30),
    "supplyAmount" DECIMAL(65,30),
    "vatAmount" DECIMAL(65,30),
    "parseStatus" "parse_status" NOT NULL DEFAULT 'OK',
    "taxInvoiceStatus" "tax_invoice_status" NOT NULL DEFAULT 'NOT_ISSUED',
    "batchId" INTEGER,
    "sourcePdfPath" TEXT,
    "mailFolder" TEXT,
    "mailUid" INTEGER,
    "mailSubject" TEXT,
    "rawEmailHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smp_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_monthly" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "rec_status" NOT NULL DEFAULT 'TENTATIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rec_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smp_monthly_confirmation" (
    "id" SERIAL NOT NULL,
    "clientGroupId" INTEGER NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "status" "smp_collection_status" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smp_monthly_confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_monthly_default" (
    "billingYearMonth" TEXT NOT NULL,
    "baseUnitPrice" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rec_monthly_default_pkey" PRIMARY KEY ("billingYearMonth")
);

-- CreateTable
CREATE TABLE "solar_irradiance_monthly" (
    "id" SERIAL NOT NULL,
    "region" TEXT NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_irradiance_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_batch" (
    "id" SERIAL NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "clientGroupId" INTEGER NOT NULL,
    "batchNo" INTEGER NOT NULL,
    "generatedFilePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_group_name_key" ON "client_group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plant_master_contractNumber_key" ON "plant_master"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "smp_monthly_plantId_billingYearMonth_key" ON "smp_monthly"("plantId", "billingYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "smp_monthly_mailFolder_mailUid_key" ON "smp_monthly"("mailFolder", "mailUid");

-- CreateIndex
CREATE UNIQUE INDEX "rec_monthly_plantId_billingYearMonth_key" ON "rec_monthly"("plantId", "billingYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "smp_monthly_confirmation_clientGroupId_billingYearMonth_key" ON "smp_monthly_confirmation"("clientGroupId", "billingYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "solar_irradiance_monthly_region_billingYearMonth_key" ON "solar_irradiance_monthly"("region", "billingYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_batch_billingYearMonth_clientGroupId_batchNo_key" ON "invoice_batch"("billingYearMonth", "clientGroupId", "batchNo");

-- AddForeignKey
ALTER TABLE "plant_master" ADD CONSTRAINT "plant_master_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smp_monthly" ADD CONSTRAINT "smp_monthly_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plant_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smp_monthly" ADD CONSTRAINT "smp_monthly_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "invoice_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_monthly" ADD CONSTRAINT "rec_monthly_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plant_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smp_monthly_confirmation" ADD CONSTRAINT "smp_monthly_confirmation_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_batch" ADD CONSTRAINT "invoice_batch_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
