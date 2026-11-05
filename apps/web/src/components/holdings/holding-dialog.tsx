import { assetClasses, holdingKinds } from "@ballast/core"
import type { AssetClass, Holding, HoldingKind, HoldingProblem } from "@ballast/core"
import { useRef, useState } from "react"
import type { SubmitEvent } from "react"
import { sheetContentClassName, sheetHandleClassName } from "@/components/shell/sheet.ts"
import { Button } from "@/components/ui/button.tsx"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import {
  assetClassColour,
  assetClassDescription,
  assetClassLabel,
  unitsForInput,
} from "@/ui/account-terms.ts"
import { amountForInput } from "@/ui/format.ts"
import { holdingProblemMessage } from "@/ui/holding-problems.ts"

/** What the Holding form submits, as typed. The core checks it. */
export interface HoldingFormDetails {
  readonly kind: string
  readonly name: string
  readonly ticker: string
  readonly index: string
  readonly assetClass: string
  readonly units: string
  readonly value: string
  readonly valuedOn: string
}

/** A Holding can vanish while its dialog is open, e.g. removed in another tab. */
type Gone = { readonly ok: false; readonly reason: "gone" }

export type HoldingOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid"; readonly problems: readonly HoldingProblem[] }
  | Gone

export type RemoveOutcome = { readonly ok: true } | Gone

/** What the dialog is for: a new Holding, or changing one. */
export type HoldingDialogMode =
  { readonly kind: "add" } | { readonly kind: "edit"; readonly holding: Holding }

const kindLabel: Record<HoldingKind, () => string> = {
  index_fund: m.holding_kind_index_fund,
  stock: m.holding_kind_stock,
  other: m.holding_kind_other,
}

const kindDescription: Record<HoldingKind, () => string> = {
  index_fund: m.holding_kind_index_fund_description,
  stock: m.holding_kind_stock_description,
  other: m.holding_kind_other_description,
}

/**
 * Adding or editing a Holding: a bottom sheet on phones, a centred dialog
 * on larger screens. Editing also offers a two-step remove.
 */
export function HoldingDialog({
  open,
  mode,
  knownIndexes,
  onOpenChange,
  onSubmit,
  onRemove,
  onGone,
  onCloseAutoFocus,
}: Readonly<{
  open: boolean
  /** Kept while the dialog closes, so its content doesn't change mid-animation. */
  mode: HoldingDialogMode
  /** Indexes the Owner already holds, offered as suggestions so they add up together. */
  knownIndexes: readonly string[]
  onOpenChange: (open: boolean) => void
  onSubmit: (details: HoldingFormDetails) => Promise<HoldingOutcome>
  onRemove: (holding: Holding) => Promise<RemoveOutcome>
  onGone: () => void
  onCloseAutoFocus?: (event: Event) => void
}>) {
  const editing = mode.kind === "edit"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
        closeLabel={m.close()}
        className={sheetContentClassName}
      >
        <div aria-hidden className={sheetHandleClassName} />
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-bold">
            {editing ? m.edit_holding_title() : m.add_holding_title()}
          </DialogTitle>
          <DialogDescription>
            {editing ? m.edit_holding_description() : m.add_holding_description()}
          </DialogDescription>
        </DialogHeader>
        <HoldingForm
          key={editing ? mode.holding.id : "add"}
          mode={mode}
          knownIndexes={knownIndexes}
          onSubmit={onSubmit}
          onRemove={onRemove}
          onDone={(gone) => {
            if (gone) onGone()
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

const textField = (fields: FormData, name: string): string => {
  const value = fields.get(name)
  return typeof value === "string" ? value : ""
}

const fieldClassName = "h-12 rounded-2xl bg-secondary px-4 text-base md:text-base dark:bg-secondary"

const choiceClassName = cn(
  "relative cursor-pointer rounded-2xl border-2 border-transparent bg-secondary p-3 transition-colors",
  "has-checked:border-primary has-checked:bg-primary/10",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
)

const radioClassName = "absolute inset-0 cursor-pointer appearance-none rounded-2xl opacity-0"

/** Mounted only while the dialog is open, so each opening starts from its Holding. */
function HoldingForm({
  mode,
  knownIndexes,
  onSubmit,
  onRemove,
  onDone,
}: Readonly<{
  mode: HoldingDialogMode
  knownIndexes: readonly string[]
  onSubmit: (details: HoldingFormDetails) => Promise<HoldingOutcome>
  onRemove: (holding: Holding) => Promise<RemoveOutcome>
  onDone: (gone: boolean) => void
}>) {
  const existing = mode.kind === "edit" ? mode.holding : undefined
  // A new Holding starts as the most common case, an equity index fund.
  const [kind, setKind] = useState<HoldingKind>(existing?.kind ?? "index_fund")
  const [assetClass, setAssetClass] = useState<AssetClass>(existing?.assetClass ?? "equity")
  const [problems, setProblems] = useState<readonly HoldingProblem[]>([])
  const [busy, setBusy] = useState<"saving" | "removing" | undefined>()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const kindRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const indexRef = useRef<HTMLInputElement>(null)
  const assetClassRef = useRef<HTMLInputElement>(null)
  const tickerRef = useRef<HTMLInputElement>(null)
  const unitsRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)
  const valuedOnRef = useRef<HTMLInputElement>(null)

  const problemFor = (field: HoldingProblem["field"]) =>
    problems.find((problem) => problem.field === field)
  const describedBy = (field: HoldingProblem["field"]) =>
    problemFor(field) ? `holding-${field}-problem` : undefined
  const problemText = (field: HoldingProblem["field"]) => {
    const problem = problemFor(field)
    return (
      problem && (
        <p id={`holding-${field}-problem`} className="text-sm text-destructive">
          {holdingProblemMessage(problem)}
        </p>
      )
    )
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy("saving")
    try {
      const outcome = await onSubmit({
        kind: textField(fields, "kind"),
        name: textField(fields, "name"),
        ticker: textField(fields, "ticker"),
        index: textField(fields, "index"),
        assetClass: textField(fields, "assetClass"),
        units: textField(fields, "units"),
        value: textField(fields, "value"),
        valuedOn: textField(fields, "valuedOn"),
      })
      if (outcome.ok || outcome.reason === "gone") {
        onDone(!outcome.ok)
        return
      }
      setProblems(outcome.problems)
      // Take the Owner to the first thing to fix, in the order the form shows them.
      const invalid = new Set(outcome.problems.map((problem) => problem.field))
      const first = [
        ["kind", kindRef],
        ["name", nameRef],
        ["index", indexRef],
        ["assetClass", assetClassRef],
        ["value", valueRef],
        ["valuedOn", valuedOnRef],
        ["ticker", tickerRef],
        ["units", unitsRef],
      ] as const
      first.find(([field]) => invalid.has(field))?.[1].current?.focus()
    } finally {
      setBusy(undefined)
    }
  }

  async function handleRemove(holding: Holding) {
    setBusy("removing")
    try {
      const outcome = await onRemove(holding)
      onDone(!outcome.ok)
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
      <fieldset aria-describedby={describedBy("kind")}>
        <legend className="text-sm font-medium">{m.holding_kind()}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {holdingKinds.map((choice, index) => (
            <label key={choice} className={choiceClassName}>
              <input
                ref={index === 0 ? kindRef : undefined}
                type="radio"
                name="kind"
                value={choice}
                checked={kind === choice}
                onChange={() => {
                  setKind(choice)
                }}
                aria-describedby={`holding-kind-${choice}-description`}
                className={radioClassName}
              />
              <span className="block font-semibold">{kindLabel[choice]()}</span>
              <span
                id={`holding-kind-${choice}-description`}
                className="mt-0.5 block text-xs text-muted-foreground"
              >
                {kindDescription[choice]()}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-2">{problemText("kind")}</div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="holding-name">{m.holding_name()}</Label>
        <Input
          ref={nameRef}
          id="holding-name"
          name="name"
          autoComplete="off"
          defaultValue={existing?.name ?? ""}
          placeholder={m.holding_name_placeholder()}
          aria-invalid={problemFor("name") !== undefined}
          aria-describedby={cn(
            kind === "index_fund" ? "holding-name-hint" : undefined,
            describedBy("name"),
          )}
          className={fieldClassName}
        />
        {kind === "index_fund" && (
          <p id="holding-name-hint" className="text-xs text-muted-foreground">
            {m.holding_name_optional_hint()}
          </p>
        )}
        {problemText("name")}
      </div>

      {kind === "index_fund" && (
        <div className="space-y-2">
          <Label htmlFor="holding-index">{m.holding_index()}</Label>
          <Input
            ref={indexRef}
            id="holding-index"
            name="index"
            autoComplete="off"
            list="holding-known-indexes"
            defaultValue={existing?.index ?? ""}
            placeholder={m.holding_index_placeholder()}
            aria-invalid={problemFor("index") !== undefined}
            aria-describedby={describedBy("index")}
            className={fieldClassName}
          />
          <datalist id="holding-known-indexes">
            {knownIndexes.map((index) => (
              <option key={index} value={index}>
                {index}
              </option>
            ))}
          </datalist>
          {problemText("index")}
        </div>
      )}

      {kind === "stock" && (
        <p className="text-sm text-muted-foreground">{m.holding_stock_is_equity()}</p>
      )}
      {(kind === "index_fund" || kind === "other") && (
        <fieldset aria-describedby={describedBy("assetClass")}>
          <legend className="text-sm font-medium">{m.holding_asset_class()}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {assetClasses.map((choice, index) => (
              <label key={choice} className={choiceClassName}>
                <input
                  ref={index === 0 ? assetClassRef : undefined}
                  type="radio"
                  name="assetClass"
                  value={choice}
                  checked={assetClass === choice}
                  onChange={() => {
                    setAssetClass(choice)
                  }}
                  aria-describedby={`holding-class-${choice}-description`}
                  className={radioClassName}
                />
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden
                    className={cn("size-2.5 rounded-full", assetClassColour[choice])}
                  />
                  {assetClassLabel(choice)}
                </span>
                <span
                  id={`holding-class-${choice}-description`}
                  className="mt-0.5 block text-xs text-muted-foreground"
                >
                  {assetClassDescription(kind, choice)}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2">{problemText("assetClass")}</div>
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="holding-value">{m.holding_value()}</Label>
          <Input
            ref={valueRef}
            id="holding-value"
            name="value"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={existing === undefined ? "" : amountForInput(existing.value)}
            placeholder={m.holding_value_placeholder()}
            aria-invalid={problemFor("value") !== undefined}
            aria-describedby={describedBy("value")}
            className={fieldClassName}
          />
          {problemText("value")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="holding-valued-on">{m.holding_valued_on()}</Label>
          <Input
            ref={valuedOnRef}
            id="holding-valued-on"
            name="valuedOn"
            type="date"
            defaultValue={(existing?.valuedOn ?? Temporal.Now.plainDateISO()).toString()}
            aria-invalid={problemFor("valuedOn") !== undefined}
            aria-describedby={describedBy("valuedOn")}
            className={fieldClassName}
          />
          {problemText("valuedOn")}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="holding-ticker">{m.holding_ticker()}</Label>
          <Input
            ref={tickerRef}
            id="holding-ticker"
            name="ticker"
            autoComplete="off"
            autoCapitalize="characters"
            defaultValue={existing?.ticker ?? ""}
            placeholder={m.holding_ticker_placeholder()}
            aria-invalid={problemFor("ticker") !== undefined}
            aria-describedby={cn("holding-ticker-hint", describedBy("ticker"))}
            className={fieldClassName}
          />
          <p id="holding-ticker-hint" className="text-xs text-muted-foreground">
            {m.holding_ticker_hint()}
          </p>
          {problemText("ticker")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="holding-units">{m.holding_units()}</Label>
          <Input
            ref={unitsRef}
            id="holding-units"
            name="units"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={existing?.units ? unitsForInput(existing.units) : ""}
            placeholder={m.holding_units_placeholder()}
            aria-invalid={problemFor("units") !== undefined}
            aria-describedby={cn("holding-units-hint", describedBy("units"))}
            className={fieldClassName}
          />
          <p id="holding-units-hint" className="text-xs text-muted-foreground">
            {m.holding_units_hint()}
          </p>
          {problemText("units")}
        </div>
      </div>

      <div className="flex gap-3">
        <DialogClose asChild>
          <Button type="button" variant="secondary" className="h-12 flex-1 rounded-2xl text-base">
            {m.cancel()}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={busy !== undefined}
          className="h-12 flex-1 rounded-2xl text-base font-semibold"
        >
          {busy === "saving" ? m.saving_holding() : m.save_holding()}
        </Button>
      </div>

      {existing && (
        <div className="border-t border-border pt-4">
          {confirmingRemove ? (
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== undefined}
              className="h-12 w-full rounded-2xl text-base font-semibold"
              onClick={() => void handleRemove(existing)}
            >
              {busy === "removing" ? m.removing_holding() : m.confirm_remove_holding()}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full rounded-2xl text-base text-destructive hover:text-destructive"
              onClick={() => {
                setConfirmingRemove(true)
              }}
            >
              {m.remove_holding()}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
