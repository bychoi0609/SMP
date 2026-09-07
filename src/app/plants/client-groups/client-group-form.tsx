"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ClientGroupActionState } from "./actions"

export type ClientGroupFormDefaults = {
  name: string
  legalName: string
  bizNumber: string
  ceoName: string
  address: string
  bizType: string
  bizItem: string
  email: string
  mailFolders: string
  invoiceTemplatePath: string
}

function toMessages(messages?: string[]) {
  return messages?.map((message) => ({ message }))
}

export function ClientGroupForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (
    state: ClientGroupActionState,
    formData: FormData,
  ) => Promise<ClientGroupActionState>
  defaultValues: ClientGroupFormDefaults
  submitLabel: string
}) {
  const [state, formAction, isPending] = useActionState(action, {})
  const fieldErrors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="max-w-2xl">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>거래처(공급자) 정보</FieldLegend>
          <FieldDescription>
            세금계산서의 &quot;공급자&quot; 란에 그대로 들어가는 정보입니다.
            같은 거래처에 속한 모든 발전소가 이 정보를 공유합니다.
          </FieldDescription>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!fieldErrors.name}>
              <FieldLabel htmlFor="name">거래처명 *</FieldLabel>
              <Input
                id="name"
                name="name"
                required
                placeholder="예: 키스트론"
                defaultValue={defaultValues.name}
                aria-invalid={!!fieldErrors.name}
              />
              <FieldError errors={toMessages(fieldErrors.name)} />
            </Field>

            <Field data-invalid={!!fieldErrors.legalName}>
              <FieldLabel htmlFor="legalName">
                세금계산서용 정식 상호
              </FieldLabel>
              <Input
                id="legalName"
                name="legalName"
                placeholder="예: 키스트론 주식회사 (비워두면 거래처명 사용)"
                defaultValue={defaultValues.legalName}
              />
              <FieldError errors={toMessages(fieldErrors.legalName)} />
            </Field>

            <Field data-invalid={!!fieldErrors.bizNumber}>
              <FieldLabel htmlFor="bizNumber">사업자등록번호 *</FieldLabel>
              <Input
                id="bizNumber"
                name="bizNumber"
                required
                defaultValue={defaultValues.bizNumber}
                aria-invalid={!!fieldErrors.bizNumber}
              />
              <FieldError errors={toMessages(fieldErrors.bizNumber)} />
            </Field>

            <Field data-invalid={!!fieldErrors.ceoName}>
              <FieldLabel htmlFor="ceoName">성명(대표자) *</FieldLabel>
              <Input
                id="ceoName"
                name="ceoName"
                required
                defaultValue={defaultValues.ceoName}
                aria-invalid={!!fieldErrors.ceoName}
              />
              <FieldError errors={toMessages(fieldErrors.ceoName)} />
            </Field>

            <Field data-invalid={!!fieldErrors.address}>
              <FieldLabel htmlFor="address">사업장주소</FieldLabel>
              <Input
                id="address"
                name="address"
                defaultValue={defaultValues.address}
              />
              <FieldError errors={toMessages(fieldErrors.address)} />
            </Field>

            <Field data-invalid={!!fieldErrors.bizType}>
              <FieldLabel htmlFor="bizType">업태</FieldLabel>
              <Input
                id="bizType"
                name="bizType"
                defaultValue={defaultValues.bizType}
              />
              <FieldError errors={toMessages(fieldErrors.bizType)} />
            </Field>

            <Field data-invalid={!!fieldErrors.bizItem}>
              <FieldLabel htmlFor="bizItem">종목</FieldLabel>
              <Input
                id="bizItem"
                name="bizItem"
                defaultValue={defaultValues.bizItem}
              />
              <FieldError errors={toMessages(fieldErrors.bizItem)} />
            </Field>

            <Field data-invalid={!!fieldErrors.email}>
              <FieldLabel htmlFor="email">이메일</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={defaultValues.email}
                aria-invalid={!!fieldErrors.email}
              />
              <FieldError errors={toMessages(fieldErrors.email)} />
            </Field>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>메일 수집 설정</FieldLegend>
          <FieldDescription>
            이 거래처 소속 발전소들의 한전 신재생에너지 요금안내 메일이
            도착하는 다음 메일함 폴더명을 쉼표(,)로 구분해 입력해 주세요.
            비워두면 전체 메일함에서 검색합니다.
          </FieldDescription>
          <Field data-invalid={!!fieldErrors.mailFolders}>
            <FieldLabel htmlFor="mailFolders">메일함 폴더</FieldLabel>
            <Textarea
              id="mailFolders"
              name="mailFolders"
              rows={2}
              placeholder="예: 키스트론, 키스트론/발전소2"
              defaultValue={defaultValues.mailFolders}
              aria-invalid={!!fieldErrors.mailFolders}
            />
            <FieldError errors={toMessages(fieldErrors.mailFolders)} />
          </Field>
        </FieldSet>

        <FieldSet>
          <FieldLegend>세금계산서 양식</FieldLegend>
          <FieldDescription>
            이 거래처의 한전 세금계산서 일괄등록 양식(.xls) 원본 파일 경로입니다.
            발전소별 행이 이미 채워진 실제 양식 파일이어야 하며, 세금계산서
            생성 시 이 파일의 T·U·AB·AC열(공급가액·세액)과 B열(작성일자),
            X열(품목1)만 채워 넣습니다. 비워두면 이 거래처는 세금계산서
            자동 생성 대상에서 제외됩니다.
          </FieldDescription>
          <Field data-invalid={!!fieldErrors.invoiceTemplatePath}>
            <FieldLabel htmlFor="invoiceTemplatePath">
              양식 파일 경로
            </FieldLabel>
            <Input
              id="invoiceTemplatePath"
              name="invoiceTemplatePath"
              placeholder="예: templates/invoices/키스트론_SMP_세금계산서등록양식(일반).xls"
              defaultValue={defaultValues.invoiceTemplatePath}
              aria-invalid={!!fieldErrors.invoiceTemplatePath}
            />
            <FieldError errors={toMessages(fieldErrors.invoiceTemplatePath)} />
          </Field>
        </FieldSet>

        {state.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
