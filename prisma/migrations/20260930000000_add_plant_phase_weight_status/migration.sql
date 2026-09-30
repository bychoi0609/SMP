-- CreateEnum
CREATE TYPE "plant_operating_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- AlterTable
ALTER TABLE "plant_master" ADD COLUMN     "contractPhase" INTEGER,
ADD COLUMN     "operatingStatus" "plant_operating_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "recWeight" DECIMAL(65,30) NOT NULL DEFAULT 1.5;

-- AlterTable
ALTER TABLE "smp_monthly" ADD COLUMN     "capacityKw" DECIMAL(65,30);

-- 기존 코드에 이름으로 하드코딩돼 있던 REC 가중치 예외(1.2)를 발전소 값으로 옮긴다.
UPDATE "plant_master" SET "recWeight" = 1.2
WHERE "plantName" = '서울청과연구소' OR "plantAlias" = '서울청과연구소';

-- 기존 SMP 월 데이터의 설비용량 스냅샷을 현재 발전소 용량으로 채운다.
UPDATE "smp_monthly" s SET "capacityKw" = p."capacityKw"
FROM "plant_master" p
WHERE s."plantId" = p."id";
