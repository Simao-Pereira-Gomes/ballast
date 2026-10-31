import type { AccountRole } from "@ballast/core"
import { cn } from "@/lib/utils.ts"
import { accountRoleDot } from "@/ui/account-role.ts"

/** A role's colour dot. Decorative: the role name always sits next to it. */
export function RoleDot({ role, className }: Readonly<{ role: AccountRole; className?: string }>) {
  return (
    <span aria-hidden className={cn("shrink-0 rounded-full", accountRoleDot[role], className)} />
  )
}
