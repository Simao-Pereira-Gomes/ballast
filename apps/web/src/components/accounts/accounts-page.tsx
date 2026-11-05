import type { AccountSummary } from "@ballast/core"
import { Link } from "@tanstack/react-router"
import { ChevronRight, PieChart, Plus } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { m } from "@/paraglide/messages.js"
import { AccountList, ArchivedAccounts } from "./account-list.tsx"
import { EmptyAccounts } from "./empty-accounts.tsx"
import { AccountDialog } from "./account-dialog.tsx"
import type { AccountFormDetails, AccountOutcome } from "./account-dialog.tsx"

/**
 * The Accounts page: active Account cards with role filters, or the empty
 * state, the archived Accounts behind a toggle, and the ways to open an
 * Account (header button on larger screens, floating button on phones).
 * With any Investment Account, a link to the Investment overview.
 */
export function AccountsPage({
  accounts,
  archivedAccounts,
  onOpenAccount,
}: Readonly<{
  accounts: readonly AccountSummary[]
  archivedAccounts: readonly AccountSummary[]
  onOpenAccount: (details: AccountFormDetails) => Promise<AccountOutcome>
}>) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const startOpening = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDialogOpen(true)
  }

  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault()
    if (opener.current?.isConnected === true) opener.current.focus()
    else heading.current?.focus()
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-12">
      <div className="flex items-end justify-between gap-4">
        <h1 ref={heading} tabIndex={-1} className="text-title outline-none">
          {m.accounts_title()}
        </h1>
        <Button
          className="hidden h-12 rounded-2xl px-5 text-base font-semibold shadow-sm md:inline-flex"
          onClick={startOpening}
        >
          <Plus aria-hidden />
          {m.open_account()}
        </Button>
      </div>

      {accounts.some((account) => account.role === "investment") && (
        <Link
          to="/investments"
          className="mt-6 flex items-center gap-4 rounded-2xl bg-card p-4 text-card-foreground shadow-sm transition-colors outline-ring hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-role-investment/15 text-role-investment">
            <PieChart className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{m.investments_overview()}</span>
            <span className="block text-sm text-muted-foreground">
              {m.investments_overview_hint()}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      {accounts.length > 0 ? (
        <AccountList accounts={accounts} />
      ) : archivedAccounts.length > 0 ? (
        <p className="py-10 text-center text-muted-foreground">{m.no_active_accounts()}</p>
      ) : (
        <EmptyAccounts onOpenAccount={startOpening} />
      )}

      {archivedAccounts.length > 0 && <ArchivedAccounts accounts={archivedAccounts} />}

      <Button
        aria-label={m.open_account()}
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-7"
        onClick={startOpening}
      >
        <Plus aria-hidden />
      </Button>

      <AccountDialog
        open={dialogOpen}
        mode={{ kind: "open" }}
        onOpenChange={setDialogOpen}
        onSubmit={onOpenAccount}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </main>
  )
}
