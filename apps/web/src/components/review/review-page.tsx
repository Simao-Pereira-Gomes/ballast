import { Inbox } from "lucide-react"
import { useState } from "react"
import { CompactEmpty } from "@/components/shell/compact-empty.tsx"
import { Button } from "@/components/ui/button.tsx"
import { m } from "@/paraglide/messages.js"
import type { ReviewItem } from "@/server/functions/review.ts"
import { formatDay, formatMoney } from "@/ui/format.ts"

/** What deciding a suggestion can come back with: it worked, or it was no longer there. */
export type DecisionOutcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: "gone" }

interface Pair {
  readonly manualId: string
  readonly importedId: string
}

/**
 * The Review Queue: everything awaiting the Owner's confirmation. For now
 * that is suggested Matches, grouped by Account, each showing the Owner's
 * entry beside the bank's line with Confirm and Reject.
 */
export function ReviewPage({
  items,
  accounts,
  onConfirm,
  onReject,
}: Readonly<{
  items: readonly ReviewItem[]
  accounts: readonly { id: string; name: string }[]
  onConfirm: (pair: Pair) => Promise<DecisionOutcome>
  onReject: (pair: Pair) => Promise<DecisionOutcome>
}>) {
  const [busy, setBusy] = useState<string | undefined>()
  const [gone, setGone] = useState(false)

  async function decide(item: ReviewItem, action: (pair: Pair) => Promise<DecisionOutcome>) {
    setBusy(`${item.manual.id}:${item.imported.id}`)
    setGone(false)
    try {
      const outcome = await action({ manualId: item.manual.id, importedId: item.imported.id })
      if (!outcome.ok) setGone(true)
    } finally {
      setBusy(undefined)
    }
  }

  const groups = accounts
    .map((account) => ({ account, items: items.filter((item) => item.accountId === account.id) }))
    .filter((group) => group.items.length > 0)

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-6 pb-28 md:pt-10">
      <h1 className="text-2xl font-black tracking-tight">{m.review_title()}</h1>
      {gone && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground"
        >
          {m.review_match_gone()}
        </p>
      )}
      {groups.length === 0 ? (
        <div className="mt-6">
          <CompactEmpty
            icon={<Inbox className="size-5" aria-hidden />}
            title={m.review_empty_title()}
            body={m.review_empty_body()}
          />
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{m.review_matches_intro()}</p>
          {groups.map(({ account, items: groupItems }) => (
            <section key={account.id} className="mt-8" aria-labelledby={`review-${account.id}`}>
              <h2 id={`review-${account.id}`} className="text-lg font-semibold">
                {account.name}
              </h2>
              <ul className="mt-3 space-y-3">
                {groupItems.map((item) => {
                  const key = `${item.manual.id}:${item.imported.id}`
                  return (
                    <li key={key} className="rounded-3xl bg-card p-5 shadow-sm">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Side
                          label={m.review_match_manual()}
                          description={item.manual.description}
                          date={formatDay(item.manual.date)}
                          amount={formatMoney(item.manual.amount)}
                        />
                        <Side
                          label={m.review_match_bank()}
                          description={item.imported.description}
                          date={formatDay(item.imported.date)}
                          amount={formatMoney(item.imported.amount)}
                        />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {daysApart(item.daysApart)} {m.review_match_keeps()}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          disabled={busy !== undefined}
                          onClick={() => void decide(item, onConfirm)}
                        >
                          {m.review_match_confirm()}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busy !== undefined}
                          onClick={() => void decide(item, onReject)}
                        >
                          {m.review_match_reject()}
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  )
}

function daysApart(days: number): string {
  if (days === 0) return m.review_match_same_day()
  if (days === 1) return m.review_match_one_day()
  return m.review_match_days({ days })
}

function Side({
  label,
  description,
  date,
  amount,
}: Readonly<{ label: string; description: string; date: string; amount: string }>) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 truncate font-semibold">{description}</p>
      <p className="text-sm text-muted-foreground">
        {date} · {amount}
      </p>
    </div>
  )
}
