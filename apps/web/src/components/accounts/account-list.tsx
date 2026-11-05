import { accountRoles } from "@ballast/core"
import type { AccountSummary } from "@ballast/core"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"
import { accountsWithRole, countByRole } from "@/ui/account-filter.ts"
import type { RoleFilter } from "@/ui/account-filter.ts"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { accountRoleLabel } from "@/ui/account-role.ts"
import { formatMoney } from "@/ui/format.ts"
import { AccountSummaryLine } from "./account-summary-line.tsx"
import { RoleDot } from "./role-dot.tsx"

export function AccountList({ accounts }: Readonly<{ accounts: readonly AccountSummary[] }>) {
  const [filter, setFilter] = useState<RoleFilter>("all")
  const counts = countByRole(accounts)
  const shown = accountsWithRole(accounts, filter)

  return (
    <section aria-labelledby="accounts-heading">
      <h2 id="accounts-heading" className="sr-only">
        {m.your_accounts()}
      </h2>

      <fieldset className="-mx-5 mt-6 flex min-w-0 gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <legend className="sr-only">{m.filter_by_role()}</legend>
        <Chip
          pressed={filter === "all"}
          onPress={() => {
            setFilter("all")
          }}
        >
          {m.filter_all({ count: accounts.length })}
        </Chip>
        {accountRoles.map((role) => (
          <Chip
            key={role}
            pressed={filter === role}
            onPress={() => {
              setFilter(role)
            }}
          >
            <RoleDot role={role} className="size-2" />
            {m.filter_role({ role: accountRoleLabel(role), count: counts[role] })}
          </Chip>
        ))}
      </fieldset>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{m.no_accounts_with_role()}</p>
      ) : (
        <AccountCards accounts={shown} />
      )}
    </section>
  )
}

/**
 * The archived Accounts, behind a toggle that says how many there are. They
 * keep their history and can be opened like any other Account.
 */
export function ArchivedAccounts({ accounts }: Readonly<{ accounts: readonly AccountSummary[] }>) {
  const [shown, setShown] = useState(false)
  return (
    <section aria-label={m.archived_accounts()} className="mt-10">
      <button
        type="button"
        aria-expanded={shown}
        aria-controls="archived-accounts"
        onClick={() => {
          setShown(!shown)
        }}
        className="flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronRight
          aria-hidden
          className={cn("size-4 transition-transform", shown && "rotate-90")}
        />
        {m.show_archived_accounts({ count: accounts.length })}
      </button>
      <div id="archived-accounts" hidden={!shown}>
        <AccountCards accounts={accounts} />
      </div>
    </section>
  )
}

function AccountCards({ accounts }: Readonly<{ accounts: readonly AccountSummary[] }>) {
  return (
    <ul className="mt-6 grid gap-3 lg:grid-cols-2">
      {accounts.map((account) => (
        <li key={account.id}>
          <Link
            to="/accounts/$accountId"
            params={{ accountId: account.id }}
            className={cn(
              "flex items-center gap-4 rounded-2xl bg-card p-4 text-card-foreground shadow-sm transition-colors outline-ring hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2",
              account.archived && "text-muted-foreground",
            )}
          >
            <RoleDot role={account.role} className="size-3" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{account.name}</p>
              <AccountSummaryLine account={account} className="text-sm text-muted-foreground" />
            </div>
            <p className="shrink-0 text-lg font-semibold tabular-nums">
              {formatMoney(account.balance)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Chip({
  pressed,
  onPress,
  children,
}: Readonly<{ pressed: boolean; onPress: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className="flex shrink-0 items-center gap-2 rounded-full border border-input px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-ring hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
    >
      {children}
    </button>
  )
}
