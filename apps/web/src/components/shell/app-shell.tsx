import { Link } from "@tanstack/react-router"
import { Anchor } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils.ts"
import { m } from "@/paraglide/messages.js"
import { LanguageSwitch } from "./language-switch.tsx"
import { sections } from "./sections.ts"
import type { Section, SectionBadges } from "./sections.ts"
import { ThemeSwitch } from "./theme-switch.tsx"

/**
 * Ballast's frame: a slim rail on tablet and desktop, a top bar and a bottom
 * tab bar on phones. Sections that aren't built yet are greyed and not links.
 */
const noBadges: SectionBadges = {}

export function AppShell({
  badges = noBadges,
  children,
}: Readonly<{ badges?: SectionBadges; children: ReactNode }>) {
  return (
    <div className="min-h-dvh md:flex">
      <Rail badges={badges} />
      <div className="min-w-0 flex-1">
        <PhoneTopBar />
        {children}
      </div>
      <TabBar badges={badges} />
    </div>
  )
}

function Mark({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={cn("flex items-center gap-2 font-black tracking-tight text-primary", className)}
    >
      <Anchor className="size-5" aria-hidden />
      Ballast
    </span>
  )
}

function Rail({ badges }: Readonly<{ badges: SectionBadges }>) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 text-sidebar-foreground md:flex">
      <Mark className="px-3 text-lg" />
      <nav aria-label={m.sections()} className="mt-8">
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.key}>
              <SectionItem
                section={section}
                badge={badges[section.key]}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium"
                activeClassName="data-[status=active]:bg-card data-[status=active]:font-semibold data-[status=active]:text-primary data-[status=active]:shadow-sm"
              >
                <section.icon className="size-5" aria-hidden />
                <span className="flex-1">{section.label()}</span>
              </SectionItem>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto space-y-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <span aria-hidden className="text-xs font-medium text-muted-foreground">
            {m.theme()}
          </span>
          <ThemeSwitch />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span aria-hidden className="text-xs font-medium text-muted-foreground">
            {m.language()}
          </span>
          <LanguageSwitch />
        </div>
      </div>
    </aside>
  )
}

function PhoneTopBar() {
  return (
    <header className="flex items-center justify-between gap-4 px-5 pt-4 md:hidden">
      <Mark />
      <div className="flex items-center gap-2">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </header>
  )
}

function TabBar({ badges }: Readonly<{ badges: SectionBadges }>) {
  return (
    <nav
      aria-label={m.sections()}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {sections.map((section) => (
          <li key={section.key}>
            <SectionItem
              section={section}
              badge={badges[section.key]}
              className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium"
              activeClassName="data-[status=active]:font-semibold data-[status=active]:text-primary"
              badgeClassName="absolute top-1 right-[18%] min-w-4 px-1 text-[10px] leading-4"
            >
              <section.icon className="size-5" aria-hidden />
              <span className="max-w-full truncate">{section.shortLabel()}</span>
            </SectionItem>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** A built section is a link; an unbuilt one is greyed text. Either may carry a count badge. */
function SectionItem({
  section,
  badge,
  className,
  activeClassName,
  badgeClassName,
  children,
}: Readonly<{
  section: Section
  badge: number | undefined
  className: string
  /** Styles for the current section, as `data-[status=active]:` variants. */
  activeClassName: string
  badgeClassName?: string
  children: ReactNode
}>) {
  const badgeElement = badge !== undefined && badge > 0 && (
    <span
      className={cn(
        "min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-bold text-primary-foreground",
        badgeClassName,
      )}
    >
      {badge}
      <span className="sr-only"> {m.section_badge_waiting()}</span>
    </span>
  )

  if (section.to === undefined) {
    return (
      <span
        aria-disabled="true"
        title={m.section_coming_later({ section: section.label() })}
        className={cn(className, "cursor-default text-inactive")}
      >
        {children}
        {badgeElement}
      </span>
    )
  }

  return (
    <Link
      to={section.to}
      activeOptions={{ exact: true }}
      className={cn(
        className,
        "text-muted-foreground transition-colors outline-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2",
        activeClassName,
      )}
    >
      {children}
      {badgeElement}
    </Link>
  )
}
