"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "메인" },
  { href: "/smp", label: "SMP" },
  { href: "/rec", label: "REC" },
  { href: "/reports", label: "리포트" },
  { href: "/plants", label: "발전소관리" },
  { href: "/receipts", label: "영수증정리" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="px-6 md:px-10">
        <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center gap-6">
          <span
            className="text-[2.55rem] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-baloo)", color: "#1a2a52" }}
          >
            Bodado
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
