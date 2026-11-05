import { directionOf } from "@ballast/core"
import type { AccountSummary, Transaction } from "@ballast/core"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, Plus, ReceiptText } from "lucide-react"
import { useRef, useState } from "react"
import { RoleDot } from "@/components/accounts/role-dot.tsx"
import { Button } from "@/components/ui/button.tsx"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { accountRoleLabel } from "@/ui/account-role.ts"
import { formatDay, formatMoney } from "@/ui/format.ts"
import { TransactionDialog } from "./transaction-dialog.tsx"
import type {
  TransactionDialogMode,
  TransactionFormDetails,
  TransactionOutcome,
} from "./transaction-dialog.tsx"

/**
 * One Account: its balance, computed from its Transactions, and the
 * Transactions themselves, newest first. Manual Transactions can be edited
 * and deleted; the ways to add one mirror the Accounts page.
 */
export function AccountLedgerPage({
  account,
  transactions,
  onAdd,
  onEdit,
  onDelete,
}: Readonly<{
  account: AccountSummary
  transactions: readonly Transaction[]
  onAdd: (details: TransactionFormDetails) => Promise<TransactionOutcome>
  onEdit: (transaction: Transaction, details: TransactionFormDetails) => Promise<TransactionOutcome>
  onDelete: (transaction: Transaction) => Promise<void>
}>) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<TransactionDialogMode>({ kind: "add" })
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const openDialog = (next: TransactionDialogMode) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMode(next)
    setDialogOpen(true)
  }

  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault()
    if (opener.current?.isConnected === true) opener.current.focus()
    else heading.current?.focus()
  }

  const startAdding = () => {
    openDialog({ kind: "add" })
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-12">
      <Link
        to="/"
        className="-ml-1 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {m.accounts_title()}
      </Link>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 ref={heading} tabIndex={-1} className="truncate text-title outline-none">
            {account.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <RoleDot role={account.role} className="size-2.5" />
            {m.account_summary({
              role: accountRoleLabel(account.role),
              currency: account.currency,
            })}
          </p>
        </div>
        <Button
          className="hidden h-12 rounded-2xl px-5 text-base font-semibold shadow-sm md:inline-flex"
          onClick={startAdding}
        >
          <Plus aria-hidden />
          {m.add_transaction()}
        </Button>
      </div>

      <section aria-labelledby="balance-heading" className="mt-6 rounded-3xl bg-card p-5 shadow-sm">
        <h2 id="balance-heading" className="text-sm font-medium text-muted-foreground">
          {m.account_balance()}
        </h2>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(account.balance)}</p>
      </section>

      <section aria-labelledby="transactions-heading" className="mt-8">
        <h2 id="transactions-heading" className="sr-only">
          {m.account_transactions()}
        </h2>
        {transactions.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <ReceiptText className="size-7" aria-hidden />
            </div>
            <p className="mt-4 text-xl font-bold">{m.no_transactions_title()}</p>
            <p className="mt-2 text-muted-foreground">{m.no_transactions_body()}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-3xl bg-card shadow-sm">
            {transactions.map((transaction) => (
              <li key={transaction.id}>
                <TransactionRow
                  transaction={transaction}
                  onEdit={() => {
                    openDialog({ kind: "edit", transaction })
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button
        aria-label={m.add_transaction()}
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-7"
        onClick={startAdding}
      >
        <Plus aria-hidden />
      </Button>

      <TransactionDialog
        open={dialogOpen}
        mode={mode}
        onOpenChange={setDialogOpen}
        onSubmit={(details) =>
          mode.kind === "edit" ? onEdit(mode.transaction, details) : onAdd(details)
        }
        onDelete={onDelete}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </main>
  )
}

/** A Transaction line. Manual ones are marked and open for editing; imported ones don't. */
function TransactionRow({
  transaction,
  onEdit,
}: Readonly<{ transaction: Transaction; onEdit: () => void }>) {
  const manual = transaction.source === "manual"
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{transaction.description}</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          {formatDay(transaction.date)}
          {manual && (
            <span className="rounded-full bg-secondary px-2 text-xs leading-5 font-medium text-secondary-foreground">
              {m.source_manual()}
            </span>
          )}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 font-semibold tabular-nums",
          directionOf(transaction) === "inflow" && "text-primary",
        )}
      >
        {formatMoney(transaction.amount)}
      </p>
    </>
  )
  const rowClassName = "flex w-full items-center gap-4 px-5 py-4 text-left"

  return manual ? (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        rowClassName,
        "transition-colors outline-ring hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2",
      )}
    >
      {content}
    </button>
  ) : (
    <div className={rowClassName}>{content}</div>
  )
}
