import { z } from "zod"

// 세금계산서의 "공급자" 정보 — 거래처(발전소 소유 회사) 단위로 한 번만 존재.
export const clientGroupFormSchema = z.object({
  name: z.string().trim().min(1, "거래처명을 입력해 주세요."),
  legalName: z.string().trim().optional().or(z.literal("")),
  bizNumber: z.string().trim().min(1, "사업자등록번호를 입력해 주세요."),
  ceoName: z.string().trim().min(1, "대표자명(성명)을 입력해 주세요."),
  address: z.string().trim().optional().or(z.literal("")),
  bizType: z.string().trim().optional().or(z.literal("")),
  bizItem: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("올바른 이메일 형식이 아닙니다.")
    .optional()
    .or(z.literal("")),
  mailFolders: z.string().trim().optional().or(z.literal("")),
  invoiceTemplatePath: z.string().trim().optional().or(z.literal("")),
})

export type ClientGroupFormValues = z.infer<typeof clientGroupFormSchema>
