/**
 * A Transaction's description is kept as the bank wrote it (ADR 0006). This
 * module derives its normalised form, the key that the dedup fingerprint and
 * Categorisation Rules match on, so differences in spacing, casing or card
 * masking between two exports don't make the same line look different.
 */

/** A run of 13 to 19 digits, optionally grouped by spaces or dashes: maybe a card number. */
const digitRun = /\b(?:\d[ -]?){12,18}\d\b/g

/** The Luhn checksum every payment card number passes, and most other references fail. */
const passesLuhn = (digits: string): boolean => {
  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2
    sum += digit
  }
  return sum % 10 === 0
}

/** A full card number reduced to `****` and its last four digits; other digit runs untouched. */
const maskFullCardNumber = (run: string): string => {
  const digits = run.replace(/[ -]/g, "")
  return passesLuhn(digits) ? `****${digits.slice(-4)}` : run
}

/**
 * A masked card number: optional leading digits, then masking (two or more
 * `*`, or four or more `X`), possibly grouped, ending in the last four digits.
 */
const maskedCardNumber = /(?:\b\d{1,6}[ -]?)?(?:(?:\*{2,}|[Xx]{4,})[ -]?)+(\d{4})\b/g

/**
 * The normalised form of a bank description: Unicode-composed, whitespace
 * collapsed and trimmed, card numbers (masked by the bank, or full ones that
 * pass the Luhn check) reduced to `****` and their last four digits, and case folded without regard to locale. Accents are kept.
 */
export const normaliseDescription = (description: string): string =>
  description
    .normalize("NFC")
    .replace(maskedCardNumber, "****$1")
    .replace(digitRun, maskFullCardNumber)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
