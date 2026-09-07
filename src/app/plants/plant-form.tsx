"use client"

import { useActionState, useState } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { QuickAddClientGroupDialog } from "./client-groups/quick-add-client-group-dialog"
import type { PlantActionState } from "./actions"
import { getSmpContractType, SMP_CONTRACT_TYPE_LABEL } from "@/lib/smp-contract-type"
import { IRRADIANCE_REGIONS } from "@/lib/irradiance-regions"

export type PlantFormDefaults = {
  plantName: string
  plantAlias: string
  contractNumber: string
  subBizNumber: string
  kepcoContactEmail: string
  address: string
  capacityKw: number | null
  constructionOrder: number
  clientGroupId: number | null
  irradianceRegion: string
}

export type ClientGroupOption = {
  id: number
  name: string
}

function toMessages(messages?: string[]) {
  return messages?.map((message) => ({ message }))
}

export function PlantForm({
  action,
  defaultValues,
  clientGroups,
  submitLabel,
}: {
  action: (
    state: PlantActionState,
    formData: FormData,
  ) => Promise<PlantActionState>
  defaultValues: PlantFormDefaults
  clientGroups: ClientGroupOption[]
  submitLabel: string
}) {
  const [state, formAction, isPending] = useActionState(action, {})
  const fieldErrors = state.fieldErrors ?? {}

  const [clientGroupOptions, setClientGroupOptions] = useState(clientGroups)
  const [selectedClientGroupId, setSelectedClientGroupId] = useState(
    defaultValues.clientGroupId ? String(defaultValues.clientGroupId) : "",
  )
  const [contractNumber, setContractNumber] = useState(
    defaultValues.contractNumber,
  )
  const smpContractType = getSmpContractType(contractNumber)
  const [irradianceRegion, setIrradianceRegion] = useState(
    defaultValues.irradianceRegion,
  )

  return (
    <form action={formAction} className="max-w-3xl">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>발전소 기본 정보</FieldLegend>
          <FieldDescription>
            한전 종사업장번호는 세금계산서 발행에 필수입니다. 계약번호는
            한국전력공사와 SMP계약이 된 발전소에만 있습니다.
          </FieldDescription>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!fieldErrors.plantName}>
              <FieldLabel htmlFor="plantName">발전소명 *</FieldLabel>
              <Input
                id="plantName"
                name="plantName"
                required
                defaultValue={defaultValues.plantName}
                aria-invalid={!!fieldErrors.plantName}
              />
              <FieldError errors={toMessages(fieldErrors.plantName)} />
            </Field>

            <Field data-invalid={!!fieldErrors.plantAlias}>
              <FieldLabel htmlFor="plantAlias">발전소 별칭 (비고용)</FieldLabel>
              <Input
                id="plantAlias"
                name="plantAlias"
                defaultValue={defaultValues.plantAlias}
              />
              <FieldError errors={toMessages(fieldErrors.plantAlias)} />
            </Field>

            <Field data-invalid={!!fieldErrors.contractNumber}>
              <FieldLabel htmlFor="contractNumber">계약번호</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="contractNumber"
                  name="contractNumber"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  aria-invalid={!!fieldErrors.contractNumber}
                />
                <Badge variant={smpContractType === "KEPCO" ? "secondary" : "outline"}>
                  {SMP_CONTRACT_TYPE_LABEL[smpContractType]}
                </Badge>
              </div>
              <FieldDescription>
                계약번호가 있으면 한국전력공사, 비워두면 한국전력거래소와
                SMP계약이 된 발전소로 인식합니다. 전력거래소 발전소는 발전량
                등을 수기로 입력하게 됩니다.
              </FieldDescription>
              <FieldError errors={toMessages(fieldErrors.contractNumber)} />
            </Field>

            <Field data-invalid={!!fieldErrors.subBizNumber}>
              <FieldLabel htmlFor="subBizNumber">
                종사업장번호{smpContractType === "KEPCO" ? " *" : ""}
              </FieldLabel>
              <Input
                id="subBizNumber"
                name="subBizNumber"
                required={smpContractType === "KEPCO"}
                defaultValue={defaultValues.subBizNumber}
                aria-invalid={!!fieldErrors.subBizNumber}
              />
              {smpContractType === "KPX" && (
                <FieldDescription>
                  한국전력거래소 발전소는 한전 종사업장번호가 없으므로 비워둘
                  수 있습니다.
                </FieldDescription>
              )}
              <FieldError errors={toMessages(fieldErrors.subBizNumber)} />
            </Field>

            <Field data-invalid={!!fieldErrors.kepcoContactEmail}>
              <FieldLabel htmlFor="kepcoContactEmail">
                한전 담당 이메일
              </FieldLabel>
              <Input
                id="kepcoContactEmail"
                name="kepcoContactEmail"
                type="email"
                placeholder="ppa0XXX@kepco.co.kr"
                defaultValue={defaultValues.kepcoContactEmail}
                aria-invalid={!!fieldErrors.kepcoContactEmail}
              />
              <FieldError errors={toMessages(fieldErrors.kepcoContactEmail)} />
            </Field>

            <Field data-invalid={!!fieldErrors.address}>
              <FieldLabel htmlFor="address">주소</FieldLabel>
              <Input
                id="address"
                name="address"
                defaultValue={defaultValues.address}
              />
              <FieldError errors={toMessages(fieldErrors.address)} />
            </Field>

            <Field data-invalid={!!fieldErrors.capacityKw}>
              <FieldLabel htmlFor="capacityKw">용량 (kW)</FieldLabel>
              <Input
                id="capacityKw"
                name="capacityKw"
                type="number"
                step="0.01"
                defaultValue={defaultValues.capacityKw ?? ""}
                aria-invalid={!!fieldErrors.capacityKw}
              />
              <FieldError errors={toMessages(fieldErrors.capacityKw)} />
            </Field>

            <Field data-invalid={!!fieldErrors.irradianceRegion}>
              <FieldLabel htmlFor="irradianceRegion">수평면 일사량 지역</FieldLabel>
              <Select
                name="irradianceRegion"
                value={irradianceRegion}
                onValueChange={(value) => setIrradianceRegion(String(value))}
              >
                <SelectTrigger
                  id="irradianceRegion"
                  className="w-full"
                  aria-invalid={!!fieldErrors.irradianceRegion}
                >
                  <SelectValue placeholder="지역 선택 안함">
                    {(value: string) => value || "지역 선택 안함"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">선택 안함</SelectItem>
                  {IRRADIANCE_REGIONS.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                보고서의 수평면 일사량을 이 지역 기준으로 매칭합니다.
              </FieldDescription>
              <FieldError errors={toMessages(fieldErrors.irradianceRegion)} />
            </Field>

            <Field data-invalid={!!fieldErrors.constructionOrder}>
              <FieldLabel htmlFor="constructionOrder">
                건설순서 (배치 분할 기준) *
              </FieldLabel>
              <Input
                id="constructionOrder"
                name="constructionOrder"
                type="number"
                required
                defaultValue={defaultValues.constructionOrder}
                aria-invalid={!!fieldErrors.constructionOrder}
              />
              <FieldError errors={toMessages(fieldErrors.constructionOrder)} />
            </Field>

            <Field data-invalid={!!fieldErrors.clientGroupId}>
              <FieldLabel htmlFor="clientGroupId">거래처 *</FieldLabel>
              {clientGroupOptions.length === 0 ? (
                <FieldDescription>
                  등록된 거래처가 없습니다. 아래 &quot;거래처 바로 등록&quot;
                  버튼으로 거래처를 먼저 추가해 주세요.
                </FieldDescription>
              ) : (
                <Select
                  name="clientGroupId"
                  required
                  value={selectedClientGroupId}
                  onValueChange={(value) =>
                    setSelectedClientGroupId(String(value))
                  }
                >
                  <SelectTrigger
                    id="clientGroupId"
                    className="w-full"
                    aria-invalid={!!fieldErrors.clientGroupId}
                  >
                    <SelectValue placeholder="거래처 선택">
                      {(value: string) =>
                        value
                          ? clientGroupOptions.find(
                              (clientGroup) => String(clientGroup.id) === value,
                            )?.name
                          : "거래처 선택"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clientGroupOptions.map((clientGroup) => (
                      <SelectItem
                        key={clientGroup.id}
                        value={String(clientGroup.id)}
                      >
                        {clientGroup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FieldError errors={toMessages(fieldErrors.clientGroupId)} />
            </Field>
          </div>
        </FieldSet>

        {state.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <QuickAddClientGroupDialog
            onCreated={(clientGroup) => {
              setClientGroupOptions((prev) =>
                [...prev, clientGroup].sort((a, b) =>
                  a.name.localeCompare(b.name, "ko"),
                ),
              )
              setSelectedClientGroupId(String(clientGroup.id))
            }}
          />
          <Button type="submit" disabled={isPending || clientGroupOptions.length === 0}>
            {isPending ? "저장 중..." : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
