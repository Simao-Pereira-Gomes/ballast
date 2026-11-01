import { Schema } from "effect"

export const Locale = Schema.Literals(["en", "pt-PT"])
export type Locale = typeof Locale.Type

export const locales: readonly Locale[] = Locale.literals

/**
 * The Intl locale behind each interface language. English uses British
 * conventions (day-first dates), which suit a European app.
 */
export const intlLocale: Record<Locale, string> = {
  en: "en-GB",
  "pt-PT": "pt-PT",
}
