import { m } from "@/paraglide/messages.js"
import { LanguageSetting } from "./language-setting.tsx"
import { ThemeSetting } from "./theme-setting.tsx"

/** The Owner's preferences for how Ballast looks and speaks. */
export function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-12">
      <h1 className="text-title">{m.settings()}</h1>
      <div className="mt-8 space-y-4">
        <section className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm">
          <ThemeSetting />
        </section>
        <section className="rounded-2xl bg-card p-5 text-card-foreground shadow-sm">
          <LanguageSetting />
        </section>
      </div>
    </main>
  )
}
