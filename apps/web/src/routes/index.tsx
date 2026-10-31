import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import type { SubmitEvent } from "react"
import { getAccounts, openAccount } from "../server/functions/accounts.ts"
import type { Problem } from "../server/functions/accounts.ts"
import { accountRoleLabels, accountRoleOptions } from "../ui/account-role.ts"
import { currencyOptions } from "../ui/currency.ts"

export const Route = createFileRoute("/")({
  loader: () => getAccounts(),
  component: AccountsPage,
})

function AccountsPage() {
  const accounts = Route.useLoaderData()

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Accounts</h1>

      <section aria-labelledby="accounts-heading" className="mt-6">
        <h2 id="accounts-heading" className="sr-only">
          Your Accounts
        </h2>
        {accounts.length === 0 ? (
          <p className="text-slate-600">No Accounts yet. Open your first one below.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{account.name}</span>
                <span className="text-sm text-slate-600">
                  {accountRoleLabels[account.role]} · {account.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <OpenAccountForm />
    </main>
  )
}

const textField = (fields: FormData, name: string): string => {
  const value = fields.get(name)
  return typeof value === "string" ? value : ""
}

function OpenAccountForm() {
  const router = useRouter()
  const open = useServerFn(openAccount)
  const [problems, setProblems] = useState<readonly Problem[]>([])
  const [submitting, setSubmitting] = useState(false)

  const problemFor = (field: string) => problems.find((problem) => problem.field === field)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setSubmitting(true)
    try {
      const result = await open({
        data: {
          name: textField(fields, "name"),
          role: textField(fields, "role"),
          currency: textField(fields, "currency"),
        },
      })
      if (result.ok) {
        setProblems([])
        form.reset()
        await router.invalidate()
      } else {
        setProblems(result.problems)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const nameProblem = problemFor("name")
  const roleProblem = problemFor("role")

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      aria-labelledby="open-account-heading"
    >
      <h2 id="open-account-heading" className="text-lg font-semibold">
        Open an Account
      </h2>

      <div>
        <label htmlFor="account-name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="account-name"
          name="name"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          aria-invalid={nameProblem !== undefined}
          aria-describedby={nameProblem ? "account-name-problem" : undefined}
        />
        {nameProblem && (
          <p id="account-name-problem" className="mt-1 text-sm text-red-700">
            {nameProblem.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="account-role" className="block text-sm font-medium">
          Account Role
        </label>
        <select
          id="account-role"
          name="role"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          aria-invalid={roleProblem !== undefined}
          aria-describedby={roleProblem ? "account-role-problem" : undefined}
        >
          <option value="" disabled>
            Choose a role
          </option>
          {accountRoleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {roleProblem && (
          <p id="account-role-problem" className="mt-1 text-sm text-red-700">
            {roleProblem.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="account-currency" className="block text-sm font-medium">
          Currency
        </label>
        <select
          id="account-currency"
          name="currency"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        >
          {currencyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Opening…" : "Open Account"}
      </button>
    </form>
  )
}
