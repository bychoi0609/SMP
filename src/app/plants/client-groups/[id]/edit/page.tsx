import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { ClientGroupForm } from "../../client-group-form"
import { updateClientGroup } from "../../actions"

export default async function EditClientGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const clientGroupId = Number(id)

  if (!Number.isInteger(clientGroupId)) {
    notFound()
  }

  const clientGroup = await prisma.clientGroup.findUnique({
    where: { id: clientGroupId },
  })

  if (!clientGroup) {
    notFound()
  }

  const boundUpdateClientGroup = updateClientGroup.bind(null, clientGroup.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{clientGroup.name} 정보 수정</h1>
        <p className="text-sm text-muted-foreground">
          세금계산서 공급자 정보를 수정합니다.
        </p>
      </div>
      <ClientGroupForm
        action={boundUpdateClientGroup}
        defaultValues={{
          name: clientGroup.name,
          legalName: clientGroup.legalName ?? "",
          bizNumber: clientGroup.bizNumber,
          ceoName: clientGroup.ceoName,
          address: clientGroup.address ?? "",
          bizType: clientGroup.bizType ?? "",
          bizItem: clientGroup.bizItem ?? "",
          email: clientGroup.email ?? "",
          mailFolders: clientGroup.mailFolders ?? "",
          invoiceTemplatePath: clientGroup.invoiceTemplatePath ?? "",
        }}
        submitLabel="저장"
      />
    </div>
  )
}
