import type { HoldingsBreakdown, Slice, StockSlice } from "@ballast/core"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { assetClassColour, assetClassLabel, formatShare } from "@/ui/account-terms.ts"
import { formatDay, formatMoney } from "@/ui/format.ts"

/** When the values behind a Valuation are from, e.g. "Values from 1 Oct 2026 to 3 Nov 2026". */
export function ValuedBetween({
  breakdown,
  className,
}: Readonly<{ breakdown: HoldingsBreakdown; className?: string }>) {
  const dates = breakdown.valuedBetween
  if (dates === null) return null
  return (
    <p className={className}>
      {dates.oldest.equals(dates.newest)
        ? m.valuation_on({ date: formatDay(dates.oldest) })
        : m.valuation_between({ oldest: formatDay(dates.oldest), newest: formatDay(dates.newest) })}
    </p>
  )
}

const noStocks: readonly StockSlice[] = []

/**
 * Where some Investment money is: the Asset Mix as a bar with its legend,
 * then the value per Index and per stock when there are any. Stocks in
 * `concentrated` (slices of this same breakdown) are marked.
 */
export function HoldingsBreakdownView({
  breakdown,
  concentrated = noStocks,
  headingLevel: Heading = "h3",
}: Readonly<{
  breakdown: HoldingsBreakdown
  /** The stocks above the Concentration Limit. */
  concentrated?: readonly StockSlice[]
  headingLevel?: "h2" | "h3"
}>) {
  return (
    <div className="space-y-6">
      <section aria-label={m.asset_mix()}>
        <Heading className="text-sm font-medium text-muted-foreground">{m.asset_mix()}</Heading>
        <div aria-hidden className="mt-3 flex h-3 overflow-hidden rounded-full bg-secondary">
          {breakdown.byAssetClass.map((slice) => (
            <div
              key={slice.assetClass}
              className={assetClassColour[slice.assetClass]}
              style={{ width: `${slice.share.basisPoints / 100}%` }}
            />
          ))}
        </div>
        <SliceList>
          {breakdown.byAssetClass.map((slice) => (
            <SliceRow
              key={slice.assetClass}
              slice={slice}
              label={
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-full", assetClassColour[slice.assetClass])}
                  />
                  {assetClassLabel(slice.assetClass)}
                </span>
              }
            />
          ))}
        </SliceList>
      </section>

      {breakdown.byIndex.length > 0 && (
        <section aria-label={m.by_index()}>
          <Heading className="text-sm font-medium text-muted-foreground">{m.by_index()}</Heading>
          <SliceList>
            {breakdown.byIndex.map((slice) => (
              <SliceRow key={slice.index} slice={slice} label={slice.index} />
            ))}
          </SliceList>
        </section>
      )}

      {breakdown.byStock.length > 0 && (
        <section aria-label={m.by_stock()}>
          <Heading className="text-sm font-medium text-muted-foreground">{m.by_stock()}</Heading>
          <SliceList>
            {breakdown.byStock.map((slice) => (
              <SliceRow
                key={`${slice.ticker ?? ""}:${slice.name}`}
                slice={slice}
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    {slice.name}
                    {slice.ticker !== null && (
                      <span className="text-xs text-muted-foreground">{slice.ticker}</span>
                    )}
                    {concentrated.includes(slice) && (
                      <span className="rounded-full bg-destructive/10 px-2 text-xs leading-5 font-medium text-destructive">
                        {m.concentrated_badge()}
                      </span>
                    )}
                  </span>
                }
              />
            ))}
          </SliceList>
        </section>
      )}
    </div>
  )
}

function SliceList({ children }: Readonly<{ children: ReactNode }>) {
  return <ul className="mt-3 divide-y divide-border">{children}</ul>
}

function SliceRow({ slice, label }: Readonly<{ slice: Slice; label: ReactNode }>) {
  return (
    <li className="flex items-center gap-4 py-2.5">
      <div className="min-w-0 flex-1 font-medium">{label}</div>
      <p className="shrink-0 text-right tabular-nums">
        <span className="font-semibold">{formatShare(slice.share)}</span>
        <span className="ml-3 text-sm text-muted-foreground">{formatMoney(slice.value)}</span>
      </p>
    </li>
  )
}
