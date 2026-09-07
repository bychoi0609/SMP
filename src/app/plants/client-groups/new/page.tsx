import {
  ClientGroupForm,
  type ClientGroupFormDefaults,
} from "../client-group-form"
import { createClientGroup } from "../actions"

const EMPTY_CLIENT_GROUP: ClientGroupFormDefaults = {
  name: "",
  legalName: "",
  bizNumber: "",
  ceoName: "",
  address: "",
  bizType: "",
  bizItem: "",
  email: "",
  mailFolders: "",
  invoiceTemplatePath: "",
}

export default function NewClientGroupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">거래처 추가</h1>
        <p className="text-sm text-muted-foreground">
          세금계산서 공급자 정보를 등록합니다.
        </p>
      </div>
      <ClientGroupForm
        action={createClientGroup}
        defaultValues={EMPTY_CLIENT_GROUP}
        submitLabel="등록"
      />
    </div>
  )
}
