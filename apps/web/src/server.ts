import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { registerLanguageStrategies } from "./i18n.ts"
import { paraglideMiddleware } from "./paraglide/server.js"

registerLanguageStrategies()

export default createServerEntry({
  fetch(request) {
    return paraglideMiddleware(request, () => handler.fetch(request))
  },
})
