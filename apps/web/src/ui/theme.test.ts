import { describe, expect, it } from "vitest"
import { parseThemePreference, resolveTheme } from "./theme.ts"

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
