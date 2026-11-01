import { intlLocale } from "./locale.ts"
import type { Locale } from "./locale.ts"

/** Formats a calendar date for display, e.g. "31/10/2026" (pt-PT) or "31 Oct 2026" (en). */
export const formatDate = (date: Temporal.PlainDate, locale: Locale): string =>
  date.toLocaleString(intlLocale[locale], { dateStyle: "medium" })
