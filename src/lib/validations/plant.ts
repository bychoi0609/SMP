import { z } from "zod"

import { IRRADIANCE_REGIONS } from "@/lib/irradiance-regions"

// PRD §7 비기능요구사항: 세금계산서 필수 입력값(사업자번호, 종사업장번호 등)
// 누락 시 저장 차단 — 여기서 required로 지정한 필드가 그 기준선.
// 참고: "공급자" 정보는 발전소 단위가 아니라 거래처(ClientGroup) 단위로 관리된다.
const plantFormBaseSchema = z.object({
  plantName: z.string().trim().min(1, "발전소명을 입력해 주세요."),
  plantAlias: z.string().trim().optional().or(z.literal("")),
  // 계약번호는 비워둘 수 있다 — 비어 있으면 한국전력거래소(KPX)와 SMP계약이 된
  // 발전소로 인식한다. see getSmpContractType.
  contractNumber: z.string().trim().optional().or(z.literal("")),
  // 종사업장번호는 한전 종사업장 개념이라 한국전력거래소(KPX) 발전소는 없을 수
  // 있다 — 계약번호가 있는(한전) 발전소일 때만 필수로 검증한다.
  subBizNumber: z.string().trim().optional().or(z.literal("")),
  kepcoContactEmail: z
    .string()
    .trim()
    .email("올바른 이메일 형식이 아닙니다.")
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  capacityKw: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.coerce
      .number({ error: "숫자를 입력해 주세요." })
      .positive("0보다 큰 값을 입력해 주세요.")
      .optional(),
  ),
  constructionOrder: z.coerce
    .number({ error: "숫자를 입력해 주세요." })
    .int("정수를 입력해 주세요.")
    .positive("1 이상의 값을 입력해 주세요."),
  // 수평면 일사량 매칭 지역 — 비워두면 보고서에서 일사량을 채우지 않는다.
  irradianceRegion: z
    .union([z.enum(IRRADIANCE_REGIONS), z.literal("")])
    .optional(),
  clientGroupId: z.coerce
    .number({ error: "거래처를 선택해 주세요." })
    .int()
    .positive("거래처를 선택해 주세요."),
})

export const plantFormSchema = plantFormBaseSchema.superRefine((data, ctx) => {
  if (data.contractNumber && !data.subBizNumber) {
    ctx.addIssue({
      code: "custom",
      path: ["subBizNumber"],
      message: "종사업장번호를 입력해 주세요.",
    })
  }
})

export type PlantFormValues = z.infer<typeof plantFormBaseSchema>
