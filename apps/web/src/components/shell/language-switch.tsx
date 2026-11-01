import { locales } from "@ballast/core"
import type { Locale } from "@ballast/core"
import { useId } from "react"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { getLocale, setLocale } from "@/paraglide/runtime.js"

/** Each language named in itself, so the Owner can find theirs whatever is showing. */
const nameOf = (locale: Locale): string => m.language_name({}, { locale })

/** The short form shown on the switch: "EN", "PT". */
const shortOf = (locale: Locale): string => (locale.split("-")[0] ?? locale).toUpperCase()

/**
 * English / Português. Choosing one sets the language cookie and reloads,
 * so the server renders the page in the new language (ADR 0006).
 */
export function LanguageSwitch({ className }: Readonly<{ className?: string }>) {
  const current = getLocale()
  const name = useId()

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{m.language()}</legend>
      <div className="flex rounded-full bg-secondary p-1">
        {locales.map((locale) => (
          <label
            key={locale}
            lang={locale}
            title={nameOf(locale)}
            className={cn(
              "relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors",
              "has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={locale}
              checked={current === locale}
              onChange={() => {
                void setLocale(locale)
              }}
              className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
            />
            <span aria-hidden>{shortOf(locale)}</span>
            <span className="sr-only">{nameOf(locale)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
