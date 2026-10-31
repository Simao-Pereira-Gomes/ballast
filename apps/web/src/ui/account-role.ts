import { accountRoles } from "@ballast/core"
import type { AccountRole } from "@ballast/core"

export const accountRoleLabels: Record<AccountRole, string> = {
  operating_cash: "Operating Cash",
  reserve: "Reserve",
  investment: "Investment",
  liability: "Liability",
}

/** One line on what each role is for, shown when the Owner picks one. */
export const accountRoleDescriptions: Record<AccountRole, string> = {
  operating_cash: "Day-to-day money for bills and other Expenses.",
  reserve: "Your safety reserve. Counts towards the Reserve Target.",
  investment: "Money invested for the long term.",
  liability: "Debt you owe, such as cards and loans.",
}

/** The role colour token as a background, for dots. Always shown next to the role name. */
export const accountRoleDot: Record<AccountRole, string> = {
  operating_cash: "bg-role-operating-cash",
  reserve: "bg-role-reserve",
  investment: "bg-role-investment",
  liability: "bg-role-liability",
}

/** Account Roles in the order a form offers them. */
export const accountRoleOptions = accountRoles.map((role) => ({
  value: role,
  label: accountRoleLabels[role],
  description: accountRoleDescriptions[role],
}))
