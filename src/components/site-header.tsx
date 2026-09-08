"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logout } from "@/app/login/actions"

const NAV_ITEMS = [{ href: "/", label: "메인" }]

const SOLAR_GROUP = {
  label: "태양광",
  items: [
    { href: "/smp", label: "SMP" },
    { href: "/rec", label: "REC" },
    { href: "/reports", label: "리포트" },
    { href: "/plants", label: "발전소관리" },
  ],
}

const TRAILING_NAV_ITEMS = [{ href: "/receipts", label: "영수증정리" }]

function isNavActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
  const pathname = usePathname()
  const isSolarGroupActive = SOLAR_GROUP.items.some((item) => isNavActive(pathname, item.href))

  if (pathname === "/login") return null

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
              const isActive = isNavActive(pathname, item.href)
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

            {TRAILING_NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href)
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

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none",
                  isSolarGroupActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {SOLAR_GROUP.label}
                <ChevronDownIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {SOLAR_GROUP.items.map((item) => {
                  const isActive = isNavActive(pathname, item.href)
                  return (
                    <DropdownMenuLinkItem
                      key={item.href}
                      render={<Link href={item.href} />}
                      closeOnClick
                      className={cn(isActive && "bg-accent text-accent-foreground")}
                    >
                      {item.label}
                    </DropdownMenuLinkItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <form action={logout} className="ml-auto">
            <Button variant="ghost" size="sm" type="submit">
              로그아웃
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
