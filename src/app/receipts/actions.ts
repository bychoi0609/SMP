"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import type { ReceiptRow, TaxInvoiceRow } from "@/features/receipts/types/tables"

export type ReceiptCategoryValue = "SALES" | "PURCHASE" | "RECEIPT"
export type TaxInvoiceDirectionValue = "SALES" | "PURCHASE"
export type ReceiptConfirmationStatusValue = "DRAFT" | "CONFIRMED"

export type TaxInvoiceRowInput = Omit<TaxInvoiceRow, "no" | "paymentMatchStatus" | "paymentMatchNote">
export type TaxInvoiceRowDTO = TaxInvoiceRowInput & { id: number }

export type ReceiptRowSnapshotInput = { last4: string; row: ReceiptRow }
export type ReceiptCardRowDTO = { id: number; last4: string; row: ReceiptRow }

// 카테고리(매출/매입/영수증)+귀속월 단위 확정 상태 조회. 확정 이력이 없으면 작업중(DRAFT)으로 본다.
export async function getReceiptConfirmationStatusAction(
  category: ReceiptCategoryValue,
  billingYearMonth: string,
): Promise<ReceiptConfirmationStatusValue> {
  const row = await prisma.receiptMonthlyConfirmation.findUnique({
    where: { category_billingYearMonth: { category, billingYearMonth } },
  })
  return row?.status ?? "DRAFT"
}

// 해당 카테고리의 확정된 귀속월 전체 목록 — 정리 화면에서 월 탭마다 잠금 배지를 한 번에 표시하기 위함.
export async function getConfirmedReceiptMonthsAction(category: ReceiptCategoryValue): Promise<string[]> {
  const rows = await prisma.receiptMonthlyConfirmation.findMany({
    where: { category, status: "CONFIRMED" },
    select: { billingYearMonth: true },
  })
  return rows.map((r) => r.billingYearMonth)
}

// 세금계산서(매출/매입) 특정 귀속월을 확정한다. 정리 화면 draft에서 그 달에 해당하는 행 스냅샷을
// 통째로 교체 저장하고 확정 상태로 표시한다 — 확정되면 "월별 세금계산서 데이터" 화면에 반영된다.
export async function confirmTaxInvoiceMonthAction(
  direction: TaxInvoiceDirectionValue,
  billingYearMonth: string,
  rows: TaxInvoiceRowInput[],
): Promise<{ error?: string }> {
  await prisma.$transaction([
    prisma.receiptTaxInvoiceRow.deleteMany({ where: { direction, billingYearMonth } }),
    prisma.receiptTaxInvoiceRow.createMany({
      data: rows.map((r) => ({
        direction,
        billingYearMonth,
        writtenDate: r.writtenDate,
        counterpartyBizNo: r.counterpartyBizNo,
        counterpartyName: r.counterpartyName,
        totalAmount: r.totalAmount,
        supplyAmount: r.supplyAmount,
        taxAmount: r.taxAmount,
        itemName: r.itemName,
        issueType: r.issueType,
        taxType: r.taxType,
        accountCode: r.accountCode,
        siteCode: r.siteCode,
        paymentBasisAccount: r.paymentBasisAccount,
        paymentDate: r.paymentDate,
        note: r.note,
        project: r.project,
        detail: r.detail,
        approvalNo: r.approvalNo ?? null,
      })),
    }),
    prisma.receiptMonthlyConfirmation.upsert({
      where: { category_billingYearMonth: { category: direction, billingYearMonth } },
      update: { status: "CONFIRMED", confirmedAt: new Date() },
      create: { category: direction, billingYearMonth, status: "CONFIRMED", confirmedAt: new Date() },
    }),
  ])
  revalidatePath("/receipts")
  revalidatePath("/receipts/monthly-invoices")
  return {}
}

// 확정을 취소하고 다시 작업중(DRAFT)으로 되돌린다 — 재수정 전 반드시 거쳐야 함. 확정 스냅샷은
// 삭제한다(브라우저 draft가 여전히 살아있는 원본이라 낡은 사본을 남길 이유가 없음).
export async function unconfirmTaxInvoiceMonthAction(
  direction: TaxInvoiceDirectionValue,
  billingYearMonth: string,
): Promise<{ error?: string }> {
  await prisma.$transaction([
    prisma.receiptTaxInvoiceRow.deleteMany({ where: { direction, billingYearMonth } }),
    prisma.receiptMonthlyConfirmation.upsert({
      where: { category_billingYearMonth: { category: direction, billingYearMonth } },
      update: { status: "DRAFT", confirmedAt: null },
      create: { category: direction, billingYearMonth, status: "DRAFT" },
    }),
  ])
  revalidatePath("/receipts")
  revalidatePath("/receipts/monthly-invoices")
  return {}
}

// 확정된 세금계산서(매출 또는 매입) 전체 기간 데이터. "월별 세금계산서 데이터" 화면에서 기간
// 범위/검색어로 클라이언트 측 필터링한다(단일 사업자 장부라 데이터량이 크지 않음).
export async function getConfirmedTaxInvoiceRowsAction(
  direction: TaxInvoiceDirectionValue,
): Promise<TaxInvoiceRowDTO[]> {
  const rows = await prisma.receiptTaxInvoiceRow.findMany({
    where: { direction },
    orderBy: { writtenDate: "asc" },
  })
  return rows.map((r) => ({
    id: r.id,
    writtenDate: r.writtenDate,
    counterpartyBizNo: r.counterpartyBizNo,
    counterpartyName: r.counterpartyName,
    totalAmount: Number(r.totalAmount),
    supplyAmount: Number(r.supplyAmount),
    taxAmount: Number(r.taxAmount),
    itemName: r.itemName,
    issueType: r.issueType as TaxInvoiceRow["issueType"],
    taxType: r.taxType as TaxInvoiceRow["taxType"],
    accountCode: r.accountCode,
    siteCode: r.siteCode,
    paymentBasisAccount: r.paymentBasisAccount,
    paymentDate: r.paymentDate,
    note: r.note,
    project: r.project,
    detail: r.detail,
    approvalNo: r.approvalNo ?? undefined,
  }))
}

// 카드 영수증 특정 귀속월을 확정한다 — confirmTaxInvoiceMonthAction과 동일한 스냅샷 교체 방식.
export async function confirmReceiptCardMonthAction(
  billingYearMonth: string,
  entries: ReceiptRowSnapshotInput[],
): Promise<{ error?: string }> {
  await prisma.$transaction([
    prisma.receiptCardRow.deleteMany({ where: { billingYearMonth } }),
    prisma.receiptCardRow.createMany({
      data: entries.map(({ last4, row }) => ({
        last4,
        billingYearMonth,
        date: row.date,
        merchantName: row.merchantName,
        supplyAmount: row.supplyAmount,
        taxAmount: row.taxAmount,
        totalAmount: row.totalAmount,
        siteName: row.siteName,
        description: row.description,
        accountCode: row.accountCode,
        siteCode: row.siteCode,
        taxType: row.taxType,
        detail: row.detail,
      })),
    }),
    prisma.receiptMonthlyConfirmation.upsert({
      where: { category_billingYearMonth: { category: "RECEIPT", billingYearMonth } },
      update: { status: "CONFIRMED", confirmedAt: new Date() },
      create: { category: "RECEIPT", billingYearMonth, status: "CONFIRMED", confirmedAt: new Date() },
    }),
  ])
  revalidatePath("/receipts")
  revalidatePath("/receipts/monthly-receipts")
  return {}
}

export async function unconfirmReceiptCardMonthAction(billingYearMonth: string): Promise<{ error?: string }> {
  await prisma.$transaction([
    prisma.receiptCardRow.deleteMany({ where: { billingYearMonth } }),
    prisma.receiptMonthlyConfirmation.upsert({
      where: { category_billingYearMonth: { category: "RECEIPT", billingYearMonth } },
      update: { status: "DRAFT", confirmedAt: null },
      create: { category: "RECEIPT", billingYearMonth, status: "DRAFT" },
    }),
  ])
  revalidatePath("/receipts")
  revalidatePath("/receipts/monthly-receipts")
  return {}
}

// 확정된 카드 영수증 전체 기간 데이터.
export async function getConfirmedReceiptCardRowsAction(): Promise<ReceiptCardRowDTO[]> {
  const rows = await prisma.receiptCardRow.findMany({ orderBy: { date: "asc" } })
  return rows.map((r) => ({
    id: r.id,
    last4: r.last4,
    row: {
      date: r.date,
      merchantName: r.merchantName,
      supplyAmount: Number(r.supplyAmount),
      taxAmount: Number(r.taxAmount),
      totalAmount: Number(r.totalAmount),
      siteName: r.siteName,
      description: r.description,
      accountCode: r.accountCode,
      siteCode: r.siteCode,
      taxType: r.taxType,
      detail: r.detail,
    },
  }))
}
