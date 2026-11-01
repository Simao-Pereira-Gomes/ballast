import type { AccountRole } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

const labels: Record<AccountRole, () => string> = {
  operating_cash: m.role_operating_cash,
  reserve: m.role_reserve,
  investment: m.role_investment,
  liability: m.role_liability,
}

const descriptions: Record<AccountRole, () => string> = {
  operating_cash: m.role_operating_cash_description,
  reserve: m.role_reserve_description,
  investment: m.role_investment_description,
  liability: m.role_liability_description,
}

/** The role's name in the interface language (CONTEXT.md terms). */
export const accountRoleLabel = (role: AccountRole): string => labels[role]()

/** One line on what the role is for, shown when the Owner picks one. */
export const accountRoleDescription = (role: AccountRole): string => descriptions[role]()

/** The role colour token as a background, for dots. Always shown next to the role name. */
export const accountRoleDot: Record<AccountRole, string> = {
  operating_cash: "bg-role-operating-cash",
  reserve: "bg-role-reserve",
  investment: "bg-role-investment",
  liability: "bg-role-liability",
}
