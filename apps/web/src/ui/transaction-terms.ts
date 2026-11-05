import type { AccountRole, Direction } from "@ballast/core"
import { m } from "@/paraglide/messages.js"

/** How the Transaction dialog speaks about one Role's Transactions. */
interface TransactionTerms {
  /** What adding one is for. */
  readonly addDescription: () => string
  /** An example description for each direction, shown in the description field. */
  readonly example: Record<Direction, () => string>
  /** The empty state's body, where the Account has nothing but Transactions. */
  readonly emptyBody: () => string
  /** The direction a new Transaction starts with: the most common one for the Role. */
  readonly defaultDirection: Direction
}

const terms: Record<AccountRole, TransactionTerms> = {
  operating_cash: {
    addDescription: m.add_transaction_description,
    example: {
      outflow: m.transaction_example_operating_cash_outflow,
      inflow: m.transaction_example_operating_cash_inflow,
    },
    emptyBody: m.no_transactions_body,
    defaultDirection: "outflow",
  },
  reserve: {
    addDescription: m.add_transaction_description_reserve,
    example: {
      outflow: m.transaction_example_reserve_outflow,
      inflow: m.transaction_example_reserve_inflow,
    },
    emptyBody: m.no_transactions_body,
    defaultDirection: "inflow",
  },
  investment: {
    addDescription: m.add_transaction_description_investment,
    example: {
      outflow: m.transaction_example_investment_outflow,
      inflow: m.transaction_example_investment_inflow,
    },
    emptyBody: m.no_investment_transactions_body,
    defaultDirection: "inflow",
  },
  liability: {
    addDescription: m.add_transaction_description_liability,
    example: {
      outflow: m.transaction_example_liability_outflow,
      inflow: m.transaction_example_liability_inflow,
    },
    emptyBody: m.no_transactions_body_liability,
    defaultDirection: "outflow",
  },
}

/** The wording and defaults for Transactions on an Account with this Role. */
export const transactionTerms = (role: AccountRole): TransactionTerms => terms[role]
