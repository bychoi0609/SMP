import { z } from "zod"

export const recRowFormSchema = z.object({
  quantity: z.coerce
    .number({ error: "숫자를 입력해 주세요." })
    .min(0, "0 이상의 값을 입력해 주세요."),
  unitPrice: z.coerce
    .number({ error: "숫자를 입력해 주세요." })
    .min(0, "0 이상의 값을 입력해 주세요."),
})

export const representativePriceFormSchema = z.object({
  baseUnitPrice: z.coerce
    .number({ error: "숫자를 입력해 주세요." })
    .positive("0보다 큰 값을 입력해 주세요."),
})
