import { useSyncExternalStore } from "react"
import { parseThemePreference, resolveTheme, themeStorageKey } from "@/ui/theme.ts"
import type { ThemePreference } from "@/ui/theme.ts"

const darkQuery = "(prefers-color-scheme: dark)"
const listeners = new Set<() => void>()

const readPreference = (): ThemePreference => {
  try {
    return parseThemePreference(localStorage.getItem(themeStorageKey))
  } catch {
    return "system"
  }
}

const apply = (preference: ThemePreference) => {
  const theme = resolveTheme(preference, matchMedia(darkQuery).matches)
  // Switch every colour at once instead of letting each element's transition fade it.
  const noTransitions = document.createElement("style")
  noTransitions.textContent = "*, *::before, *::after { transition: none !important }"
  document.head.append(noTransitions)
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
  // Force a style recalculation before transitions come back.
  void getComputedStyle(document.documentElement).colorScheme
  requestAnimationFrame(() => {
    noTransitions.remove()
  })
}

const notify = () => {
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  const media = matchMedia(darkQuery)
  const onSystemChange = () => {
    apply(readPreference())
  }
  // Another tab changed the preference.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== themeStorageKey) return
    apply(readPreference())
    notify()
  }
  media.addEventListener("change", onSystemChange)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", onSystemChange)
    window.removeEventListener("storage", onStorage)
  }
}

const setThemePreference = (preference: ThemePreference) => {
  try {
    localStorage.setItem(themeStorageKey, preference)
  } catch {
    // Storage is unavailable (e.g. private mode): the choice lasts for this page only.
  }
  apply(preference)
  notify()
}

/**
 * The Owner's theme choice, remembered in the browser. The server renders
 * System; the boot script in <head> has already applied the stored theme.
 */
export const useThemePreference = (): readonly [
  ThemePreference,
  (preference: ThemePreference) => void,
] => [useSyncExternalStore(subscribe, readPreference, () => "system"), setThemePreference]
