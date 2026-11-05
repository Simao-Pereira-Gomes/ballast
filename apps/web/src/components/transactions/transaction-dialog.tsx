import { directionOf, directions } from "@ballast/core"
import type { Direction, Transaction, TransactionProblem } from "@ballast/core"
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
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { amountForInput } from "@/ui/format.ts"
import { transactionProblemMessage } from "@/ui/transaction-problems.ts"

export interface TransactionFormDetails {
  readonly date: string
  readonly amount: string
  readonly direction: string
  readonly description: string
}

/** A Transaction can vanish while its dialog is open, e.g. deleted in another tab. */
type Gone = { readonly ok: false; readonly reason: "gone" }

export type TransactionOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: "invalid"
      readonly problems: readonly TransactionProblem[]
    }
  | Gone

export type DeleteOutcome = { readonly ok: true } | Gone

/** What the dialog is for: a new Transaction, or changing a manual one. */
export type TransactionDialogMode =
  { readonly kind: "add" } | { readonly kind: "edit"; readonly transaction: Transaction }

const directionLabel: Record<Direction, () => string> = {
  outflow: m.direction_outflow,
  inflow: m.direction_inflow,
}

/**
 * Adding or editing a manual Transaction: a bottom sheet on phones, a
 * centred dialog on larger screens. Editing also offers a two-step delete.
 */
export function TransactionDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  onDelete,
  onGone,
  onCloseAutoFocus,
}: Readonly<{
  open: boolean
  /** Kept while the dialog closes, so its content doesn't change mid-animation. */
  mode: TransactionDialogMode
  onOpenChange: (open: boolean) => void
  onSubmit: (details: TransactionFormDetails) => Promise<TransactionOutcome>
  onDelete: (transaction: Transaction) => Promise<DeleteOutcome>
  onGone: () => void
  onCloseAutoFocus?: (event: Event) => void
}>) {
  const editing = mode.kind === "edit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
        closeLabel={m.close()}
        className={sheetContentClassName}
      >
        <div aria-hidden className={sheetHandleClassName} />
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-bold">
            {editing ? m.edit_transaction_title() : m.add_transaction_title()}
          </DialogTitle>
          <DialogDescription>
            {editing ? m.edit_transaction_description() : m.add_transaction_description()}
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          key={editing ? mode.transaction.id : "add"}
          mode={mode}
          onSubmit={onSubmit}
          onDelete={onDelete}
          onDone={(gone) => {
            if (gone) onGone()
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

const textField = (fields: FormData, name: string): string => {
  const value = fields.get(name)
  return typeof value === "string" ? value : ""
}

const fieldClassName = "h-12 rounded-2xl bg-secondary px-4 text-base md:text-base dark:bg-secondary"

/** Mounted only while the dialog is open, so each opening starts from its Transaction. */
function TransactionForm({
  mode,
  onSubmit,
  onDelete,
  onDone,
}: Readonly<{
  mode: TransactionDialogMode
  onSubmit: (details: TransactionFormDetails) => Promise<TransactionOutcome>
  onDelete: (transaction: Transaction) => Promise<DeleteOutcome>
  onDone: (gone: boolean) => void
}>) {
  const [problems, setProblems] = useState<readonly TransactionProblem[]>([])
  const [busy, setBusy] = useState<"saving" | "deleting" | undefined>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const directionRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)

  const existing = mode.kind === "edit" ? mode.transaction : undefined
  const initial = {
    date: existing?.date.toString() ?? Temporal.Now.plainDateISO().toString(),
    direction: existing === undefined ? "outflow" : directionOf(existing),
    amount: existing === undefined ? "" : amountForInput(existing.amount),
    description: existing?.description ?? "",
  }

  const problemFor = (field: TransactionProblem["field"]) =>
    problems.find((problem) => problem.field === field)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy("saving")
    try {
      const outcome = await onSubmit({
        date: textField(fields, "date"),
        amount: textField(fields, "amount"),
        direction: textField(fields, "direction"),
        description: textField(fields, "description"),
      })
      if (outcome.ok || outcome.reason === "gone") {
        onDone(!outcome.ok)
        return
      }
      setProblems(outcome.problems)
      const invalid = new Set(outcome.problems.map((problem) => problem.field))
      const first = [
        ["direction", directionRef],
        ["amount", amountRef],
        ["date", dateRef],
        ["description", descriptionRef],
      ] as const
      first.find(([field]) => invalid.has(field))?.[1].current?.focus()
    } finally {
      setBusy(undefined)
    }
  }

  async function handleDelete(transaction: Transaction) {
    setBusy("deleting")
    try {
      const outcome = await onDelete(transaction)
      onDone(!outcome.ok)
    } finally {
      setBusy(undefined)
    }
  }

  const problemText = (field: TransactionProblem["field"]) => {
    const problem = problemFor(field)
    return (
      problem && (
        <p id={`transaction-${field}-problem`} className="text-sm text-destructive">
          {transactionProblemMessage(problem)}
        </p>
      )
    )
  }

  const describedBy = (field: TransactionProblem["field"]) =>
    problemFor(field) ? `transaction-${field}-problem` : undefined

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <fieldset aria-describedby={describedBy("direction")}>
        <legend className="text-sm font-medium">{m.transaction_direction()}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {directions.map((direction, index) => (
            <label
              key={direction}
              className={cn(
                "relative cursor-pointer rounded-2xl border-2 border-transparent bg-secondary p-3 text-center font-semibold transition-colors",
                "has-checked:border-primary has-checked:bg-primary/10",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              )}
            >
              <input
                ref={index === 0 ? directionRef : undefined}
                type="radio"
                name="direction"
                value={direction}
                defaultChecked={direction === initial.direction}
                className="absolute inset-0 cursor-pointer appearance-none rounded-2xl opacity-0"
              />
              {directionLabel[direction]()}
            </label>
          ))}
        </div>
        <div className="mt-2">{problemText("direction")}</div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="transaction-amount">{m.transaction_amount()}</Label>
          <Input
            ref={amountRef}
            id="transaction-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={initial.amount}
            placeholder={m.transaction_amount_placeholder()}
            aria-invalid={problemFor("amount") !== undefined}
            aria-describedby={describedBy("amount")}
            className={fieldClassName}
          />
          {problemText("amount")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="transaction-date">{m.transaction_date()}</Label>
          <Input
            ref={dateRef}
            id="transaction-date"
            name="date"
            type="date"
            defaultValue={initial.date}
            aria-invalid={problemFor("date") !== undefined}
            aria-describedby={describedBy("date")}
            className={fieldClassName}
          />
          {problemText("date")}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction-description">{m.transaction_description()}</Label>
        <Input
          ref={descriptionRef}
          id="transaction-description"
          name="description"
          autoComplete="off"
          defaultValue={initial.description}
          placeholder={m.transaction_description_placeholder()}
          aria-invalid={problemFor("description") !== undefined}
          aria-describedby={describedBy("description")}
          className={fieldClassName}
        />
        {problemText("description")}
      </div>

      <div className="flex gap-3">
        <DialogClose asChild>
          <Button type="button" variant="secondary" className="h-12 flex-1 rounded-2xl text-base">
            {m.cancel()}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={busy !== undefined}
          className="h-12 flex-1 rounded-2xl text-base font-semibold"
        >
          {busy === "saving" ? m.saving_transaction() : m.save_transaction()}
        </Button>
      </div>

      {existing && (
        <div className="border-t border-border pt-4">
          {confirmingDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== undefined}
              className="h-12 w-full rounded-2xl text-base font-semibold"
              onClick={() => void handleDelete(existing)}
            >
              {busy === "deleting" ? m.deleting_transaction() : m.confirm_delete_transaction()}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-2xl text-base text-destructive hover:text-destructive"
              onClick={() => {
                setConfirmingDelete(true)
              }}
            >
              {m.delete_transaction()}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
