import Link from "next/link"
import { ArrowLeft, Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { prisma } from "@/lib/prisma"
import { deleteClientGroup } from "./actions"
import { DeleteClientGroupButton } from "./delete-client-group-button"
import { ExcelUploadDialog } from "./excel-upload-dialog"

export default async function ClientGroupsPage() {
  const clientGroups = await prisma.clientGroup.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { plants: true } } },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1">
            <Button variant="ghost" size="sm" render={<Link href="/plants" />}>
              <ArrowLeft /> 발전소 목록으로
            </Button>
          </div>
          <h1 className="text-xl font-semibold">거래처(공급자) 관리</h1>
          <p className="text-sm text-muted-foreground">
            세금계산서 &quot;공급자&quot; 정보는 발전소가 아니라 거래처 단위로
            관리됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <ExcelUploadDialog />
          <Button render={<Link href="/plants/client-groups/new" />}>
            <Plus /> 거래처 추가
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>거래처명</TableHead>
              <TableHead className="w-40">사업자등록번호</TableHead>
              <TableHead className="w-32">대표자</TableHead>
              <TableHead className="w-28 text-center">소속 발전소</TableHead>
              <TableHead>메일함 폴더</TableHead>
              <TableHead className="w-24 text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientGroups.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 whitespace-normal text-center text-muted-foreground"
                >
                  등록된 거래처가 없습니다. 발전소를 등록하기 전에 거래처를
                  먼저 추가해 주세요.
                </TableCell>
              </TableRow>
            )}
            {clientGroups.map((clientGroup) => (
              <TableRow key={clientGroup.id}>
                <TableCell className="font-medium">
                  {clientGroup.name}
                </TableCell>
                <TableCell className="tabular-nums">
                  {clientGroup.bizNumber}
                </TableCell>
                <TableCell>{clientGroup.ceoName}</TableCell>
                <TableCell className="tabular-nums">
                  {clientGroup._count.plants}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {clientGroup.mailFolders || "전체 메일함"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={
                        <Link
                          href={`/plants/client-groups/${clientGroup.id}/edit`}
                          aria-label={`${clientGroup.name} 수정`}
                        />
                      }
                    >
                      <Pencil />
                    </Button>
                    <DeleteClientGroupButton
                      clientGroupId={clientGroup.id}
                      clientGroupName={clientGroup.name}
                      action={deleteClientGroup}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
