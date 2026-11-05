import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AccountsPage } from "../components/accounts/accounts-page.tsx"
import type { AccountFormDetails } from "../components/accounts/account-dialog.tsx"
import { getAccounts, openAccount } from "../server/functions/accounts.ts"

export const Route = createFileRoute("/")({
  loader: () => getAccounts(),
  component: AccountsRoute,
})

function AccountsRoute() {
  const { active, archived } = Route.useLoaderData()
  const router = useRouter()
  const open = useServerFn(openAccount)

  const onOpenAccount = async (details: AccountFormDetails) => {
    const result = await open({ data: details })
    if (result.ok) await router.invalidate()
    return result
  }

  return (
    <AccountsPage accounts={active} archivedAccounts={archived} onOpenAccount={onOpenAccount} />
  )
}
