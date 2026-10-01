-- CreateEnum
CREATE TYPE "report_label_kind" AS ENUM ('PLANT_SHEET', 'INTEGRATED_BLOCK', 'SALES_ROW');

-- CreateTable
CREATE TABLE "report_label_mapping" (
    "id" SERIAL NOT NULL,
    "kind" "report_label_kind" NOT NULL,
    "label" TEXT NOT NULL,
    "plantId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_label_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_label_mapping_kind_label_key" ON "report_label_mapping"("kind", "label");

-- AddForeignKey
ALTER TABLE "report_label_mapping" ADD CONSTRAINT "report_label_mapping_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "plant_master"("id") ON DELETE CASCADE ON UPDATE CASCADE;

