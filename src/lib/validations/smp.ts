import { z } from "zod"

export const smpReportCellSchema = z.object({
  value: z.coerce
    .number({ error: "숫자를 입력해 주세요." })
    .min(0, "0 이상의 값을 입력해 주세요."),
})
