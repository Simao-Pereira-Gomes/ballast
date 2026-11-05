/**
 * How many units of a Holding the Owner has: shares, fund units or a
 * fraction of a crypto-asset. Exact to 8 decimals, held as an integer count
 * of hundred-millionths, so it never goes through floating point.
 */
import { intlLocale } from "./locale.ts"
import type { Locale } from "./locale.ts"

export interface Units {
  /** The quantity times 10^8: 150000000n is 1.5 units. */
  readonly scaled: bigint
}

/** How many decimals Units keep. */
export const decimals = 8

const scale = 10n ** BigInt(decimals)

const quantity = new RegExp(`^(\\d{1,20})(?:[.,](\\d{1,${decimals}}))?$`)

/**
 * Reads a quantity the Owner typed: whole units with up to 8 decimals, after
 * a point or a comma ("12", "0,5", "0.00012345"). No sign and no thousands
 * separators. Returns `undefined` when the text isn't such a quantity.
 */
export const parse = (text: string): Units | undefined => {
  const match = quantity.exec(text.trim())
  if (match === null) return undefined
  const [, whole = "0", fraction = ""] = match
  return { scaled: BigInt(whole) * scale + BigInt(fraction.padEnd(decimals, "0")) }
}

/** The quantity as an exact decimal string with all 8 decimals, e.g. "1.50000000". */
export const toDecimal = ({ scaled }: Units): string => {
  const digits = scaled.toString().padStart(decimals + 1, "0")
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`
}

/** Reads back what `toDecimal` (or a Postgres `numeric`) wrote, e.g. "1.50000000". */
export const fromDecimal = (text: string): Units => {
  const units = parse(text)
  if (units === undefined) throw new RangeError(`Units.fromDecimal: not a quantity: ${text}`)
  return units
}

const formatters = new Map<Locale, Intl.NumberFormat>()

const formatterFor = (locale: Locale): Intl.NumberFormat => {
  let formatter = formatters.get(locale)
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: decimals })
    formatters.set(locale, formatter)
  }
  return formatter
}

/** Formats a quantity for display in the interface language, e.g. "1 234,5" (pt-PT). */
export const format = (units: Units, locale: Locale): string =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built from a bigint's digits, so always a valid numeric literal
  formatterFor(locale).format(toDecimal(units) as Intl.StringNumericLiteral)

const decimalSeparator: Record<Locale, string> = { en: ".", "pt-PT": "," }

/**
 * Writes a quantity the way the Owner would type it: no grouping and no
 * trailing zeros, e.g. "1234,5" (pt-PT). `parse` reads it back.
 */
export const formatForInput = (units: Units, locale: Locale): string => {
  const [whole = "0", fraction = ""] = toDecimal(units).split(".")
  const trimmed = fraction.replace(/0+$/, "")
  return trimmed === "" ? whole : `${whole}${decimalSeparator[locale]}${trimmed}`
}
