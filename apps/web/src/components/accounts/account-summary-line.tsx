import type { Account } from "@ballast/core"
import { m } from "@/paraglide/messages.js"
import { accountRoleLabel } from "@/ui/account-role.ts"
import { assetMixSummary, formatInterestRate } from "@/ui/account-terms.ts"

/**
 * What an Account is: its Role and currency, then its terms when it has
 * them (a Liability's rate, an Investment's asset-class mix), and whether
 * it is archived.
 */
export function AccountSummaryLine({
  account,
  className,
}: Readonly<{ account: Account; className?: string }>) {
  const parts: string[] = [
    m.account_summary({ role: accountRoleLabel(account.role), currency: account.currency }),
  ]
  if (account.interestRate !== null) {
    parts.push(m.interest_rate_summary({ rate: formatInterestRate(account.interestRate) }))
  }
  if (account.assetMix !== null) parts.push(assetMixSummary(account.assetMix))
  return (
    <p className={className}>
      {parts.join(" · ")}
      {account.archived && (
        <span className="ml-2 rounded-full bg-secondary px-2 text-xs leading-5 font-medium text-secondary-foreground">
          {m.archived_badge()}
        </span>
      )}
    </p>
  )
}
