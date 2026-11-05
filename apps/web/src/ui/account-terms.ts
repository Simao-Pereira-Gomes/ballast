import { InterestRate, assetClasses } from "@ballast/core"
import type { AssetClass, AssetMix } from "@ballast/core"
import { m } from "@/paraglide/messages.js"
import { getLocale } from "@/paraglide/runtime.js"

const labels: Record<AssetClass, () => string> = {
  equity: m.asset_class_equity,
  bonds: m.asset_class_bonds,
  cash: m.asset_class_cash,
  crypto: m.asset_class_crypto,
  other: m.asset_class_other,
}

const descriptions: Record<AssetClass, () => string> = {
  equity: m.asset_class_equity_description,
  bonds: m.asset_class_bonds_description,
  cash: m.asset_class_cash_description,
  crypto: m.asset_class_crypto_description,
  other: m.asset_class_other_description,
}

/** The asset class's name in the interface language. */
export const assetClassLabel = (assetClass: AssetClass): string => labels[assetClass]()

/** What counts towards the asset class, e.g. which ETFs. */
export const assetClassDescription = (assetClass: AssetClass): string => descriptions[assetClass]()

/** A rate in the interface language, e.g. "18,5%" (pt-PT). */
export const formatInterestRate = (rate: InterestRate.InterestRate): string =>
  InterestRate.format(rate, getLocale())

/** A rate as the Owner would type it into the rate field, e.g. "18,5" (pt-PT). */
export const interestRateForInput = (rate: InterestRate.InterestRate): string =>
  InterestRate.formatForInput(rate, getLocale())

/** The asset classes in the mix, largest first, e.g. "80% Equity · 20% Bonds". */
export const assetMixSummary = (mix: AssetMix): string =>
  assetClasses
    .filter((assetClass) => mix[assetClass] > 0)
    .toSorted((a, b) => mix[b] - mix[a])
    .map((assetClass) =>
      m.asset_share({ percent: mix[assetClass], assetClass: assetClassLabel(assetClass) }),
    )
    .join(" · ")
