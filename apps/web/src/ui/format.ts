import { Money, formatDate } from "@ballast/core"
import { getLocale } from "@/paraglide/runtime.js"

/** An amount in the interface language, e.g. "-1,20 €" (pt-PT). */
export const formatMoney = (money: Money.Money): string => Money.format(money, getLocale())

/** A calendar date in the interface language, e.g. "31/10/2026" (pt-PT). */
export const formatDay = (date: Temporal.PlainDate): string => formatDate(date, getLocale())

/** An amount as the Owner would type it into an amount field, e.g. "1,20" (pt-PT). */
export const amountForInput = (money: Money.Money): string =>
  Money.formatForInput(money, getLocale())
