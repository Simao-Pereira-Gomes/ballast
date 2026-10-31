import { ArrowLeftRight, Inbox, PieChart, TrendingUp, Wallet } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { m } from "@/paraglide/messages.js"

/** A top-level section of Ballast, as the rail and the tab bar show it. */
export interface Section {
  readonly key: SectionKey
  readonly label: () => string
  readonly shortLabel: () => string
  readonly icon: LucideIcon
  readonly to?: "/"
}

export type SectionKey = "accounts" | "transactions" | "review" | "forecast" | "allocation"

export const sections: readonly Section[] = [
  {
    key: "accounts",
    label: () => m.section_accounts(),
    shortLabel: () => m.section_accounts_short(),
    icon: Wallet,
    to: "/",
  },
  {
    key: "transactions",
    label: () => m.section_transactions(),
    shortLabel: () => m.section_transactions_short(),
    icon: ArrowLeftRight,
  },
  {
    key: "review",
    label: () => m.section_review(),
    shortLabel: () => m.section_review_short(),
    icon: Inbox,
  },
  {
    key: "forecast",
    label: () => m.section_forecast(),
    shortLabel: () => m.section_forecast_short(),
    icon: TrendingUp,
  },
  {
    key: "allocation",
    label: () => m.section_allocation(),
    shortLabel: () => m.section_allocation_short(),
    icon: PieChart,
  },
]

/** Count badges per section, e.g. how many items wait in the Review Queue. */
export type SectionBadges = Partial<Record<SectionKey, number>>
