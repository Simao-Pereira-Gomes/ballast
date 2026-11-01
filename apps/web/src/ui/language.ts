import { locales } from "@ballast/core"
import type { Locale } from "@ballast/core"

const primary = (tag: string): string => tag.split("-")[0]?.toLowerCase() ?? ""

/** The languages in an Accept-Language header, most preferred first. */
export const languagesFromHeader = (header: string | null): readonly string[] =>
  (header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag = "", ...parameters] = part.trim().split(";")
      const weight = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith("q="))
      return { tag: tag.trim(), weight: weight ? Number(weight.slice(2)) : 1, index }
    })
    .filter(({ tag, weight }) => tag !== "" && tag !== "*" && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map(({ tag }) => tag)

/**
 * The first of the Owner's preferred languages that Ballast speaks, matching
 * on the language when the region differs (pt-BR → pt-PT, en-US → en).
 */
export const negotiateLocale = (preferred: readonly string[]): Locale | undefined => {
  for (const tag of preferred) {
    const exact = locales.find((locale) => locale.toLowerCase() === tag.toLowerCase())
    if (exact) return exact
    const sameLanguage = locales.find((locale) => primary(locale) === primary(tag))
    if (sameLanguage) return sameLanguage
  }
  return undefined
}
