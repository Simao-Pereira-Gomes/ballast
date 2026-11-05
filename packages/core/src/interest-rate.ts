/**
 * An annual interest rate (APR) on a Liability, in whole basis points:
 * 1850 is 18.5%. Like Money, it never goes through floating point.
 */
import { intlLocale } from "./locale.ts"
import type { Locale } from "./locale.ts"

export interface InterestRate {
  readonly basisPoints: number
}

/** The highest rate Ballast accepts: 100%. Anything above is a typo. */
export const maxBasisPoints = 10_000

const percentage = /^(\d{1,3})(?:[.,](\d{1,2}))?\s*%?$/

/**
 * Reads a rate the Owner typed as a percentage from 0 to 100 with up to two
 * decimals, after a point or a comma, and an optional "%" ("18", "18,5",
 * "7.9 %"). Returns `undefined` when the text isn't such a rate.
 */
export const parse = (text: string): InterestRate | undefined => {
  const match = percentage.exec(text.trim())
  if (match === null) return undefined
  const [, units = "0", fraction = ""] = match
  const basisPoints = Number(units) * 100 + Number(fraction.padEnd(2, "0"))
  return basisPoints <= maxBasisPoints ? { basisPoints } : undefined
}

/** The rate as an exact decimal fraction, e.g. "0.1850" for 18.5%. */
const asFraction = ({ basisPoints }: InterestRate): string => {
  const digits = basisPoints.toString().padStart(5, "0")
  return `${digits.slice(0, -4)}.${digits.slice(-4)}`
}

const formatters = new Map<Locale, Intl.NumberFormat>()

const formatterFor = (locale: Locale): Intl.NumberFormat => {
  let formatter = formatters.get(locale)
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(intlLocale[locale], {
      style: "percent",
      maximumFractionDigits: 2,
    })
    formatters.set(locale, formatter)
  }
  return formatter
}

/** Formats a rate for display in the interface language, e.g. "18,5%" (pt-PT). */
export const format = (rate: InterestRate, locale: Locale): string =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built from an integer's digits, so always a valid numeric literal
  formatterFor(locale).format(asFraction(rate) as Intl.StringNumericLiteral)

const decimalSeparator: Record<Locale, string> = { en: ".", "pt-PT": "," }

/**
 * Writes a rate the way the Owner would type it into the rate field: no
 * "%" and no trailing zeros, e.g. "18,5" (pt-PT). `parse` reads it back.
 */
export const formatForInput = ({ basisPoints }: InterestRate, locale: Locale): string => {
  const units = Math.trunc(basisPoints / 100).toString()
  const fraction = (basisPoints % 100).toString().padStart(2, "0").replace(/0+$/, "")
  return fraction === "" ? units : `${units}${decimalSeparator[locale]}${fraction}`
}
