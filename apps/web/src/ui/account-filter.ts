import type { AccountRole } from "@ballast/core"

/** A filter chip's value: one Account Role, or every Account. */
export type RoleFilter = AccountRole | "all"

export const countByRole = (
  accounts: readonly { readonly role: AccountRole }[],
): Record<AccountRole, number> => {
  const counts: Record<AccountRole, number> = {
    operating_cash: 0,
    reserve: 0,
    investment: 0,
    liability: 0,
  }
  for (const account of accounts) counts[account.role] += 1
  return counts
}

export const accountsWithRole = <A extends { readonly role: AccountRole }>(
  accounts: readonly A[],
  filter: RoleFilter,
): readonly A[] =>
  filter === "all" ? accounts : accounts.filter((account) => account.role === filter)
