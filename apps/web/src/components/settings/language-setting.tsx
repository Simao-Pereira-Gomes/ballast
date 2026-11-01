import { locales } from "@ballast/core"
import { m } from "@/paraglide/messages.js"
import { getLocale, setLocale } from "@/paraglide/runtime.js"
import { SegmentedChoice } from "./segmented-choice.tsx"

/**
 * English / Português, each named in itself so the Owner can find theirs
 * whatever is showing. Choosing one sets the language cookie and reloads,
 * so the server renders the page in the new language (ADR 0006).
 */
export function LanguageSetting() {
  return (
    <SegmentedChoice
      legend={m.language()}
      description={m.language_description()}
      value={getLocale()}
      onChoose={(locale) => {
        void setLocale(locale)
      }}
      choices={locales.map((locale) => ({
        value: locale,
        label: m.language_name({}, { locale }),
        lang: locale,
      }))}
    />
  )
}
