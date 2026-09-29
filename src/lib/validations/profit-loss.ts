import { z } from "zod"

export const PROFIT_LOSS_MANUAL_SECTIONS = [
  "REVENUE",
  "CONSTRUCTION_COST",
  "MANUFACTURING_COST",
  "MERCHANDISE_COST",
  "SGA",
  "NON_OPERATING_INCOME",
  "NON_OPERATING_EXPENSE",
] as const

export const profitLossManualEntrySchema = z.object({
  billingYearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "귀속월을 선택해 주세요."),
  section: z.enum(PROFIT_LOSS_MANUAL_SECTIONS, { error: "구분을 선택해 주세요." }),
  accountCode: z.string().trim().min(1, "계정과목을 입력해 주세요.").max(50, "계정과목은 50자 이내로 입력해 주세요."),
  // 재고 조정 등 음수 금액도 허용한다. 0은 의미가 없어 막는다.
  amount: z.coerce
    .number({ error: "금액을 숫자로 입력해 주세요." })
    .refine((n) => Number.isFinite(n) && n !== 0, "0이 아닌 금액을 입력해 주세요."),
  memo: z.string().trim().max(200, "메모는 200자 이내로 입력해 주세요.").default(""),
})

export type ProfitLossManualEntryInput = z.input<typeof profitLossManualEntrySchema>
