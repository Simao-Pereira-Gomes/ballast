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

  const refreshAfter = async <R extends { readonly ok: boolean; readonly reason?: string }>(
    result: R,
  ): Promise<R> => {
    if (result.ok || result.reason === "gone") await router.invalidate()
    return result
  }

  return (
    <AccountLedgerPage
      account={account}
      transactions={transactions}
      onAdd={async (details) =>
        refreshAfter(await add({ data: { accountId: account.id, ...details } }))
      }
      onEdit={async (transaction, details) =>
        refreshAfter(await edit({ data: { transactionId: transaction.id, ...details } }))
      }
      onDelete={async (transaction) =>
        refreshAfter(await remove({ data: { transactionId: transaction.id } }))
      }
    />
  )
}
