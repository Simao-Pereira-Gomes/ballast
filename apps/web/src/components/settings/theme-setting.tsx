import { Monitor, Moon, Sun } from "lucide-react"
import { m } from "@/paraglide/messages.js"
import { SegmentedChoice } from "./segmented-choice.tsx"
import { useThemePreference } from "./use-theme-preference.ts"

/** System / Light / Dark. Applies at once and is remembered in this browser. */
export function ThemeSetting() {
  const [preference, setPreference] = useThemePreference()

  return (
    <SegmentedChoice
      legend={m.theme()}
      description={m.theme_description()}
      value={preference}
      onChoose={setPreference}
      choices={[
        { value: "system", label: m.theme_system(), icon: Monitor },
        { value: "light", label: m.theme_light(), icon: Sun },
        { value: "dark", label: m.theme_dark(), icon: Moon },
      ]}
    />
  )
}
