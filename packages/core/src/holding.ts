import { Data, Order, Result, Schema } from "effect"
import type { AccountId } from "./account.ts"
import * as Money from "./money.ts"
import type { OwnerId } from "./owner.ts"
import * as Share from "./share.ts"
import * as Units from "./units.ts"

export const HoldingId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("HoldingId"))
export type HoldingId = typeof HoldingId.Type

/** What an Investment's money is invested in. */
export const AssetClass = Schema.Literals(["equity", "bonds", "cash", "crypto", "other"])
export type AssetClass = typeof AssetClass.Type

export const assetClasses: readonly AssetClass[] = AssetClass.literals

/**
 * What a Holding is: a fund or ETF tracking a named Index, an individual
 * stock (always equity), or anything else (a crypto-asset, a bond, an
 * actively managed fund).
 */
export const HoldingKind = Schema.Literals(["index_fund", "stock", "other"])
export type HoldingKind = typeof HoldingKind.Type

export const holdingKinds: readonly HoldingKind[] = HoldingKind.literals

/** What the Owner records about a Holding, once checked. */
export interface HoldingDetails {
  readonly kind: HoldingKind
  /**
   * The product's own name. Optional for an index fund, which is then
   * called by its Index (`holdingName`); required for every other kind.
   */
  readonly name: string | null
  /** The exchange ticker, upper case, e.g. "VWCE" or "BTC-EUR". For a later market data feed. */
  readonly ticker: string | null
  /** The Index an index fund tracks; `null` for every other kind. */
  readonly index: string | null
  readonly assetClass: AssetClass
  /** How many units are held. For a later market data feed. */
  readonly units: Units.Units | null
  /** What the Holding is worth, as of `valuedOn`. */
  readonly value: Money.Money
  readonly valuedOn: Temporal.PlainDate
}

export interface Holding extends HoldingDetails {
  readonly id: HoldingId
  readonly ownerId: OwnerId
  readonly accountId: AccountId
}

export type HoldingProblem =
  | { readonly field: "kind"; readonly problem: "required" }
  | { readonly field: "name"; readonly problem: "required" | "too_long" }
  | { readonly field: "ticker"; readonly problem: "invalid" }
  | { readonly field: "index"; readonly problem: "required" | "too_long" }
  | { readonly field: "assetClass"; readonly problem: "required" }
  | { readonly field: "units"; readonly problem: "invalid" | "zero" }
  | { readonly field: "value"; readonly problem: "required" | "invalid" }
  | { readonly field: "valuedOn"; readonly problem: "required" | "invalid" }

export class InvalidHolding extends Data.TaggedError("InvalidHolding")<{
  readonly problems: readonly HoldingProblem[]
}> {}

/** No Holding with this id belongs to the Owner. */
export class HoldingNotFound extends Data.TaggedError("HoldingNotFound")<{
  readonly holdingId: string
}> {}

/** What a Holding is called: its own name or, for an unnamed index fund, its Index. */
export const holdingName = (holding: Pick<HoldingDetails, "name" | "index">): string =>
  holding.name ?? holding.index ?? ""

/** The longest name a Holding, or the Index it tracks, can have. */
export const maxNameLength = 100

const tickerPattern = /^[A-Z0-9][A-Z0-9.:-]{0,19}$/

const isoDate = /^\d{4}-\d{2}-\d{2}$/

const text = (input: unknown, key: string): string => {
  if (typeof input !== "object" || input === null || !(key in input)) return ""
  const value: unknown = Reflect.get(input, key)
  return typeof value === "string" ? value.trim() : ""
}

const collapseSpaces = (value: string): string => value.replace(/\s+/g, " ")

const parseDate = (value: string): Temporal.PlainDate | undefined => {
  if (!isoDate.test(value)) return undefined
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" })
  } catch {
    return undefined
  }
}

/**
 * Checks what the Owner entered for a Holding: its kind, a name (optional
 * for an index fund), an optional
 * ticker, the Index for an index fund, an Asset Class (a stock is always
 * equity), optional units, and its value on an ISO calendar date.
 */
export const decodeHoldingDetails = (
  input: unknown,
): Result.Result<HoldingDetails, InvalidHolding> => {
  const problems: HoldingProblem[] = []

  const kind = Schema.decodeUnknownOption(HoldingKind)(text(input, "kind"))
  if (kind._tag === "None") problems.push({ field: "kind", problem: "required" })

  const nameText = collapseSpaces(text(input, "name"))
  const name = nameText === "" ? null : nameText
  const isIndexFund = kind._tag === "Some" && kind.value === "index_fund"
  if (name === null && !isIndexFund) problems.push({ field: "name", problem: "required" })
  else if (name !== null && name.length > maxNameLength) {
    problems.push({ field: "name", problem: "too_long" })
  }

  const tickerText = text(input, "ticker").toUpperCase()
  const ticker = tickerText === "" ? null : tickerText
  if (ticker !== null && !tickerPattern.test(ticker)) {
    problems.push({ field: "ticker", problem: "invalid" })
  }

  let index: string | null = null
  if (isIndexFund) {
    index = collapseSpaces(text(input, "index"))
    if (index === "") problems.push({ field: "index", problem: "required" })
    else if (index.length > maxNameLength) problems.push({ field: "index", problem: "too_long" })
  }

  const chosenClass = Schema.decodeUnknownOption(AssetClass)(text(input, "assetClass"))
  const assetClass: AssetClass | undefined =
    kind._tag === "Some" && kind.value === "stock"
      ? "equity"
      : chosenClass._tag === "Some"
        ? chosenClass.value
        : undefined
  // Without a kind there is no telling whether the class was needed.
  if (assetClass === undefined && kind._tag === "Some") {
    problems.push({ field: "assetClass", problem: "required" })
  }

  const unitsText = text(input, "units")
  const units = unitsText === "" ? null : Units.parse(unitsText)
  if (units === undefined) problems.push({ field: "units", problem: "invalid" })
  else if (units !== null && units.scaled === 0n) problems.push({ field: "units", problem: "zero" })

  const valueText = text(input, "value")
  const value = Money.parse(valueText, "EUR")
  if (value === undefined) {
    problems.push({ field: "value", problem: valueText === "" ? "required" : "invalid" })
  }

  const dateText = text(input, "valuedOn")
  const valuedOn = parseDate(dateText)
  if (valuedOn === undefined) {
    problems.push({ field: "valuedOn", problem: dateText === "" ? "required" : "invalid" })
  }

  if (
    problems.length > 0 ||
    kind._tag === "None" ||
    assetClass === undefined ||
    units === undefined ||
    value === undefined ||
    valuedOn === undefined
  ) {
    return Result.fail(new InvalidHolding({ problems }))
  }
  return Result.succeed({
    kind: kind.value,
    name,
    ticker,
    index,
    assetClass,
    units,
    value,
    valuedOn,
  })
}

/**
 * The Concentration Limit: the largest share of all Investment any single
 * stock should be. A Rule Set parameter once the Rule Set exists (ADR 0007).
 */
export const defaultConcentrationLimit: Share.Share = { basisPoints: 1_000 }

/** Some of the money in a breakdown: its value and its share of the whole. */
export interface Slice {
  readonly value: Money.Money
  readonly share: Share.Share
}

export interface AssetClassSlice extends Slice {
  readonly assetClass: AssetClass
}

/** Every Holding tracking one Index, added up. */
export interface IndexSlice extends Slice {
  /** The Index as written on the first of its Holdings given, e.g. the largest when sorted so. */
  readonly index: string
}

/** Every Holding of one stock, added up. */
export interface StockSlice extends Slice {
  readonly name: string
  readonly ticker: string | null
}

/**
 * Where some Investment money is: its total (the Valuation, for one
 * Account), the Asset Mix, and the value per Index and per stock, each
 * largest first.
 */
export interface HoldingsBreakdown {
  readonly total: Money.Money
  /** The Asset Mix: only classes holding money. */
  readonly byAssetClass: readonly AssetClassSlice[]
  readonly byIndex: readonly IndexSlice[]
  readonly byStock: readonly StockSlice[]
  /** The oldest and newest Holding values; `null` when there are no Holdings. */
  readonly valuedBetween: {
    readonly oldest: Temporal.PlainDate
    readonly newest: Temporal.PlainDate
  } | null
}

const sumCents = (holdings: readonly Pick<HoldingDetails, "value">[]): bigint =>
  holdings.reduce((sum, holding) => sum + holding.value.cents, 0n)

/** Groups by `keyOf`, keeping the first member of each group to describe it. */
const groupBy = <A>(items: readonly A[], keyOf: (item: A) => string) => {
  const groups = new Map<string, { readonly first: A; readonly members: A[] }>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, { first: item, members: [item] })
    else group.members.push(item)
  }
  return [...groups.values()]
}

/** Index names compare without regard to case or spacing: "MSCI World" is "msci  world". */
const indexKey = (index: string): string => collapseSpaces(index.trim()).toLocaleLowerCase("en")

/** The same stock held twice shares a ticker or, without one, a name. */
const stockKey = (holding: HoldingDetails): string =>
  holding.ticker === null ? `name:${indexKey(holdingName(holding))}` : `ticker:${holding.ticker}`

const byValueDescending = Order.mapInput(
  Order.flip(Order.BigInt),
  (slice: Slice) => slice.value.cents,
)

const sortSlices = <S extends Slice>(slices: S[], labelOf: (slice: S) => string): S[] =>
  slices.toSorted((a, b) => byValueDescending(a, b) || labelOf(a).localeCompare(labelOf(b)))

const byDate = (a: Temporal.PlainDate, b: Temporal.PlainDate) => Temporal.PlainDate.compare(a, b)

/**
 * Breaks Holdings down by Asset Class, Index and stock, each share relative
 * to their total. An Index or stock is labelled as on its first Holding in
 * `holdings`.
 */
export const breakdown = (holdings: readonly HoldingDetails[]): HoldingsBreakdown => {
  const totalCents = sumCents(holdings)
  const valueOf = (members: readonly HoldingDetails[]) => Money.eur(sumCents(members))
  const shareOf = (value: Money.Money) => Share.of(value.cents, totalCents)

  const byAssetClass = assetClasses
    .map((assetClass): AssetClassSlice => {
      const value = valueOf(holdings.filter((holding) => holding.assetClass === assetClass))
      return { assetClass, value, share: shareOf(value) }
    })
    .filter((assetSlice) => assetSlice.value.cents > 0n)

  const byIndex = groupBy(
    holdings.filter((holding) => holding.index !== null),
    (holding) => indexKey(holding.index ?? ""),
  ).map(({ first, members }): IndexSlice => {
    const value = valueOf(members)
    return { index: first.index ?? "", value, share: shareOf(value) }
  })

  const byStock = groupBy(
    holdings.filter((holding) => holding.kind === "stock"),
    stockKey,
  ).map(({ first, members }): StockSlice => {
    const value = valueOf(members)
    return { name: holdingName(first), ticker: first.ticker, value, share: shareOf(value) }
  })

  const dates = holdings.map((holding) => holding.valuedOn).toSorted(byDate)
  const oldest = dates[0]
  const newest = dates.at(-1)

  return {
    total: Money.eur(totalCents),
    byAssetClass: sortSlices(byAssetClass, (assetSlice) => assetSlice.assetClass),
    byIndex: sortSlices(byIndex, (indexSlice) => indexSlice.index),
    byStock: sortSlices(byStock, (stockSlice) => stockSlice.name),
    valuedBetween: oldest === undefined || newest === undefined ? null : { oldest, newest },
  }
}

/**
 * The stocks above the Concentration Limit in a breakdown of all
 * Investment, largest first. Compared exactly, so a stock at precisely the
 * limit isn't flagged.
 */
export const concentratedStocks = (
  overall: HoldingsBreakdown,
  limit: Share.Share = defaultConcentrationLimit,
): readonly StockSlice[] =>
  overall.byStock.filter((stock) => Share.exceeds(stock.value.cents, overall.total.cents, limit))
