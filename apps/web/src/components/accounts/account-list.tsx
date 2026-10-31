import type { Account } from "@ballast/core"
import { useState } from "react"
import type { ReactNode } from "react"
import { accountsWithRole, countByRole } from "@/ui/account-filter.ts"
import type { RoleFilter } from "@/ui/account-filter.ts"
import { m } from "@/paraglide/messages.js"
import { accountRoleLabel, accountRoles } from "@/ui/account-role.ts"
import { RoleDot } from "./role-dot.tsx"

export function AccountList({ accounts }: Readonly<{ accounts: readonly Account[] }>) {
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
          {m.filter_all()} · {accounts.length}
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
            {accountRoleLabel(role)} · {counts[role]}
          </Chip>
        ))}
      </fieldset>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{m.no_accounts_with_role()}</p>
      ) : (
        <ul className="mt-6 grid gap-3 lg:grid-cols-2">
          {shown.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-4 rounded-2xl bg-card p-4 text-card-foreground shadow-sm"
            >
              <RoleDot role={account.role} className="size-3" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{account.name}</p>
                <p className="text-sm text-muted-foreground">
                  {accountRoleLabel(account.role)} · {account.currency}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
