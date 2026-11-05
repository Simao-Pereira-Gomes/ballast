---
status: accepted
---

# Holdings drive the Asset Mix and the Valuation

An Investment Account's **Asset Mix** used to be typed in as whole percentages adding up to 100. That asked the Owner to do the arithmetic, went stale as soon as prices moved, and could not tell a broad index fund from three individual stocks, since both are "100% equity". Instead the Owner records the **Holdings** in each Investment Account, each with an Asset Class and a dated current value in `Money`. The Asset Mix is then **computed** from those values, per Account and across all Investment, and is never stored. The typed percentages are dropped, with no conversion, because percentages can't be turned back into amounts.

**Current value, not cost basis.** A Holding's value is what it is worth now. Allocation guidance and the Target Allocation compare current values; a mix built on what was originally paid in would hide drift after markets move.

**The Valuation is the sum of the Holdings' values.** It is not a separate figure the Holdings are checked against, so it can't disagree with them. It is as current as its oldest Holding value. The ledger balance (the sum of the Account's Transactions, i.e. its net Transfers) is unchanged, so a market gain is still the Valuation minus that balance (ADR 0002).

**Three kinds of Holding.**

- An **index fund**: an ETF or fund that names the Index it tracks. Holdings that track the same Index are added up together, compared without regard to case or spacing. The fund's own name is optional: it tells apart products tracking the same Index (fees, accumulating or distributing), but when there is only one, typing it would repeat the Index, so an unnamed index fund is called by its Index.
- A **stock**: always equity.
- **Other**: a crypto-asset, a bond, an actively managed fund, and so on.

Individual stocks above the **Concentration Limit** (10% of all Investment by default) are flagged. The limit is a named core parameter that moves into the Rule Set once the Rule Set exists. Overlapping indexes (e.g. MSCI World and S&P 500) are not detected, because that needs index composition data Ballast doesn't have.

**Ready for a price feed, without one.** A Holding may record how many **units** it holds (exact, up to 8 decimals, enough for crypto-assets) and a **ticker**. Neither is used for any calculation yet. They exist so that a later market data feed can set values as units × price. Adding that feed is a separate decision, because it brings network I/O and a third-party dependency into a local, single-Owner app (ADR 0001).

**Holdings belong only to Investment Accounts**, enforced in the database by a foreign key on `(owner_id, account_id, role)`. An Account with Holdings can't change Role until they are removed; dropping Holdings silently is too destructive. Archived Accounts keep their Holdings but are left out of the overall Investment figures.

## Consequences

- `Account` no longer carries an Asset Mix; Investment Accounts have Holdings instead. Migration 0004 drops the percentage columns.
- Recording products is not advice. Recommendations still name Wrappers and Asset Classes, never products (`CONTEXT.md`, Wrapper).
- The PRD's "per-holding investment tracking" non-goal is withdrawn; live price feeds remain out of scope.
