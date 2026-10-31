/**
 * An exact amount of money: integer cents in an explicit currency.
 * Floating point never touches an amount.
 */
import { Order as O, Schema } from "effect"

/** Currencies Ballast handles. v1 supports EUR only. */
export const Currency = Schema.Literals(["EUR"])
export type Currency = typeof Currency.Type

export const currencies: readonly Currency[] = Currency.literals

export interface Money {
  readonly cents: bigint
  readonly currency: Currency
}

export const eur = (cents: bigint): Money => ({ cents, currency: "EUR" })

export const add = (a: Money, b: Money): Money => ({
  cents: a.cents + b.cents,
  currency: a.currency,
})

export const subtract = (a: Money, b: Money): Money => ({
  cents: a.cents - b.cents,
  currency: a.currency,
})

export const Order: O.Order<Money> = O.mapInput(O.BigInt, (money: Money) => money.cents)

/**
 * Splits an amount into parts proportional to `ratios`, using the
 * largest-remainder method so the parts always sum to the whole.
 * Leftover cents go to the parts with the largest remainders; ties go to
 * the earlier part.
 *
 * Ratios must be non-negative integers with a positive sum. Anything else
 * is a programming error and throws.
 */
export const allocate = (money: Money, ratios: readonly number[]): Money[] => {
  if (ratios.some((ratio) => !Number.isSafeInteger(ratio) || ratio < 0)) {
    throw new RangeError("Money.allocate: ratios must be non-negative integers")
  }
  const weights = ratios.map(BigInt)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n)
  if (totalWeight === 0n) {
    throw new RangeError("Money.allocate: ratios must have a positive sum")
  }

  const sign = money.cents < 0n ? -1n : 1n
  const whole = money.cents * sign
  const shares = weights.map((weight) => ({
    base: (whole * weight) / totalWeight,
    remainder: (whole * weight) % totalWeight,
  }))

  let leftover = whole - shares.reduce((sum, share) => sum + share.base, 0n)
  const byLargestRemainder = shares
    .map((share, index) => ({ index, remainder: share.remainder }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    )

  const parts = shares.map((share) => share.base)
  for (const { index } of byLargestRemainder) {
    if (leftover === 0n) break
    parts[index] = (parts[index] ?? 0n) + 1n
    leftover -= 1n
  }

  return parts.map((cents) => ({ cents: cents * sign, currency: money.currency }))
}

const formatters: Record<Currency, Intl.NumberFormat> = {
  EUR: new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }),
}

/**
 * Formats an amount for display in Portuguese, e.g. "1234,56 €" or
 * "-12 345,67 €". The amount is passed to Intl as an exact decimal string,
 * so it never goes through a float.
 */
export const format = (money: Money): string => {
  const negative = money.cents < 0n
  const digits = (negative ? -money.cents : money.cents).toString().padStart(3, "0")
  const decimal = `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built from a bigint's digits, so always a valid numeric literal
  return formatters[money.currency].format(decimal as Intl.StringNumericLiteral)
}
