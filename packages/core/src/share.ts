/**
 * A part's share of a whole, in whole basis points: 2550 is 25.5%. Shares
 * are computed from integer cents, so they never go through floating point.
 */
import { intlLocale } from "./locale.ts"
import type { Locale } from "./locale.ts"

export interface Share {
  readonly basisPoints: number
}

/** All of it: 100%. */
export const whole = 10_000

/**
 * `part` as a share of `total`, rounded half up to a basis point. A zero
 * total gives a zero share. Both must be non-negative.
 */
export const of = (part: bigint, total: bigint): Share => {
  if (part < 0n || total < 0n) throw new RangeError("Share.of: amounts must be non-negative")
  if (total === 0n) return { basisPoints: 0 }
  const scaled = part * BigInt(whole)
  const rounded = (scaled * 2n + total) / (total * 2n)
  return { basisPoints: Number(rounded) }
}

/** Whether `part` is strictly more than `limit` of `total`, compared exactly. */
export const exceeds = (part: bigint, total: bigint, limit: Share): boolean =>
  total > 0n && part * BigInt(whole) > BigInt(limit.basisPoints) * total

/** The share as an exact decimal fraction, e.g. "0.2550" for 25.5%. */
const asFraction = ({ basisPoints }: Share): string => {
  const digits = basisPoints.toString().padStart(5, "0")
  return `${digits.slice(0, -4)}.${digits.slice(-4)}`
}

const formatters = new Map<Locale, Intl.NumberFormat>()

const formatterFor = (locale: Locale): Intl.NumberFormat => {
  let formatter = formatters.get(locale)
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(intlLocale[locale], {
      style: "percent",
      maximumFractionDigits: 1,
    })
    formatters.set(locale, formatter)
  }
  return formatter
}

/** Formats a share for display in the interface language, to one decimal, e.g. "25,5%" (pt-PT). */
export const format = (share: Share, locale: Locale): string =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built from an integer's digits, so always a valid numeric literal
  formatterFor(locale).format(asFraction(share) as Intl.StringNumericLiteral)
