import { Monitor, Moon, Sun } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId } from "react"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { themePreferences } from "@/ui/theme.ts"
import type { ThemePreference } from "@/ui/theme.ts"
import { useThemePreference } from "./use-theme-preference.ts"

const options: Record<ThemePreference, { label: () => string; icon: LucideIcon }> = {
  system: { label: () => m.theme_system(), icon: Monitor },
  light: { label: () => m.theme_light(), icon: Sun },
  dark: { label: () => m.theme_dark(), icon: Moon },
}

/** System / Light / Dark, as a segmented control of icon radio buttons. */
export function ThemeSwitch({ className }: Readonly<{ className?: string }>) {
  const [preference, setPreference] = useThemePreference()
  const name = useId()

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{m.theme()}</legend>
      <div className="flex rounded-full bg-secondary p-1">
        {themePreferences.map((value) => {
          const { icon: Icon } = options[value]
          const label = options[value].label()
          return (
            <label
              key={value}
              title={label}
              className={cn(
                "relative flex flex-1 cursor-pointer items-center justify-center rounded-full px-2.5 py-1.5 text-muted-foreground transition-colors",
                "has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              )}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={preference === value}
                onChange={() => {
                  setPreference(value)
                }}
                className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
              />
              <Icon className="size-4" aria-hidden />
              <span className="sr-only">{label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
