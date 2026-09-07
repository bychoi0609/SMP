-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_plant_master" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plantName" TEXT NOT NULL,
    "plantAlias" TEXT,
    "contractNumber" TEXT,
    "subBizNumber" TEXT,
    "kepcoContactEmail" TEXT,
    "address" TEXT,
    "capacityKw" DECIMAL,
    "constructionOrder" INTEGER NOT NULL,
    "clientGroupId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "plant_master_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_plant_master" ("address", "capacityKw", "clientGroupId", "constructionOrder", "contractNumber", "createdAt", "id", "kepcoContactEmail", "plantAlias", "plantName", "subBizNumber", "updatedAt") SELECT "address", "capacityKw", "clientGroupId", "constructionOrder", "contractNumber", "createdAt", "id", "kepcoContactEmail", "plantAlias", "plantName", "subBizNumber", "updatedAt" FROM "plant_master";
DROP TABLE "plant_master";
ALTER TABLE "new_plant_master" RENAME TO "plant_master";
CREATE UNIQUE INDEX "plant_master_contractNumber_key" ON "plant_master"("contractNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
