import { amountOwed, marketGain, netContributions } from "@ballast/core"
import type { AccountSummary, Money } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

/** One headline amount about an Account, with what it means. */
export interface AccountFigure {
  readonly key: "valuation" | "net_contributions" | "market_gain" | "owed" | "balance"
  readonly label: string
  readonly value: Money.Money
}

/**
 * The amounts that describe an Account, most telling first: an Investment's
 * Valuation, Net Contributions and Market Gain; what a Liability owes; any
 * other Account's balance.
 */
export const accountFigures = (account: AccountSummary): readonly AccountFigure[] => {
  const owed = amountOwed(account)
  if (owed !== null) return [{ key: "owed", label: m.amount_owed(), value: owed }]
  const contributions = netContributions(account)
  if (contributions === null) {
    return [{ key: "balance", label: m.account_balance(), value: account.balance }]
  }
  const gain = marketGain(account)
  return [
    ...(account.valuation === null
      ? []
      : [{ key: "valuation" as const, label: m.valuation(), value: account.valuation.value }]),
    { key: "net_contributions", label: m.net_contributions(), value: contributions },
    ...(gain === null
      ? []
      : [{ key: "market_gain" as const, label: m.market_gain(), value: gain }]),
  ]
}
