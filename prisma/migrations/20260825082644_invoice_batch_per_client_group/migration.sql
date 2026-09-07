/*
  Warnings:

  - Added the required column `clientGroupId` to the `invoice_batch` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_invoice_batch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "billingYearMonth" TEXT NOT NULL,
    "clientGroupId" INTEGER NOT NULL,
    "batchNo" INTEGER NOT NULL,
    "generatedFilePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_batch_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_invoice_batch" ("batchNo", "billingYearMonth", "createdAt", "generatedFilePath", "id") SELECT "batchNo", "billingYearMonth", "createdAt", "generatedFilePath", "id" FROM "invoice_batch";
DROP TABLE "invoice_batch";
ALTER TABLE "new_invoice_batch" RENAME TO "invoice_batch";
CREATE UNIQUE INDEX "invoice_batch_billingYearMonth_clientGroupId_batchNo_key" ON "invoice_batch"("billingYearMonth", "clientGroupId", "batchNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
