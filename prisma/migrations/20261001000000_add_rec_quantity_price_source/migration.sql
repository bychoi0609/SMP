-- AlterTable
ALTER TABLE "rec_monthly" ADD COLUMN     "quantityIsActual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitPriceIsManual" BOOLEAN NOT NULL DEFAULT false;

-- 기존 데이터: 지금까지 CONFIRMED는 "수량을 직접 입력했다"는 뜻도 겸했으므로
-- 화면에 보이는 수량이 바뀌지 않게 실제 발급량으로 표시한다.
UPDATE "rec_monthly" SET "quantityIsActual" = true WHERE "status" = 'CONFIRMED';

-- 해당 월 대표단가가 없거나 대표단가와 다른 단가는 개별 단가로 본다
-- (대표단가 적용 시 덮어쓰이지 않도록).
UPDATE "rec_monthly" r SET "unitPriceIsManual" = true
WHERE r."unitPrice" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "rec_monthly_default" d
    WHERE d."billingYearMonth" = r."billingYearMonth"
      AND d."baseUnitPrice" = r."unitPrice"
  );
