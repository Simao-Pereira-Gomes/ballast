import type { Account } from "@ballast/core"
import { Plus } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { m } from "@/paraglide/messages.js"
import { AccountList } from "./account-list.tsx"
import { EmptyAccounts } from "./empty-accounts.tsx"
import { OpenAccountDialog } from "./open-account-dialog.tsx"
import type { OpenAccountDetails, OpenAccountOutcome } from "./open-account-dialog.tsx"

/**
 * The Accounts page: cards with role filters, or the empty state, and the
 * ways to open an Account (header button on larger screens, floating button
 * on phones).
 */
export function AccountsPage({
  accounts,
  onOpenAccount,
}: Readonly<{
  accounts: readonly Account[]
  onOpenAccount: (details: OpenAccountDetails) => Promise<OpenAccountOutcome>
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

      {accounts.length === 0 ? (
        <EmptyAccounts onOpenAccount={startOpening} />
      ) : (
        <AccountList accounts={accounts} />
      )}

      <Button
        aria-label={m.open_account()}
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-7"
        onClick={startOpening}
      >
        <Plus aria-hidden />
      </Button>

      <OpenAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={onOpenAccount}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </main>
  )
}
