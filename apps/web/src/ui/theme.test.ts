import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import { parseThemePreference, resolveTheme, themeBootScript, themeStorageKey } from "./theme.ts"

describe("parseThemePreference", () => {
  it("accepts each stored preference", () => {
    expect(parseThemePreference("system")).toBe("system")
    expect(parseThemePreference("light")).toBe("light")
    expect(parseThemePreference("dark")).toBe("dark")
  })

  it("falls back to System when nothing, or something unknown, is stored", () => {
    expect(parseThemePreference(null)).toBe("system")
    expect(parseThemePreference("sepia")).toBe("system")
  })
})

describe("resolveTheme", () => {
  it("follows the system setting when the preference is System", () => {
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
  })

  it("ignores the system setting when the Owner picked a theme", () => {
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("dark", false)).toBe("dark")
  })
})

describe("themeBootScript", () => {
  /** Runs the inline <head> script against a fake browser and reports the theme it applied. */
  const runBootScript = (stored: string | null, systemPrefersDark: boolean) => {
    const classes = new Set<string>()
    const style = { colorScheme: "" }
    runInNewContext(themeBootScript, {
      localStorage: { getItem: (key: string) => (key === themeStorageKey ? stored : null) },
      matchMedia: (query: string) => ({
        matches: query === "(prefers-color-scheme: dark)" && systemPrefersDark,
      }),
      document: {
        documentElement: {
          style,
          classList: {
            toggle: (name: string, on: boolean) => {
              if (on) classes.add(name)
              else classes.delete(name)
            },
          },
        },
      },
    })
    return { dark: classes.has("dark"), colorScheme: style.colorScheme }
  }

  const storedValues = [null, "system", "light", "dark", "sepia"]

  it.each(storedValues.flatMap((stored) => [true, false].map((dark) => [stored, dark] as const)))(
    "agrees with resolveTheme when %s is stored and the system prefers dark: %s",
    (stored, systemPrefersDark) => {
      const expected = resolveTheme(parseThemePreference(stored), systemPrefersDark)
      expect(runBootScript(stored, systemPrefersDark)).toEqual({
        dark: expected === "dark",
        colorScheme: expected,
      })
    },
  )
})
