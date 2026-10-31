import { accountRoles } from "@ballast/core"
import type { AccountRole } from "@ballast/core"

export const accountRoleLabels: Record<AccountRole, string> = {
  operating_cash: "Operating Cash",
  reserve: "Reserve",
  investment: "Investment",
  liability: "Liability",
}

/** Account Roles in the order a form offers them. */
export const accountRoleOptions = accountRoles.map((role) => ({
  value: role,
  label: accountRoleLabels[role],
}))
