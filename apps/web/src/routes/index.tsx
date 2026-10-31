import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AccountsPage } from "../components/accounts/accounts-page.tsx"
import type { OpenAccountDetails } from "../components/accounts/open-account-dialog.tsx"
import { getAccounts, openAccount } from "../server/functions/accounts.ts"

export const Route = createFileRoute("/")({
  loader: () => getAccounts(),
  component: AccountsRoute,
})

function AccountsRoute() {
  const accounts = Route.useLoaderData()
  const router = useRouter()
  const open = useServerFn(openAccount)

  const onOpenAccount = async (details: OpenAccountDetails) => {
    const result = await open({ data: details })
    if (result.ok) await router.invalidate()
    return result
  }

  return <AccountsPage accounts={accounts} onOpenAccount={onOpenAccount} />
}
