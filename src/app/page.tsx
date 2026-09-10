import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const SOLAR_SECTIONS = [
  {
    href: "/plants",
    title: "발전소관리",
    description: "발전소 계약번호·종사업장번호·별칭 등 마스터 정보를 관리합니다.",
    ready: true,
  },
  {
    href: "/smp",
    title: "SMP",
    description: "한전 메일 자동 수집, 파싱, PDF 다운로드를 처리합니다.",
    ready: true,
  },
  {
    href: "/rec",
    title: "REC",
    description: "확정된 SMP 데이터를 이어받아 발전소별 REC 수량·단가를 관리합니다.",
    ready: true,
  },
  {
    href: "/reports",
    title: "리포트",
    description: "발전소별·거래처별 통합 매출 뷰와 청구 상태를 확인합니다.",
    ready: true,
  },
]

const RECEIPTS_SECTIONS = [
  {
    href: "/receipts",
    title: "영수증/세금계산서 정리",
    description: "귀속월 단위로 영수증·세금계산서 데이터를 검토하고 확정합니다.",
    ready: true,
  },
  {
    href: "/receipts/monthly-receipts",
    title: "월별 영수증 데이터",
    description: "확정된 영수증 데이터를 카드번호·세부내역·계정과목별로 조회합니다.",
    ready: true,
  },
  {
    href: "/receipts/monthly-invoices",
    title: "월별 세금계산서 데이터",
    description: "확정된 매출·매입 세금계산서 데이터를 월별로 조회합니다.",
    ready: true,
  },
]

function SectionGroup({
  title,
  sections,
}: {
  title: string
  sections: typeof SOLAR_SECTIONS
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap justify-center gap-4">
        {sections.map((section) => (
          <Card key={section.href} className="min-h-48 w-72 justify-center">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
              <CardAction>
                {section.ready ? (
                  <Button size="sm" render={<Link href={section.href} />}>
                    이동 <ArrowRight />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    준비 중
                  </Button>
                )}
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">메인</h1>
      </div>

      <SectionGroup title="영수증/세금계산서" sections={RECEIPTS_SECTIONS} />
      <SectionGroup title="태양광" sections={SOLAR_SECTIONS} />
    </div>
  )
}
