import { defineConfig } from "@inlang/paraglide-js"

// ADR 0006: the cookie set by the language switch, then the browser's preferred
// languages (custom strategy in src/i18n.ts), then English.
export default defineConfig({
  outdir: "./src/paraglide",
  strategy: ["cookie", "custom-preferredLanguage", "baseLocale"],
  emitTsDeclarations: true,
})
