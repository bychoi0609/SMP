"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClientGroupQuick } from "./actions"

function toMessages(messages?: string[]) {
  return messages?.map((message) => ({ message }))
}

export function QuickAddClientGroupDialog({
  onCreated,
}: {
  onCreated: (clientGroup: { id: number; name: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    createClientGroupQuick,
    {},
  )
  const fieldErrors = state.fieldErrors ?? {}
  const lastHandledClientGroupId = useRef<number | null>(null)

  useEffect(() => {
    if (
      state.clientGroup &&
      state.clientGroup.id !== lastHandledClientGroupId.current
    ) {
      lastHandledClientGroupId.current = state.clientGroup.id
      onCreated(state.clientGroup)
      setOpen(false)
    }
  }, [state.clientGroup, onCreated])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus /> 거래처 바로 등록
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>거래처 빠른 등록</DialogTitle>
          <DialogDescription>
            세금계산서 &quot;공급자&quot; 정보로 사용됩니다. 등록 후 이
            발전소에 바로 연결됩니다.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field data-invalid={!!fieldErrors.name}>
                <FieldLabel htmlFor="quickClientGroupName">
                  거래처명 *
                </FieldLabel>
                <Input
                  id="quickClientGroupName"
                  name="name"
                  required
                  placeholder="예: 키스트론"
                  aria-invalid={!!fieldErrors.name}
                />
                <FieldError errors={toMessages(fieldErrors.name)} />
              </Field>

              <Field data-invalid={!!fieldErrors.legalName}>
                <FieldLabel htmlFor="quickClientGroupLegalName">
                  세금계산서용 정식 상호
                </FieldLabel>
                <Input
                  id="quickClientGroupLegalName"
                  name="legalName"
                  placeholder="비워두면 거래처명 사용"
                />
                <FieldError errors={toMessages(fieldErrors.legalName)} />
              </Field>

              <Field data-invalid={!!fieldErrors.bizNumber}>
                <FieldLabel htmlFor="quickClientGroupBizNumber">
                  사업자등록번호 *
                </FieldLabel>
                <Input
                  id="quickClientGroupBizNumber"
                  name="bizNumber"
                  required
                  aria-invalid={!!fieldErrors.bizNumber}
                />
                <FieldError errors={toMessages(fieldErrors.bizNumber)} />
              </Field>

              <Field data-invalid={!!fieldErrors.ceoName}>
                <FieldLabel htmlFor="quickClientGroupCeoName">
                  성명(대표자) *
                </FieldLabel>
                <Input
                  id="quickClientGroupCeoName"
                  name="ceoName"
                  required
                  aria-invalid={!!fieldErrors.ceoName}
                />
                <FieldError errors={toMessages(fieldErrors.ceoName)} />
              </Field>

              <Field data-invalid={!!fieldErrors.address}>
                <FieldLabel htmlFor="quickClientGroupAddress">
                  사업장주소
                </FieldLabel>
                <Input id="quickClientGroupAddress" name="address" />
                <FieldError errors={toMessages(fieldErrors.address)} />
              </Field>

              <Field data-invalid={!!fieldErrors.email}>
                <FieldLabel htmlFor="quickClientGroupEmail">
                  이메일
                </FieldLabel>
                <Input
                  id="quickClientGroupEmail"
                  name="email"
                  type="email"
                  aria-invalid={!!fieldErrors.email}
                />
                <FieldError errors={toMessages(fieldErrors.email)} />
              </Field>
            </div>

            {state.error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "등록 중..." : "등록"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
