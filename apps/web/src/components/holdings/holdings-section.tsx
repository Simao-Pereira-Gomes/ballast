import { breakdown, holdingName } from "@ballast/core"
import type { Holding, HoldingKind } from "@ballast/core"
import { Plus, Shapes } from "lucide-react"
import { CompactEmpty } from "@/components/shell/compact-empty.tsx"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { assetClassColour, assetClassLabel, formatUnits } from "@/ui/account-terms.ts"
import { formatDay, formatMoney } from "@/ui/format.ts"
import { HoldingDialog } from "./holding-dialog.tsx"
import type {
  HoldingDialogMode,
  HoldingFormDetails,
  HoldingOutcome,
  RemoveOutcome,
} from "./holding-dialog.tsx"
import { HoldingsBreakdownView, ValuedBetween } from "./holdings-breakdown.tsx"

const kindLabel: Record<HoldingKind, () => string> = {
  index_fund: m.holding_kind_index_fund,
  stock: m.holding_kind_stock,
  other: m.holding_kind_other,
}

/**
 * An Investment Account's Holdings: its Valuation and Asset Mix computed
 * from them, the value per Index and per stock, and the Holdings
 * themselves, which open for editing.
 */
export function HoldingsSection({
  holdings,
  onAdd,
  onChange,
  onRemove,
}: Readonly<{
  holdings: readonly Holding[]
  onAdd: (details: HoldingFormDetails) => Promise<HoldingOutcome>
  onChange: (holding: Holding, details: HoldingFormDetails) => Promise<HoldingOutcome>
  onRemove: (holding: Holding) => Promise<RemoveOutcome>
}>) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<HoldingDialogMode>({ kind: "add" })
  const [alreadyGone, setAlreadyGone] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const summary = breakdown(holdings)
  const knownIndexes = summary.byIndex.map((slice) => slice.index)

  const openDialog = (next: HoldingDialogMode) => {
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

  return (
    <section aria-labelledby="holdings-heading" className="mt-8">
      <div className="flex items-end justify-between gap-4">
        <h2
          id="holdings-heading"
          ref={heading}
          tabIndex={-1}
          className="text-xl font-bold outline-none"
        >
          {m.holdings()}
        </h2>
        <Button
          variant="secondary"
          className="h-10 rounded-xl"
          onClick={() => {
            openDialog({ kind: "add" })
          }}
        >
          <Plus aria-hidden />
          {m.add_holding()}
        </Button>
      </div>

      <output className="block">
        {alreadyGone && (
          <p className="mt-4 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground">
            {m.holding_already_removed()}
          </p>
        )}
      </output>

      {holdings.length === 0 ? (
        <div className="mt-4">
          <CompactEmpty
            icon={<Shapes className="size-5" aria-hidden />}
            title={m.no_holdings_title()}
            body={m.no_holdings_body()}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ul className="divide-y divide-border self-start overflow-hidden rounded-3xl bg-card shadow-sm">
            {holdings.map((holding) => (
              <li key={holding.id}>
                <HoldingRow
                  holding={holding}
                  onEdit={() => {
                    openDialog({ kind: "edit", holding })
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="self-start rounded-3xl bg-card p-5 shadow-sm">
            <HoldingsBreakdownView breakdown={summary} />
            <ValuedBetween breakdown={summary} className="mt-4 text-xs text-muted-foreground" />
          </div>
        </div>
      )}

      <HoldingDialog
        open={dialogOpen}
        mode={mode}
        knownIndexes={knownIndexes}
        onOpenChange={setDialogOpen}
        onSubmit={(details) =>
          mode.kind === "edit" ? onChange(mode.holding, details) : onAdd(details)
        }
        onRemove={onRemove}
        onGone={() => {
          setAlreadyGone(true)
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </section>
  )
}

/** A Holding line: what it is and what it's worth, opening for editing. */
function HoldingRow({ holding, onEdit }: Readonly<{ holding: Holding; onEdit: () => void }>) {
  const details = [
    kindLabel[holding.kind](),
    // An unnamed index fund is already called by its Index.
    holding.name === null ? null : holding.index,
    holding.ticker,
    holding.units === null ? null : m.holding_units_summary({ units: formatUnits(holding.units) }),
  ].filter((part) => part !== null)
  const content = (
    <>
      <span
        aria-hidden
        className={cn("size-2.5 shrink-0 rounded-full", assetClassColour[holding.assetClass])}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{holdingName(holding)}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {assetClassLabel(holding.assetClass)} · {details.join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatMoney(holding.value)}</p>
        <p className="text-xs text-muted-foreground">{formatDay(holding.valuedOn)}</p>
      </div>
    </>
  )
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors outline-ring hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      {content}
    </button>
  )
}
