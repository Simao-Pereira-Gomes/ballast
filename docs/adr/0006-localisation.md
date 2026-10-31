---
status: accepted
---

# Localisation: English and pt-PT with Paraglide, and a core that speaks in codes

Ballast's interface is available in English and European Portuguese (pt-PT); more languages may follow. We use **Paraglide JS** (inlang): messages compile to typed functions, so a missing message or a wrong parameter is a type error rather than a key that falls back at runtime, and only the messages a page uses reach the browser. react-i18next and Lingui were the alternatives; both rely on string keys checked at runtime or on an extraction step, which fits this codebase's "the compiler catches it" style worse.

The language follows the browser (`Accept-Language`) and can be switched by hand. The choice is remembered in a **cookie**, not `localStorage` like the theme, because the server renders pages and must know the language before it does: resolving it only in the browser would flash the wrong language and break hydration. Resolution order is cookie, then `Accept-Language`, then `en`. The language is not part of the URL; Ballast is a single-Owner app reachable only from this machine (ADR 0001), so shareable per-language links buy nothing.

The **core never produces sentences**. Expected failures and other outputs that end up in front of the Owner carry typed codes and parameters (e.g. `{ field: "name", problem: "required" }`), and the interface turns them into text in the chosen language. This keeps `packages/core` free of language and keeps its outputs testable by value. **Money and dates follow the language** (pt-PT `-12 345,67 €`, en `-€12,345.67`), but formatting stays in the core: `Money.format` and the `PlainDate` formatter take a locale, so there is still exactly one place that formats amounts.

Domain terms get **one fixed translation each**, chosen by the Owner and recorded beside the English term in `CONTEXT.md`. Code, ADRs and issues stay in English.

**Bank exports are a separate concern.** An export's language is whatever the bank's site was set to, not the interface language. Each Statement Parser adapter recognises its layout from the header row in every language it knows and reads dates and amounts by layout. Transaction descriptions are kept exactly as the bank wrote them; Categorisation Rules match them as they are and are never translated.

## Consequences

- Interface text lives only in the message catalogues. Adding a language means adding a catalogue and its `CONTEXT.md` terms; no code changes.
- Existing English-only outputs move to codes: today `decodeNewAccount`'s problems; later the Advisor's explanations and Recommendations, which must be built as codes plus parameters from the start.
- Tests assert on codes in the core and on rendered text only in Playwright, which runs in both languages.
- A pt-PT interface reading an English-language export (or the reverse) is normal and needs no special handling.
