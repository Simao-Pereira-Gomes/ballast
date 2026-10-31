/** What the Owner picked in the theme switch. System follows the device setting. */
export type ThemePreference = "system" | "light" | "dark"

/** The theme actually shown. */
export type Theme = "light" | "dark"

export const themePreferences: readonly ThemePreference[] = ["system", "light", "dark"]

/** Where the browser remembers the preference. */
export const themeStorageKey = "ballast.theme"

export const parseThemePreference = (stored: string | null): ThemePreference =>
  themePreferences.find((preference) => preference === stored) ?? "system"

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): Theme =>
  preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference

/**
 * Runs in <head> before the first paint, so a remembered theme never flashes
 * the other one. Mirrors `parseThemePreference` and `resolveTheme`.
 */
export const themeBootScript = `(() => {
  let stored = null
  try { stored = localStorage.getItem(${JSON.stringify(themeStorageKey)}) } catch {}
  const dark = stored === "dark" || (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
})()`
