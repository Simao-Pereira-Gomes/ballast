import { ArrowLeftRight, Inbox, PieChart, TrendingUp, Wallet } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/** A top-level section of Ballast, as the rail and the tab bar show it. */
export interface Section {
  readonly key: SectionKey
  readonly label: string
  readonly short: string
  readonly icon: LucideIcon
  readonly to?: "/"
}

export type SectionKey = "accounts" | "transactions" | "review" | "forecast" | "allocation"

export const sections: readonly Section[] = [
  { key: "accounts", label: "Accounts", short: "Accounts", icon: Wallet, to: "/" },
  { key: "transactions", label: "Transactions", short: "Activity", icon: ArrowLeftRight },
  { key: "review", label: "Review Queue", short: "Review", icon: Inbox },
  { key: "forecast", label: "Forecast", short: "Forecast", icon: TrendingUp },
  { key: "allocation", label: "Allocation", short: "Allocation", icon: PieChart },
]

export type SectionBadges = Partial<Record<SectionKey, number>>
