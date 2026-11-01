import { defineCustomClientStrategy, defineCustomServerStrategy } from "./paraglide/runtime.js"
import { languagesFromHeader, negotiateLocale } from "./ui/language.ts"

/**
 * The browser's preferred languages, matched by language when the region
 * differs (pt-BR → pt-PT) and in the Owner's order of preference. Replaces
 * Paraglide's `preferredLanguage`, which only matches exact tags. Server and
 * browser must agree, or hydration would render a different language.
 *
 * Called by the server entry and the root route, before any locale is read.
 */
export const registerLanguageStrategies = (): void => {
  defineCustomServerStrategy("custom-preferredLanguage", {
    getLocale: (request) =>
      negotiateLocale(languagesFromHeader(request?.headers.get("accept-language") ?? null)),
  })

  defineCustomClientStrategy("custom-preferredLanguage", {
    getLocale: () => negotiateLocale(navigator.languages),
    // The cookie strategy remembers an explicit choice; nothing to store here.
    setLocale: () => undefined,
  })
}
