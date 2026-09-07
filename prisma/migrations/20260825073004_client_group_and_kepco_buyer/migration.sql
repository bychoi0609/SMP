/*
  Warnings:

  - You are about to drop the column `clientGroup` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerAddress` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerBizItem` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerBizNumber` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerBizType` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerEmail1` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerEmail2` on the `plant_master` table. All the data in the column will be lost.
  - You are about to drop the column `ownerName` on the `plant_master` table. All the data in the column will be lost.
  - Added the required column `clientGroupId` to the `plant_master` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "client_group" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "bizNumber" TEXT NOT NULL,
    "ceoName" TEXT NOT NULL,
    "address" TEXT,
    "bizType" TEXT,
    "bizItem" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "kepco_buyer_info" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "bizNumber" TEXT NOT NULL DEFAULT '1208200052',
    "name" TEXT NOT NULL DEFAULT '한국전력공사',
    "ceoName" TEXT NOT NULL DEFAULT '김동철',
    "address" TEXT DEFAULT '전라남도 나주시 전력로 55(빛가람동)',
    "bizType" TEXT DEFAULT '전기가스',
    "bizItem" TEXT DEFAULT '전기발전공급',
    "email1" TEXT DEFAULT 'kepcoppa@kepco.co.kr',
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_plant_master" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plantName" TEXT NOT NULL,
    "plantAlias" TEXT,
    "contractNumber" TEXT NOT NULL,
    "subBizNumber" TEXT NOT NULL,
    "kepcoContactEmail" TEXT,
    "address" TEXT,
    "capacityKw" DECIMAL,
    "constructionOrder" INTEGER NOT NULL,
    "clientGroupId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "plant_master_clientGroupId_fkey" FOREIGN KEY ("clientGroupId") REFERENCES "client_group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_plant_master" ("address", "capacityKw", "constructionOrder", "contractNumber", "createdAt", "id", "kepcoContactEmail", "plantAlias", "plantName", "subBizNumber", "updatedAt") SELECT "address", "capacityKw", "constructionOrder", "contractNumber", "createdAt", "id", "kepcoContactEmail", "plantAlias", "plantName", "subBizNumber", "updatedAt" FROM "plant_master";
DROP TABLE "plant_master";
ALTER TABLE "new_plant_master" RENAME TO "plant_master";
CREATE UNIQUE INDEX "plant_master_contractNumber_key" ON "plant_master"("contractNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "client_group_name_key" ON "client_group"("name");
