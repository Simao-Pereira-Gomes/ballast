import { directionOf } from "@ballast/core"
import type { AccountSummary, Holding, Transaction } from "@ballast/core"
import { Link } from "@tanstack/react-router"
import { Archive, ChevronLeft, Pencil, Plus, ReceiptText } from "lucide-react"
import { useRef, useState } from "react"
import { AccountDialog } from "@/components/accounts/account-dialog.tsx"
import type { AccountFormDetails, AccountOutcome } from "@/components/accounts/account-dialog.tsx"
import { AccountSummaryLine } from "@/components/accounts/account-summary-line.tsx"
import { RoleDot } from "@/components/accounts/role-dot.tsx"
import type {
  HoldingFormDetails,
  HoldingOutcome,
  RemoveOutcome,
} from "@/components/holdings/holding-dialog.tsx"
import { HoldingsSection } from "@/components/holdings/holdings-section.tsx"
import { CompactEmpty } from "@/components/shell/compact-empty.tsx"
import { Button } from "@/components/ui/button.tsx"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { accountFigures } from "@/ui/account-figures.ts"
import { transactionTerms } from "@/ui/transaction-terms.ts"
import { formatDay, formatMoney } from "@/ui/format.ts"
import { TransactionDialog } from "./transaction-dialog.tsx"
import type {
  DeleteOutcome,
  TransactionDialogMode,
  TransactionFormDetails,
  TransactionOutcome,
} from "./transaction-dialog.tsx"

/**
 * One Account: its balance, computed from its Transactions, and the
 * Transactions themselves, newest first. Manual Transactions can be edited
 * and deleted; the ways to add one mirror the Accounts page. An Investment
 * also shows its Valuation and Holdings. The Account itself can be edited
 * and archived, and an archived one unarchived.
 */
export function AccountLedgerPage({
  account,
  transactions,
  holdings,
  onAdd,
  onEdit,
  onDelete,
  onAddHolding,
  onChangeHolding,
  onRemoveHolding,
  onChangeAccount,
  onArchive,
  onUnarchive,
}: Readonly<{
  account: AccountSummary
  transactions: readonly Transaction[]
  holdings: readonly Holding[]
  onAddHolding: (details: HoldingFormDetails) => Promise<HoldingOutcome>
  onChangeHolding: (holding: Holding, details: HoldingFormDetails) => Promise<HoldingOutcome>
  onRemoveHolding: (holding: Holding) => Promise<RemoveOutcome>
  onAdd: (details: TransactionFormDetails) => Promise<TransactionOutcome>
  onEdit: (transaction: Transaction, details: TransactionFormDetails) => Promise<TransactionOutcome>
  onDelete: (transaction: Transaction) => Promise<DeleteOutcome>
  onChangeAccount: (details: AccountFormDetails) => Promise<AccountOutcome>
  onArchive: () => Promise<void>
  onUnarchive: () => Promise<void>
}>) {
  // Holdings only exist on Investments: the database won't let an Account with Holdings change Role.
  const investment = account.role === "investment"
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [unarchiving, setUnarchiving] = useState(false)
  const [mode, setMode] = useState<TransactionDialogMode>({ kind: "add" })
  const [alreadyGone, setAlreadyGone] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  const openDialog = (next: TransactionDialogMode) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMode(next)
    setAlreadyGone(false)
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

  const startEditingAccount = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setAccountDialogOpen(true)
  }

  const unarchive = async () => {
    setUnarchiving(true)
    try {
      await onUnarchive()
    } finally {
      setUnarchiving(false)
    }
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
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <RoleDot role={account.role} className="size-2.5" />
            <AccountSummaryLine account={account} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            aria-label={m.edit_account()}
            className="size-12 rounded-2xl"
            onClick={startEditingAccount}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            className="hidden h-12 rounded-2xl px-5 text-base font-semibold shadow-sm md:inline-flex"
            onClick={startAdding}
          >
            <Plus aria-hidden />
            {m.add_transaction()}
          </Button>
        </div>
      </div>

      {account.archived && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground">
          <Archive className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{m.account_archived_notice()}</p>
          <Button
            variant="outline"
            disabled={unarchiving}
            className="h-10 rounded-xl"
            onClick={() => void unarchive()}
          >
            {unarchiving ? m.unarchiving_account() : m.unarchive_account()}
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {accountFigures(account).map((figure) => (
          <section
            key={figure.key}
            aria-labelledby={`${figure.key}-heading`}
            className="rounded-3xl bg-card p-5 shadow-sm"
          >
            <h2 id={`${figure.key}-heading`} className="text-sm font-medium text-muted-foreground">
              {figure.label}
            </h2>
            <p className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(figure.value)}</p>
          </section>
        ))}
      </div>

      {investment && (
        <HoldingsSection
          holdings={holdings}
          onAdd={onAddHolding}
          onChange={onChangeHolding}
          onRemove={onRemoveHolding}
        />
      )}

      <section aria-labelledby="transactions-heading" className="mt-8">
        {/* Beside Holdings the section needs a visible heading; alone, the page title is enough. */}
        {investment ? (
          <h2 id="transactions-heading" className="mb-4 text-xl font-bold">
            {m.transactions_heading()}
          </h2>
        ) : (
          <h2 id="transactions-heading" className="sr-only">
            {m.account_transactions()}
          </h2>
        )}
        <output className="block">
          {alreadyGone && (
            <p className="mb-4 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground">
              {m.transaction_already_deleted()}
            </p>
          )}
        </output>
        {transactions.length === 0 && investment ? (
          <CompactEmpty
            icon={<ReceiptText className="size-5" aria-hidden />}
            title={m.no_transactions_title()}
            body={transactionTerms(account.role).emptyBody()}
          />
        ) : transactions.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
              <ReceiptText className="size-7" aria-hidden />
            </div>
            <p className="mt-4 text-xl font-bold">{m.no_transactions_title()}</p>
            <p className="mt-2 text-muted-foreground">
              {transactionTerms(account.role).emptyBody()}
            </p>
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
        role={account.role}
        mode={mode}
        onOpenChange={setDialogOpen}
        onSubmit={(details) =>
          mode.kind === "edit" ? onEdit(mode.transaction, details) : onAdd(details)
        }
        onDelete={onDelete}
        onGone={() => {
          setAlreadyGone(true)
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      />

      <AccountDialog
        open={accountDialogOpen}
        mode={{ kind: "edit", account, onArchive }}
        onOpenChange={setAccountDialogOpen}
        onSubmit={onChangeAccount}
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
