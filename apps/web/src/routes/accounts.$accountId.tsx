import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AccountLedgerPage } from "../components/transactions/account-ledger-page.tsx"
import {
  addTransaction,
  deleteTransaction,
  editTransaction,
  getAccountLedger,
} from "../server/functions/transactions.ts"

export const Route = createFileRoute("/accounts/$accountId")({
  loader: ({ params }) => getAccountLedger({ data: { accountId: params.accountId } }),
  component: AccountLedgerRoute,
})

function AccountLedgerRoute() {
  const { account, transactions } = Route.useLoaderData()
  const router = useRouter()
  const add = useServerFn(addTransaction)
  const edit = useServerFn(editTransaction)
  const remove = useServerFn(deleteTransaction)

  return (
    <AccountLedgerPage
      account={account}
      transactions={transactions}
      onAdd={async (details) => {
        const result = await add({ data: { accountId: account.id, ...details } })
        if (result.ok) await router.invalidate()
        return result
      }}
      onEdit={async (transaction, details) => {
        const result = await edit({ data: { transactionId: transaction.id, ...details } })
        if (result.ok) await router.invalidate()
        return result
      }}
      onDelete={async (transaction) => {
        await remove({ data: { transactionId: transaction.id } })
        await router.invalidate()
      }}
    />
  )
}
