"use client"

import { useRef, useState, useTransition } from "react"
import { AlertTriangle, CheckCircle2, Download, FileUp } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { FillReport, MappingItem } from "@/lib/report-fill/fill"
import type { ReportKind } from "@/lib/report-fill/workbook"
import { base64ToBlob, downloadBlob } from "../../smp/grid-shared"
import { saveReportLabelMappingsAction } from "./actions"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const SKIP = "skip" // 매핑 선택값: 해당 없음

type FillResponse =
  | { status: "error"; error: string }
  | {
      status: "needs_mapping"
      kind: ReportKind
      kindLabel: string
      items: MappingItem[]
      plants: Array<{ id: number; name: string; capacityKw: number | null }>
    }
  | { status: "ok"; report: FillReport; fileName: string; base64: string }

type Job = {
  id: number
  file: File
  month: string
  clientGroupId: number
  state: "working" | "done" | "error" | "mapping"
  response?: FillResponse
}

export function ExportWorkspace({
  months,
  defaultMonth,
  clientGroups,
  defaultClientGroupId,
}: {
  months: string[]
  defaultMonth: string
  clientGroups: Array<{ id: number; name: string }>
  defaultClientGroupId: number
}) {
  const [month, setMonth] = useState(defaultMonth)
  const [clientGroupId, setClientGroupId] = useState(defaultClientGroupId)
  const [jobs, setJobs] = useState<Job[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  function patchJob(id: number, patch: Partial<Job>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)))
  }

  async function runJob(job: Job) {
    patchJob(job.id, { state: "working", response: undefined })
    const form = new FormData()
    form.set("file", job.file)
    form.set("month", job.month)
    form.set("clientGroupId", String(job.clientGroupId))
    let response: FillResponse
    try {
      const res = await fetch("/api/reports/fill", { method: "POST", body: form })
      response = (await res.json()) as FillResponse
    } catch {
      response = { status: "error", error: "파일을 처리하지 못했어요. 잠시 후 다시 시도해 주세요." }
    }
    if (response.status === "ok") {
      downloadBlob(base64ToBlob(response.base64, XLSX_MIME), response.fileName)
      toast.success(`${response.report.kindLabel}에 ${response.report.month} 값을 채웠어요.`)
    }
    patchJob(job.id, {
      state: response.status === "ok" ? "done" : response.status === "error" ? "error" : "mapping",
      response,
    })
  }

  function addFiles(files: FileList | File[]) {
    const list = [...files].filter((f) => f.name.toLowerCase().endsWith(".xlsx"))
    if (list.length === 0) {
      toast.error(".xlsx 파일만 올릴 수 있어요.")
      return
    }
    const newJobs = list.map<Job>((file) => ({
      id: nextId.current++,
      file,
      month,
      clientGroupId,
      state: "working",
    }))
    setJobs((prev) => [...newJobs, ...prev])
    // 파일마다 순서대로 처리(동시에 여러 개를 읽으면 서버 메모리를 많이 쓴다)
    void newJobs.reduce((p, job) => p.then(() => runJob(job)), Promise.resolve())
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={months.map((m) => ({ value: m, label: `${m} 귀속월` }))}
          value={month}
          onValueChange={(v) => v && setMonth(String(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m} 귀속월
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={clientGroups.map((cg) => ({ value: String(cg.id), label: cg.name }))}
          value={String(clientGroupId)}
          onValueChange={(v) => v && setClientGroupId(Number(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clientGroups.map((cg) => (
              <SelectItem key={cg.id} value={String(cg.id)}>
                {cg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card text-sm text-muted-foreground transition-colors",
          dragging ? "border-primary bg-accent/40" : "border-border hover:bg-accent/20",
        )}
      >
        <FileUp className="size-6" />
        <span>
          <span className="font-medium text-foreground">{month}</span> 값을 채울 엑셀 파일을 끌어다
          놓거나 눌러서 골라 주세요
        </span>
        <span className="text-xs">1번·2번·3번 파일을 한 번에 여러 개 올려도 돼요. 종류는 자동으로 알아봐요.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onRetry={() => runJob(job)} />
      ))}
    </div>
  )
}

function JobCard({ job, onRetry }: { job: Job; onRetry: () => void }) {
  const response = job.response
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{job.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {job.month} 귀속월
            {response && "kindLabel" in response ? ` · ${response.kindLabel}` : ""}
            {response?.status === "ok" ? ` · ${response.report.kindLabel}` : ""}
          </p>
        </div>
        {job.state === "working" && <Badge variant="outline">처리 중...</Badge>}
        {job.state === "error" && <Badge variant="destructive">실패</Badge>}
        {job.state === "mapping" && <Badge variant="outline">이름 확인 필요</Badge>}
        {response?.status === "ok" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadBlob(base64ToBlob(response.base64, XLSX_MIME), response.fileName)
            }
          >
            <Download /> 다시 내려받기
          </Button>
        )}
      </div>

      {response?.status === "error" && (
        <p className="text-sm text-destructive">{response.error}</p>
      )}
      {response?.status === "needs_mapping" && (
        <MappingTable response={response} onSaved={onRetry} />
      )}
      {response?.status === "ok" && <ReportSummary report={response.report} />}
    </div>
  )
}

function ReportSummary({ report }: { report: FillReport }) {
  const lists: Array<{ title: string; items: string[] }> = [
    { title: "파일에 자리가 없는 앱 발전소 (엑셀에 시트/블록/행을 추가해 주세요)", items: report.missingPlants },
    { title: "그 달 앱 데이터가 없어 비워 둔 항목", items: report.noData },
    { title: "\"해당 없음\"으로 건너뛴 항목", items: report.skipped },
    { title: "확인 필요", items: report.warnings },
  ].filter((l) => l.items.length > 0)

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-primary" />
        <span>
          {report.filledCount}곳을 채웠어요 · 확정 {report.statusCounts["확정"]} · SMP확정{" "}
          {report.statusCounts["SMP확정"]}
          {report.statusCounts["미청구"] > 0 && ` · 미청구 ${report.statusCounts["미청구"]}`}
        </span>
      </p>
      {report.statusCounts["확정"] < report.filledCount && (
        <p className="text-xs text-muted-foreground">
          REC가 아직 확정되지 않은 발전소는 예상 수량으로 채웠고, 단가가 없으면 REC 금액을 비워 뒀어요(중순 잠정본).
        </p>
      )}
      {lists.map((list) => (
        <div key={list.title} className="rounded-lg bg-muted/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="size-3.5" /> {list.title} ({list.items.length})
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{list.items.join(", ")}</p>
        </div>
      ))}
    </div>
  )
}

// 처음 보는 이름을 앱 발전소와 짝지어 저장한다. 추천(용량·이름)을 미리 골라 둔다.
function MappingTable({
  response,
  onSaved,
}: {
  response: Extract<FillResponse, { status: "needs_mapping" }>
  onSaved: () => void
}) {
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      response.items.map((item) => [
        item.label,
        item.suggestedPlantId !== null ? String(item.suggestedPlantId) : "",
      ]),
    ),
  )
  const [isSaving, startSaving] = useTransition()
  const options = [
    { value: SKIP, label: "해당 없음 (채우지 않음)" },
    ...response.plants.map((p) => ({
      value: String(p.id),
      label: `${p.name}${p.capacityKw !== null ? ` · ${formatNumber(p.capacityKw, 2)}kW` : ""}`,
    })),
  ]
  const unchosen = response.items.filter((item) => !choices[item.label]).length

  function save() {
    startSaving(async () => {
      const result = await saveReportLabelMappingsAction(
        response.kind,
        response.items.map((item) => ({
          label: item.label,
          plantId: choices[item.label] === SKIP ? null : Number(choices[item.label]),
        })),
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      onSaved()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        이 파일에서 처음 보는 이름 {response.items.length}개를 앱 발전소와 짝지어 주세요. 저장하면
        다음부터는 바로 채워요.
      </p>
      <div className="max-h-[50vh] overflow-auto rounded-lg border">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium">파일 속 이름</th>
              <th className="w-24 border-b px-3 py-2 text-right font-medium">용량(kW)</th>
              <th className="w-80 border-b px-3 py-2 text-left font-medium">앱 발전소</th>
            </tr>
          </thead>
          <tbody>
            {response.items.map((item) => (
              <tr key={item.label}>
                <td className="border-b px-3 py-1.5">{item.label}</td>
                <td className="border-b px-3 py-1.5 text-right tabular-nums">
                  {formatNumber(item.capacityKw, 2)}
                </td>
                <td className="border-b px-3 py-1.5">
                  <Select
                    items={options}
                    value={choices[item.label] || null}
                    onValueChange={(v) =>
                      setChoices((prev) => ({ ...prev, [item.label]: v ? String(v) : "" }))
                    }
                  >
                    <SelectTrigger
                      className={cn("w-full", !choices[item.label] && "border-destructive")}
                    >
                      <SelectValue placeholder="골라 주세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        {unchosen > 0 && (
          <span className="text-xs text-destructive">{unchosen}개를 더 골라 주세요</span>
        )}
        <Button size="sm" disabled={isSaving || unchosen > 0} onClick={save}>
          {isSaving ? "저장 중..." : "저장하고 채우기"}
        </Button>
      </div>
    </div>
  )
}
