-- CreateTable
CREATE TABLE "plant_master" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plantName" TEXT NOT NULL,
    "plantAlias" TEXT,
    "contractNumber" TEXT NOT NULL,
    "subBizNumber" TEXT NOT NULL,
    "kepcoContactEmail" TEXT,
    "address" TEXT,
    "capacityKw" DECIMAL,
    "constructionOrder" INTEGER NOT NULL,
    "clientGroup" TEXT,
    "ownerBizNumber" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerAddress" TEXT,
    "ownerBizType" TEXT,
    "ownerBizItem" TEXT,
    "ownerEmail1" TEXT,
    "ownerEmail2" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "smp_monthly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plantId" INTEGER NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "receivedDate" DATETIME,
    "prevReading" DECIMAL,
    "currReading" DECIMAL,
    "meterMultiplier" DECIMAL,
    "generationKwh" DECIMAL,
    "baseUnitPrice" DECIMAL,
    "smpUnitPrice" DECIMAL,
    "lossUnitPrice" DECIMAL,
    "supplyAmount" DECIMAL,
    "vatAmount" DECIMAL,
    "parseStatus" TEXT NOT NULL DEFAULT 'OK',
    "taxInvoiceStatus" TEXT NOT NULL DEFAULT 'NOT_ISSUED',
    "batchId" INTEGER,
    "sourcePdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "smp_monthly_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plant_master" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "smp_monthly_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "invoice_batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rec_monthly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plantId" INTEGER NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TENTATIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rec_monthly_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plant_master" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rec_monthly_default" (
    "billingYearMonth" TEXT NOT NULL PRIMARY KEY,
    "baseUnitPrice" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "invoice_batch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billingYearMonth" TEXT NOT NULL,
    "batchNo" INTEGER NOT NULL,
    "generatedFilePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "plant_master_contractNumber_key" ON "plant_master"("contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "smp_monthly_plantId_billingYearMonth_key" ON "smp_monthly"("plantId", "billingYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "rec_monthly_plantId_billingYearMonth_key" ON "rec_monthly"("plantId", "billingYearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_batch_billingYearMonth_batchNo_key" ON "invoice_batch"("billingYearMonth", "batchNo");
