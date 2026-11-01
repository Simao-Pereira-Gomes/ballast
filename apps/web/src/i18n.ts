import {
  cookieName,
  defineCustomClientStrategy,
  defineCustomServerStrategy,
  isLocale,
} from "./paraglide/runtime.js"
import { languagesFromHeader, negotiateLocale } from "./ui/language.ts"

/**
 * The browser's preferred languages, matched by language when the region
 * differs (pt-BR → pt-PT) and in the Owner's order of preference. Replaces
 * Paraglide's `preferredLanguage`, which only matches exact tags. Server and
 * browser must agree, or hydration would render a different language.
 *
 * Paraglide's server middleware runs custom strategies before the built-in
 * ones, whatever order the config gives, so on the server this strategy must
 * step aside when the Owner has chosen a language. Otherwise the server would
 * render the browser's language while the browser (which keeps the order)
 * renders the chosen one, and the hydration mismatch makes React re-render
 * the whole document, dropping the theme the boot script applied.
 *
 * Called by the server entry and the root route, before any locale is read.
 */
export const registerLanguageStrategies = (): void => {
  defineCustomServerStrategy("custom-preferredLanguage", {
    getLocale: (request) => {
      if (request === undefined || hasChosenLocale(request)) return undefined
      return negotiateLocale(languagesFromHeader(request.headers.get("accept-language")))
    },
  })

  defineCustomClientStrategy("custom-preferredLanguage", {
    getLocale: () => negotiateLocale(navigator.languages),
    // The cookie strategy remembers an explicit choice; nothing to store here.
    setLocale: () => undefined,
  })
}

/** Whether the request carries a language the Owner chose with the switch. */
const hasChosenLocale = (request: Request): boolean =>
  (request.headers.get("cookie") ?? "")
    .split(";")
    .map((pair) => pair.trim().split("="))
    .some(([name, value]) => name === cookieName && isLocale(value))
