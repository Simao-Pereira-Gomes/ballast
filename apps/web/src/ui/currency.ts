import { Money } from "@ballast/core"

export const currencyOptions = Money.currencies.map((currency) => ({
  value: currency,
  label: currency,
}))
