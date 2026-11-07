import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { AccountLedgerPage } from "../components/transactions/account-ledger-page.tsx"
import { archiveAccount, changeAccount, unarchiveAccount } from "../server/functions/accounts.ts"
import { addHolding, changeHolding, removeHolding } from "../server/functions/holdings.ts"
import { importStatement } from "../server/functions/imports.ts"
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
  const { account, transactions, holdings } = Route.useLoaderData()
  const router = useRouter()
  const add = useServerFn(addTransaction)
  const edit = useServerFn(editTransaction)
  const remove = useServerFn(deleteTransaction)
  const importFile = useServerFn(importStatement)
  const change = useServerFn(changeAccount)
  const archive = useServerFn(archiveAccount)
  const unarchive = useServerFn(unarchiveAccount)
  const addHoldingFn = useServerFn(addHolding)
  const changeHoldingFn = useServerFn(changeHolding)
  const removeHoldingFn = useServerFn(removeHolding)

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
      holdings={holdings}
      onAdd={async (details) =>
        refreshAfter(await add({ data: { accountId: account.id, ...details } }))
      }
      onEdit={async (transaction, details) =>
        refreshAfter(await edit({ data: { transactionId: transaction.id, ...details } }))
      }
      onDelete={async (transaction) =>
        refreshAfter(await remove({ data: { transactionId: transaction.id } }))
      }
      onImport={async (file) => {
        const data = new FormData()
        data.set("accountId", account.id)
        data.set("file", file)
        return refreshAfter(await importFile({ data }))
      }}
      onAddHolding={async (details) =>
        refreshAfter(await addHoldingFn({ data: { accountId: account.id, ...details } }))
      }
      onChangeHolding={async (holding, details) =>
        refreshAfter(await changeHoldingFn({ data: { holdingId: holding.id, ...details } }))
      }
      onRemoveHolding={async (holding) =>
        refreshAfter(await removeHoldingFn({ data: { holdingId: holding.id } }))
      }
      onChangeAccount={async ({ currency: _currency, ...changes }) =>
        refreshAfter(await change({ data: { accountId: account.id, ...changes } }))
      }
      onArchive={async () => {
        await archive({ data: { accountId: account.id } })
        await router.invalidate()
      }}
      onUnarchive={async () => {
        await unarchive({ data: { accountId: account.id } })
        await router.invalidate()
      }}
    />
  )
}
