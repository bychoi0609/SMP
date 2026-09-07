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

const SECTIONS = [
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

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">메인</h1>
      </div>

      <div className="flex justify-center gap-4">
        {SECTIONS.map((section) => (
          <Card
            key={section.href}
            className="min-h-48 w-72 justify-center"
          >
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
