import { accountRoles } from "@ballast/core"
import type { AccountProblem } from "@ballast/core"
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
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { accountRoleDescription, accountRoleLabel } from "@/ui/account-role.ts"
import { defaultCurrency } from "@/ui/currency.ts"
import { accountProblemMessage } from "@/ui/problems.ts"
import { RoleDot } from "./role-dot.tsx"

export interface OpenAccountDetails {
  readonly name: string
  readonly role: string
  readonly currency: string
}

export type OpenAccountOutcome =
  { readonly ok: true } | { readonly ok: false; readonly problems: readonly AccountProblem[] }

/**
 * Opening an Account: a bottom sheet on phones, a centred dialog on larger
 * screens. Radix keeps focus inside while open, closes on Esc and returns
 * focus to the button that opened it.
 */
export function OpenAccountDialog({
  open,
  onOpenChange,
  onSubmit,
  onCloseAutoFocus,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (details: OpenAccountDetails) => Promise<OpenAccountOutcome>
  onCloseAutoFocus?: (event: Event) => void
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
        closeLabel={m.close()}
        className={cn(
          "max-h-[92dvh] gap-5 overflow-y-auto rounded-3xl border-0 bg-card p-6",
          // Phones: a sheet along the bottom edge, clear of the home indicator.
          "max-w-none sm:max-w-none md:max-w-lg max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          "max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=open]:zoom-in-100",
        )}
      >
        <div aria-hidden className="mx-auto -mt-2 h-1.5 w-12 rounded-full bg-input md:hidden" />
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-bold">{m.open_account_title()}</DialogTitle>
          <DialogDescription>{m.open_account_description()}</DialogDescription>
        </DialogHeader>
        <OpenAccountForm
          onSubmit={onSubmit}
          onOpened={() => {
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

/** Mounted only while the dialog is open, so each opening starts blank. */
function OpenAccountForm({
  onSubmit,
  onOpened,
}: Readonly<{
  onSubmit: (details: OpenAccountDetails) => Promise<OpenAccountOutcome>
  onOpened: () => void
}>) {
  const [problems, setProblems] = useState<readonly AccountProblem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const firstRoleRef = useRef<HTMLInputElement>(null)

  const problemFor = (field: string) => problems.find((problem) => problem.field === field)
  const nameProblem = problemFor("name")
  const roleProblem = problemFor("role")
  const otherProblems = problems.filter(
    (problem) => problem.field !== "name" && problem.field !== "role",
  )

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setSubmitting(true)
    try {
      const outcome = await onSubmit({
        name: textField(fields, "name"),
        role: textField(fields, "role"),
        currency: textField(fields, "currency"),
      })
      if (outcome.ok) {
        onOpened()
        return
      }
      setProblems(outcome.problems)
      // Take the Owner to the first thing to fix.
      const invalid = new Set(outcome.problems.map((problem) => problem.field))
      if (invalid.has("name")) nameRef.current?.focus()
      else if (invalid.has("role")) firstRoleRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <input type="hidden" name="currency" value={defaultCurrency} />

      <div className="space-y-2">
        <Label htmlFor="account-name">{m.account_name()}</Label>
        <Input
          ref={nameRef}
          id="account-name"
          name="name"
          autoComplete="off"
          placeholder={m.account_name_placeholder()}
          aria-invalid={nameProblem !== undefined}
          aria-describedby={nameProblem ? "account-name-problem" : undefined}
          className="h-12 rounded-2xl bg-secondary px-4 text-base md:text-base dark:bg-secondary"
        />
        {nameProblem && (
          <p id="account-name-problem" className="text-sm text-destructive">
            {accountProblemMessage(nameProblem)}
          </p>
        )}
      </div>

      <fieldset aria-describedby={roleProblem ? "account-role-problem" : undefined}>
        <legend className="text-sm font-medium">{m.account_role_question()}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {accountRoles.map((role, index) => (
            <label
              key={role}
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
                value={role}
                aria-describedby={`account-role-${role}-description`}
                className="absolute inset-0 cursor-pointer appearance-none rounded-2xl opacity-0"
              />
              <span className="flex items-center gap-2 font-semibold">
                <RoleDot role={role} className="size-2.5" />
                {accountRoleLabel(role)}
              </span>
              <span
                id={`account-role-${role}-description`}
                className="mt-0.5 block text-xs text-muted-foreground"
              >
                {accountRoleDescription(role)}
              </span>
            </label>
          ))}
        </div>
        {roleProblem && (
          <p id="account-role-problem" className="mt-2 text-sm text-destructive">
            {accountProblemMessage(roleProblem)}
          </p>
        )}
      </fieldset>

      <p className="text-sm text-muted-foreground">
        {m.account_currency({ currency: defaultCurrency })}
      </p>
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
          disabled={submitting}
          className="h-12 flex-1 rounded-2xl text-base font-semibold"
        >
          {submitting ? m.opening_account() : m.open_account()}
        </Button>
      </div>
    </form>
  )
}
