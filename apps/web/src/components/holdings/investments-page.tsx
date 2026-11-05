import type { AccountSummary, HoldingsBreakdown, StockSlice } from "@ballast/core"
import { defaultConcentrationLimit } from "@ballast/core"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, PieChart, TriangleAlert } from "lucide-react"
import { RoleDot } from "@/components/accounts/role-dot.tsx"
import { m } from "@/paraglide/messages.js"
import { formatShare } from "@/ui/account-terms.ts"
import { formatMoney } from "@/ui/format.ts"
import { HoldingsBreakdownView, ValuedBetween } from "./holdings-breakdown.tsx"

/**
 * All Investment across active Investment Accounts: its total market value,
 * Asset Mix, value per Index and per stock, any stocks above the
 * Concentration Limit, and each Investment Account's Valuation.
 */
export function InvestmentsPage({
  accounts,
  overall,
  concentrated,
}: Readonly<{
  accounts: readonly AccountSummary[]
  overall: HoldingsBreakdown
  concentrated: readonly StockSlice[]
}>) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-12">
      <Link
        to="/"
        className="-ml-1 inline-flex items-center gap-1 rounded-lg text-sm font-medium text-muted-foreground outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {m.accounts_title()}
      </Link>
      <h1 className="mt-3 text-title">{m.investments_title()}</h1>

      {overall.byAssetClass.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
            <PieChart className="size-7" aria-hidden />
          </div>
          <p className="mt-4 text-xl font-bold">{m.no_investments_title()}</p>
          <p className="mt-2 text-muted-foreground">{m.no_investments_body()}</p>
        </div>
      ) : (
        <>
          <section
            aria-labelledby="total-heading"
            className="mt-6 rounded-3xl bg-card p-5 shadow-sm"
          >
            <h2 id="total-heading" className="text-sm font-medium text-muted-foreground">
              {m.investments_total()}
            </h2>
            <p className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(overall.total)}</p>
            <ValuedBetween breakdown={overall} className="mt-1 text-xs text-muted-foreground" />
          </section>

          {concentrated.length > 0 && (
            <section
              aria-labelledby="concentrated-heading"
              className="mt-4 flex gap-3 rounded-3xl bg-destructive/10 p-5 text-sm"
            >
              <TriangleAlert className="size-5 shrink-0 text-destructive" aria-hidden />
              <div className="space-y-1">
                <h2 id="concentrated-heading" className="font-semibold text-destructive">
                  {m.concentrated_title()}
                </h2>
                {concentrated.map((stock) => (
                  <p key={`${stock.ticker ?? ""}:${stock.name}`}>
                    {m.concentrated_stock({
                      name: stock.name,
                      share: formatShare(stock.share),
                      limit: formatShare(defaultConcentrationLimit),
                    })}
                  </p>
                ))}
                <p className="text-muted-foreground">{m.concentrated_advice()}</p>
              </div>
            </section>
          )}

          <div className="mt-4 rounded-3xl bg-card p-5 shadow-sm">
            <HoldingsBreakdownView
              breakdown={overall}
              concentrated={concentrated}
              headingLevel="h2"
            />
          </div>
        </>
      )}

      {accounts.length > 0 && (
        <section aria-labelledby="investment-accounts-heading" className="mt-8">
          <h2 id="investment-accounts-heading" className="text-xl font-bold">
            {m.investment_accounts()}
          </h2>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {accounts.map((account) => (
              <li key={account.id}>
                <Link
                  to="/accounts/$accountId"
                  params={{ accountId: account.id }}
                  className="flex items-center gap-4 rounded-2xl bg-card p-4 text-card-foreground shadow-sm transition-colors outline-ring hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <RoleDot role={account.role} className="size-3" />
                  <p className="min-w-0 flex-1 truncate text-lg font-semibold">{account.name}</p>
                  <p className="shrink-0 text-lg font-semibold tabular-nums">
                    {formatMoney(account.valuation?.value ?? account.balance)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
