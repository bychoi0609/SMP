import Link from "next/link"
import {
  ArrowRight,
  ChartColumn,
  ClipboardCheck,
  Factory,
  FileText,
  Leaf,
  ReceiptText,
  TrendingUp,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { Card, CardDescription, CardTitle } from "@/components/ui/card"

type Section = {
  href: string
  title: string
  description: string
  icon: LucideIcon
}

const SOLAR_SECTIONS: Section[] = [
  {
    href: "/plants",
    title: "발전소관리",
    description: "계약번호 · 종사업장번호 · 별칭",
    icon: Factory,
  },
  {
    href: "/smp",
    title: "SMP",
    description: "메일 수집 · PDF 파싱 · 다운로드",
    icon: Zap,
  },
  {
    href: "/rec",
    title: "REC",
    description: "발전소별 수량 · 단가 입력",
    icon: Leaf,
  },
  {
    href: "/reports",
    title: "리포트",
    description: "발전소 · 거래처별 매출과 청구 상태",
    icon: ChartColumn,
  },
]

const RECEIPTS_SECTIONS: Section[] = [
  {
    href: "/receipts",
    title: "영수증/세금계산서 정리",
    description: "귀속월별 검토 · 확정",
    icon: ClipboardCheck,
  },
  {
    href: "/receipts/monthly-receipts",
    title: "월별 영수증 데이터",
    description: "카드번호 · 세부내역 · 계정과목",
    icon: ReceiptText,
  },
  {
    href: "/receipts/monthly-invoices",
    title: "월별 세금계산서 데이터",
    description: "매출 · 매입 세금계산서 조회",
    icon: FileText,
  },
  {
    href: "/receipts/outstanding",
    title: "미수·미지급 현황",
    description: "결제일 미입력 건 거래처별 확인",
    icon: Wallet,
  },
  {
    href: "/receipts/profit-loss",
    title: "손익계산서",
    description: "매출 · 원가 · 판관비 · 이익",
    icon: TrendingUp,
  },
]

function SectionCard({ section }: { section: Section }) {
  const Icon = section.icon
  return (
    <Link
      href={section.href}
      className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card className="h-full gap-3 px-5 py-5 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-primary/30">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle>{section.title}</CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </div>
      </Card>
    </Link>
  )
}

function SectionGroup({
  title,
  sections,
}: {
  title: string
  sections: Section[]
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
        <span className="h-5 w-1 rounded-full bg-primary" aria-hidden />
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sections.map((section) => (
          <SectionCard key={section.href} section={section} />
        ))}
      </div>
    </section>
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
