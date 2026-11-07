import { maxImportMegabytes } from "@ballast/core"
import type { ImportProblem, Money } from "@ballast/core"
import { CircleCheck, TriangleAlert } from "lucide-react"
import { useRef, useState } from "react"
import type { SubmitEvent } from "react"
import { sheetContentClassName, sheetHandleClassName } from "@/components/shell/sheet.ts"
import { Button } from "@/components/ui/button.tsx"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { m } from "@/paraglide/messages.js"
import { formatDay, formatMoney } from "@/ui/format.ts"
import { importProblemMessage } from "@/ui/import-problems.ts"

/** What the Owner is shown after an Import. */
export interface ImportSummaryView {
  readonly fileName: string
  readonly lineCount: number
  readonly firstDate: Temporal.PlainDate
  readonly lastDate: Temporal.PlainDate
  readonly moneyIn: Money.Money
  readonly moneyOut: Money.Money
  readonly balanceCheckpoint: Money.Money
  readonly accountBalance: Money.Money
}

export type ImportOutcome =
  | { readonly ok: true; readonly value: ImportSummaryView }
  | { readonly ok: false; readonly reason: "invalid"; readonly problems: readonly ImportProblem[] }

/** How many problems are listed before the rest are only counted. */
const shownProblems = 20

/**
 * Importing a bank export into the Account: choose a file, then see what
 * was imported, or why nothing was. A bottom sheet on phones, a centred
 * dialog on larger screens.
 */
export function ImportDialog({
  open,
  onOpenChange,
  onImport,
  onCloseAutoFocus,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (file: File) => Promise<ImportOutcome>
  onCloseAutoFocus?: (event: Event) => void
}>) {
  const [summary, setSummary] = useState<ImportSummaryView | undefined>()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSummary(undefined)
        onOpenChange(next)
      }}
    >
      <DialogContent
        {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
        closeLabel={m.close()}
        className={sheetContentClassName}
      >
        <div aria-hidden className={sheetHandleClassName} />
        {summary === undefined ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-bold">{m.import_title()}</DialogTitle>
              <DialogDescription>{m.import_description()}</DialogDescription>
            </DialogHeader>
            <ImportForm onImport={onImport} onImported={setSummary} />
          </>
        ) : (
          <ImportSummaryPanel summary={summary} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ImportForm({
  onImport,
  onImported,
}: Readonly<{
  onImport: (file: File) => Promise<ImportOutcome>
  onImported: (summary: ImportSummaryView) => void
}>) {
  const [problems, setProblems] = useState<readonly ImportProblem[]>([])
  const [missingFile, setMissingFile] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const problemsRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    setProblems([])
    if (file === undefined) {
      setMissingFile(true)
      fileRef.current?.focus()
      return
    }
    setMissingFile(false)
    setBusy(true)
    try {
      const outcome = await onImport(file)
      if (outcome.ok) {
        onImported(outcome.value)
        return
      }
      setProblems(outcome.problems)
      problemsRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const hidden = problems.length - shownProblems

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <div className="space-y-2">
        <Label htmlFor="import-file">{m.import_file()}</Label>
        <Input
          ref={fileRef}
          id="import-file"
          name="file"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-invalid={missingFile}
          aria-describedby="import-file-hint"
          onChange={() => {
            setMissingFile(false)
            setProblems([])
          }}
          className="h-12 rounded-2xl bg-secondary px-4 py-3 text-base md:text-base dark:bg-secondary"
        />
        <p id="import-file-hint" className="text-sm text-muted-foreground">
          {missingFile ? (
            <span className="text-destructive">{m.import_choose_file()}</span>
          ) : (
            m.import_file_hint({ limit: maxImportMegabytes.toString() })
          )}
        </p>
      </div>

      <div ref={problemsRef} tabIndex={-1} role="alert" className="outline-none">
        {problems.length > 0 && (
          <div className="rounded-2xl bg-destructive/10 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              {m.import_failed_title()}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {problems.slice(0, shownProblems).map((problem) => (
                <li key={`${problem.problem}:${"row" in problem ? problem.row.toString() : ""}`}>
                  {importProblemMessage(problem)}
                </li>
              ))}
            </ul>
            {hidden > 0 && <p className="mt-2">{m.import_more_problems({ count: hidden })}</p>}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <DialogClose asChild>
          <Button type="button" variant="secondary" className="h-12 flex-1 rounded-2xl text-base">
            {m.cancel()}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={busy}
          className="h-12 flex-1 rounded-2xl text-base font-semibold"
        >
          {busy ? m.importing() : m.import_submit()}
        </Button>
      </div>
    </form>
  )
}

function ImportSummaryPanel({ summary }: Readonly<{ summary: ImportSummaryView }>) {
  const figures = [
    {
      label: m.import_summary_period(),
      value: m.import_summary_period_value({
        from: formatDay(summary.firstDate),
        to: formatDay(summary.lastDate),
      }),
    },
    { label: m.import_summary_money_in(), value: formatMoney(summary.moneyIn) },
    { label: m.import_summary_money_out(), value: formatMoney(summary.moneyOut) },
    { label: m.import_summary_balance_checkpoint(), value: formatMoney(summary.balanceCheckpoint) },
    { label: m.import_summary_account_balance(), value: formatMoney(summary.accountBalance) },
  ]

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
          <CircleCheck className="size-6 text-primary" aria-hidden />
          {m.import_done_title()}
        </DialogTitle>
        <DialogDescription>
          {m.import_done_description({ count: summary.lineCount, fileName: summary.fileName })}
        </DialogDescription>
      </DialogHeader>
      <dl className="divide-y divide-border rounded-2xl bg-secondary">
        {figures.map((figure) => (
          <div key={figure.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted-foreground">{figure.label}</dt>
            <dd className="text-right font-semibold tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <DialogClose asChild>
        <Button type="button" className="h-12 w-full rounded-2xl text-base font-semibold">
          {m.import_done()}
        </Button>
      </DialogClose>
    </>
  )
}
