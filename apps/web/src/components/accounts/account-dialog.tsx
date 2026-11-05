import { accountRoles } from "@ballast/core"
import type { Account, AccountProblem, AccountRole } from "@ballast/core"
import { useRef, useState } from "react"
import type { SubmitEvent } from "react"
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
import { sheetContentClassName, sheetHandleClassName } from "@/components/shell/sheet.ts"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { accountRoleDescription, accountRoleLabel } from "@/ui/account-role.ts"
import { interestRateForInput } from "@/ui/account-terms.ts"
import { defaultCurrency } from "@/ui/currency.ts"
import { accountProblemMessage } from "@/ui/problems.ts"
import { RoleDot } from "./role-dot.tsx"

/** What the Account form submits, as typed. The core checks it. */
export interface AccountFormDetails {
  readonly name: string
  readonly role: string
  readonly currency: string
  readonly interestRate: string
}

export type AccountOutcome =
  { readonly ok: true } | { readonly ok: false; readonly problems: readonly AccountProblem[] }

/** What the dialog is for: opening an Account, or changing one. */
export type AccountDialogMode =
  | { readonly kind: "open" }
  | {
      readonly kind: "edit"
      readonly account: Account
      /** Archives the Account; only offered while it is active. */
      readonly onArchive: () => Promise<void>
    }

/**
 * Opening or editing an Account: a bottom sheet on phones, a centred dialog
 * on larger screens. Radix keeps focus inside while open, closes on Esc and
 * returns focus to the button that opened it.
 */
export function AccountDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  onCloseAutoFocus,
}: Readonly<{
  open: boolean
  mode: AccountDialogMode
  onOpenChange: (open: boolean) => void
  onSubmit: (details: AccountFormDetails) => Promise<AccountOutcome>
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
            {editing ? m.edit_account_title() : m.open_account_title()}
          </DialogTitle>
          <DialogDescription>
            {editing ? m.edit_account_description() : m.open_account_description()}
          </DialogDescription>
        </DialogHeader>
        <AccountForm
          mode={mode}
          onSubmit={onSubmit}
          onDone={() => {
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

/** Mounted only while the dialog is open, so each opening starts from its Account. */
function AccountForm({
  mode,
  onSubmit,
  onDone,
}: Readonly<{
  mode: AccountDialogMode
  onSubmit: (details: AccountFormDetails) => Promise<AccountOutcome>
  onDone: () => void
}>) {
  const existing = mode.kind === "edit" ? mode.account : undefined
  const [role, setRole] = useState<AccountRole | undefined>(existing?.role)
  const [problems, setProblems] = useState<readonly AccountProblem[]>([])
  const [busy, setBusy] = useState<"saving" | "archiving" | undefined>()
  const nameRef = useRef<HTMLInputElement>(null)
  const firstRoleRef = useRef<HTMLInputElement>(null)
  const rateRef = useRef<HTMLInputElement>(null)

  const problemFor = (field: AccountProblem["field"]) =>
    problems.find((problem) => problem.field === field)
  const shownFields = new Set<AccountProblem["field"]>(["name", "role", "interestRate"])
  const otherProblems = problems.filter((problem) => !shownFields.has(problem.field))
  const describedBy = (field: AccountProblem["field"]) =>
    problemFor(field) ? `account-${field}-problem` : undefined
  const problemText = (field: AccountProblem["field"]) => {
    const problem = problemFor(field)
    return (
      problem && (
        <p id={`account-${field}-problem`} className="mt-2 text-sm text-destructive">
          {accountProblemMessage(problem)}
        </p>
      )
    )
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy("saving")
    try {
      const outcome = await onSubmit({
        name: textField(fields, "name"),
        role: textField(fields, "role"),
        currency: textField(fields, "currency"),
        interestRate: textField(fields, "interestRate"),
      })
      if (outcome.ok) {
        onDone()
        return
      }
      setProblems(outcome.problems)
      // Take the Owner to the first thing to fix.
      const invalid = new Set(outcome.problems.map((problem) => problem.field))
      const first = [
        ["name", nameRef],
        ["role", firstRoleRef],
        ["interestRate", rateRef],
      ] as const
      first.find(([field]) => invalid.has(field))?.[1].current?.focus()
    } finally {
      setBusy(undefined)
    }
  }

  async function handleArchive(archive: () => Promise<void>) {
    setBusy("archiving")
    try {
      await archive()
      onDone()
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <input type="hidden" name="currency" value={existing?.currency ?? defaultCurrency} />

      <div className="space-y-2">
        <Label htmlFor="account-name">{m.account_name()}</Label>
        <Input
          ref={nameRef}
          id="account-name"
          name="name"
          autoComplete="off"
          defaultValue={existing?.name ?? ""}
          placeholder={m.account_name_placeholder()}
          aria-invalid={problemFor("name") !== undefined}
          aria-describedby={describedBy("name")}
          className={fieldClassName}
        />
        {problemText("name")}
      </div>

      <fieldset aria-describedby={describedBy("role")}>
        <legend className="text-sm font-medium">{m.account_role_question()}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {accountRoles.map((choice, index) => (
            <label
              key={choice}
              className={cn(
                "relative cursor-pointer rounded-2xl border-2 border-transparent bg-secondary p-3 transition-colors",
                "has-checked:border-primary has-checked:bg-primary/10",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              )}
            >
              <input
                ref={index === 0 ? firstRoleRef : undefined}
                type="radio"
                name="role"
                value={choice}
                checked={role === choice}
                onChange={() => {
                  setRole(choice)
                }}
                aria-describedby={`account-role-${choice}-description`}
                className="absolute inset-0 cursor-pointer appearance-none rounded-2xl opacity-0"
              />
              <span className="flex items-center gap-2 font-semibold">
                <RoleDot role={choice} className="size-2.5" />
                {accountRoleLabel(choice)}
              </span>
              <span
                id={`account-role-${choice}-description`}
                className="mt-0.5 block text-xs text-muted-foreground"
              >
                {accountRoleDescription(choice)}
              </span>
            </label>
          ))}
        </div>
        {problemText("role")}
      </fieldset>

      {role === "liability" && (
        <div className="space-y-2">
          <Label htmlFor="account-interest-rate">{m.interest_rate()}</Label>
          <div className="relative">
            <Input
              ref={rateRef}
              id="account-interest-rate"
              name="interestRate"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={
                existing?.interestRate ? interestRateForInput(existing.interestRate) : ""
              }
              placeholder={m.interest_rate_placeholder()}
              aria-invalid={problemFor("interestRate") !== undefined}
              aria-describedby={cn("account-interest-rate-hint", describedBy("interestRate"))}
              className={cn(fieldClassName, "pr-10")}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-muted-foreground"
            >
              %
            </span>
          </div>
          <p id="account-interest-rate-hint" className="text-xs text-muted-foreground">
            {m.interest_rate_hint()}
          </p>
          {problemText("interestRate")}
        </div>
      )}

      {role === "investment" && (
        <p className="text-sm text-muted-foreground">{m.investment_holdings_hint()}</p>
      )}

      {existing === undefined && (
        <p className="text-sm text-muted-foreground">
          {m.account_currency({ currency: defaultCurrency })}
        </p>
      )}
      {otherProblems.map((problem) => (
        <p key={problem.field} className="text-sm text-destructive">
          {accountProblemMessage(problem)}
        </p>
      ))}

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
          {existing === undefined
            ? busy === "saving"
              ? m.opening_account()
              : m.open_account()
            : busy === "saving"
              ? m.saving_account()
              : m.save_account()}
        </Button>
      </div>

      {mode.kind === "edit" && !mode.account.archived && (
        <div className="space-y-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== undefined}
            aria-describedby="account-archive-hint"
            className="h-12 w-full rounded-2xl text-base"
            onClick={() => void handleArchive(mode.onArchive)}
          >
            {busy === "archiving" ? m.archiving_account() : m.archive_account()}
          </Button>
          <p id="account-archive-hint" className="text-center text-xs text-muted-foreground">
            {m.archive_account_hint()}
          </p>
        </div>
      )}
    </form>
  )
}
