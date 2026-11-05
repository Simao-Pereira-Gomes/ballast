import { InterestRate, Share, Units } from "@ballast/core"
import type { AssetClass, AssetClassSlice, HoldingKind } from "@ballast/core"
import { m } from "@/paraglide/messages.js"
import { getLocale } from "@/paraglide/runtime.js"

const labels: Record<AssetClass, () => string> = {
  equity: m.asset_class_equity,
  bonds: m.asset_class_bonds,
  cash: m.asset_class_cash,
  crypto: m.asset_class_crypto,
  other: m.asset_class_other,
}

/** A stock is always equity, so only the other kinds offer a choice of class. */
type ClassChoosingKind = Exclude<HoldingKind, "stock">

const descriptions: Record<ClassChoosingKind, Record<AssetClass, () => string>> = {
  index_fund: {
    equity: m.asset_class_equity_in_index_fund,
    bonds: m.asset_class_bonds_in_index_fund,
    cash: m.asset_class_cash_in_index_fund,
    crypto: m.asset_class_crypto_in_index_fund,
    other: m.asset_class_other_in_index_fund,
  },
  other: {
    equity: m.asset_class_equity_in_other,
    bonds: m.asset_class_bonds_in_other,
    cash: m.asset_class_cash_in_other,
    crypto: m.asset_class_crypto_in_other,
    other: m.asset_class_other_in_other,
  },
}

/** The asset class colour token as a background, for the Asset Mix bar. Always shown with its name. */
export const assetClassColour: Record<AssetClass, string> = {
  equity: "bg-asset-equity",
  bonds: "bg-asset-bonds",
  cash: "bg-asset-cash",
  crypto: "bg-asset-crypto",
  other: "bg-asset-other",
}

/** The asset class's name in the interface language. */
export const assetClassLabel = (assetClass: AssetClass): string => labels[assetClass]()

/** What a Holding of this kind in the asset class looks like, e.g. an index of shares. */
export const assetClassDescription = (kind: ClassChoosingKind, assetClass: AssetClass): string =>
  descriptions[kind][assetClass]()

/** A rate in the interface language, e.g. "18,5%" (pt-PT). */
export const formatInterestRate = (rate: InterestRate.InterestRate): string =>
  InterestRate.format(rate, getLocale())

/** A rate as the Owner would type it into the rate field, e.g. "18,5" (pt-PT). */
export const interestRateForInput = (rate: InterestRate.InterestRate): string =>
  InterestRate.formatForInput(rate, getLocale())

/** A share in the interface language, e.g. "25,5%" (pt-PT). */
export const formatShare = (share: Share.Share): string => Share.format(share, getLocale())

/** A quantity of units in the interface language, e.g. "1234,5" (pt-PT). */
export const formatUnits = (units: Units.Units): string => Units.format(units, getLocale())

/** Units as the Owner would type them into the units field, e.g. "12,5" (pt-PT). */
export const unitsForInput = (units: Units.Units): string =>
  Units.formatForInput(units, getLocale())

/** The Asset Mix, already largest first, e.g. "80% Equity · 20% Bonds". */
export const assetMixSummary = (mix: readonly AssetClassSlice[]): string =>
  mix
    .map((slice) =>
      m.asset_share({
        share: formatShare(slice.share),
        assetClass: assetClassLabel(slice.assetClass),
      }),
    )
    .join(" · ")
