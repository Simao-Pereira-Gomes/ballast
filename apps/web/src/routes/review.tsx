import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ReviewPage } from "../components/review/review-page.tsx"
import { confirmMatch, getReviewQueue, rejectMatch } from "../server/functions/review.ts"

export const Route = createFileRoute("/review")({
  loader: () => getReviewQueue(),
  component: ReviewRoute,
})

function ReviewRoute() {
  const { items, accounts } = Route.useLoaderData()
  const router = useRouter()
  const confirm = useServerFn(confirmMatch)
  const reject = useServerFn(rejectMatch)

  // A suggestion that has gone (decided in another tab, or its Transactions changed) needs a fresh queue too.
  const decide =
    (action: typeof confirm) => async (pair: { manualId: string; importedId: string }) => {
      const result = await action({ data: pair })
      await router.invalidate()
      return result.ok ? ({ ok: true } as const) : ({ ok: false, reason: "gone" } as const)
    }

  return (
    <ReviewPage
      items={items}
      accounts={accounts}
      onConfirm={decide(confirm)}
      onReject={decide(reject)}
    />
  )
}
