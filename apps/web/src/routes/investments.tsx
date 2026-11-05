import { createFileRoute } from "@tanstack/react-router"
import { InvestmentsPage } from "../components/holdings/investments-page.tsx"
import { getInvestmentOverview } from "../server/functions/holdings.ts"

export const Route = createFileRoute("/investments")({
  loader: () => getInvestmentOverview(),
  component: InvestmentsRoute,
})

function InvestmentsRoute() {
  const { accounts, overall, concentrated } = Route.useLoaderData()
  return <InvestmentsPage accounts={accounts} overall={overall} concentrated={concentrated} />
}
