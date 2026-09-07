-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_smp_monthly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plantId" INTEGER,
    "extractedPlantName" TEXT,
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
    "mailFolder" TEXT,
    "mailUid" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "smp_monthly_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plant_master" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "smp_monthly_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "invoice_batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_smp_monthly" ("baseUnitPrice", "batchId", "billingYearMonth", "createdAt", "currReading", "generationKwh", "id", "lossUnitPrice", "meterMultiplier", "parseStatus", "plantId", "prevReading", "receivedDate", "smpUnitPrice", "sourcePdfPath", "supplyAmount", "taxInvoiceStatus", "updatedAt", "vatAmount") SELECT "baseUnitPrice", "batchId", "billingYearMonth", "createdAt", "currReading", "generationKwh", "id", "lossUnitPrice", "meterMultiplier", "parseStatus", "plantId", "prevReading", "receivedDate", "smpUnitPrice", "sourcePdfPath", "supplyAmount", "taxInvoiceStatus", "updatedAt", "vatAmount" FROM "smp_monthly";
DROP TABLE "smp_monthly";
ALTER TABLE "new_smp_monthly" RENAME TO "smp_monthly";
CREATE UNIQUE INDEX "smp_monthly_plantId_billingYearMonth_key" ON "smp_monthly"("plantId", "billingYearMonth");
CREATE UNIQUE INDEX "smp_monthly_mailFolder_mailUid_key" ON "smp_monthly"("mailFolder", "mailUid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
