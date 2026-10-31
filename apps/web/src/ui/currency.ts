import { Money } from "@ballast/core"

/** The currency a new Account gets. EUR is the only one supported today. */
export const defaultCurrency: string = Money.currencies[0] ?? "EUR"
