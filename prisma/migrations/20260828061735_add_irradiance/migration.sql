-- AlterTable
ALTER TABLE "plant_master" ADD COLUMN "irradianceRegion" TEXT;

-- CreateTable
CREATE TABLE "solar_irradiance_monthly" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "region" TEXT NOT NULL,
    "billingYearMonth" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "solar_irradiance_monthly_region_billingYearMonth_key" ON "solar_irradiance_monthly"("region", "billingYearMonth");
