# PRD 0001: Ballast v1

## Problem Statement

I have a salary, a current account, a savings account and (sometimes) investments, but no reliable answer to three questions:

1. **Where is my money actually going?** My bank shows a list of lines, but card bill payments, moves to savings and brokerage contributions look like spending, refunds look like income, and nothing tells me which costs are essential.
2. **How much will I save over the coming months?** Annual bills (insurance, IUC, IMI), the subsídio de férias and de Natal, and slowly rising costs make month-to-month savings hard to predict.
3. **How much should stay in the bank and how much should I invest?** I know the "3–6 months of expenses" rule exists, but not which number applies to me, whether my current-account balance counts, whether to clear debt first, or whether to use a PPR before an ordinary brokerage account.

Existing tools either budget (envelope-style, daily data entry) or track investments, and none combine my real spending history with mainstream, explainable Portuguese guidance about reserves and investing.

## Solution

**Ballast** is a self-hosted web app (running on my own machine) that:

- **Imports** my bank exports (Santander Portugal first) and accepts manual entries, deduplicating overlaps and checking every Import against the bank-stated balance.
- Classifies each **Transaction** into **Categories** with an **Essential** flag, recognises **Transfers** between my own **Accounts** and **Refunds**, and learns **Categorisation Rules** from my corrections. Anything uncertain goes to a single **Review Queue**.
- Produces a 12-month **Forecast** of **Revenue**, **Expenses** and **Net Savings** from confirmed **Recurring Items** plus recent **Variable Spending** trends.
- Applies a configurable, versioned **Rule Set** (Portuguese/EU defaults) and my **Financial Profile** to compute a **Reserve Target** and run the **Allocation Waterfall**: Operating Cash → Starter Reserve → High-Interest Debt → Reserve → **Investable Surplus**.
- Shows a live **Allocation Status** and issues monthly, stored **Recommendations** ("transfer €400 to PPR, €800 to brokerage") that name **Wrappers** and asset classes, never products. Each Recommendation is tracked against the Transfers I actually make.
- Explains every number: why a Transaction got its Category, how the Reserve Target was derived, and which Rule Set version produced a Recommendation.

All terms in bold are defined in `CONTEXT.md`, and the code uses them exactly.

## User Stories

### Owner and Accounts

1. As the Owner, I want all my data to belong to me as an explicit Owner, so that Ballast can support more people later without restructuring my data.
2. As the Owner, I want to create Accounts (current, savings, credit card, brokerage, PPR, loans), so that every Transaction has a home.
3. As the Owner, I want to assign each Account a Role (Operating Cash, Reserve, Investment, Liability), so that advice knows what each Account's money is for.
4. As the Owner, I want to change an Account's Role later, so that advice follows how I actually use the Account.
5. As the Owner, I want to record each Account's currency (EUR in v1), so that foreign-currency Accounts can be added later without a migration.
6. As the Owner, I want to record the interest rate on a Liability, so that Ballast can tell whether it is High-Interest Debt.
7. As the Owner, I want to tag an Investment Account with its asset-class mix (e.g. 100% equity), so that Ballast can compare my Investments to the Target Allocation.
8. As the Owner, I want to archive an Account I closed, so that its history remains but it no longer appears in advice.

### Import

9. As the Owner, I want to upload a Santander Portugal export file, so that I don't type Transactions by hand.
10. As the Owner, I want the Import to tell me how many Transactions were new and how many were already imported, so that I trust overlapping exports are safe.
11. As the Owner, I want two genuinely identical lines in one file (two €1.20 coffees on the same day) both kept, so that real spending isn't lost to deduplication.
12. As the Owner, I want the bank's own transaction ID to be used for deduplication when the export provides one, so that deduplication is as precise as possible.
13. As the Owner, I want each Import to record the bank-stated balance as a Balance Checkpoint, so that missing or duplicated Transactions are detected.
14. As the Owner, I want a visible Balance Discrepancy when my Transactions don't sum to the bank's balance, so that I know my numbers are wrong before trusting advice.
15. As the Owner, I want a clear error that names the problem when a file isn't a recognised format, so that I know whether I exported the wrong thing.
16. As the Owner, I want to see a history of my Imports and undo one, so that a wrong file can be reverted cleanly.
17. As the Owner, I want bank descriptions normalised (whitespace, card numbers, casing), so that Categorisation Rules match reliably.

### Manual entry and Matches

18. As the Owner, I want to enter a Transaction manually (e.g. cash), so that money outside bank exports is tracked.
19. As the Owner, I want a manual entry that later arrives in an Import offered as a Match, so that it isn't counted twice.
20. As the Owner, I want a confirmed Match to keep my Category and notes but take the bank's date and amount, so that the bank stays authoritative while my work is preserved.
21. As the Owner, I want to edit or delete a manual Transaction, so that I can fix mistakes.

### Classification

22. As the Owner, I want a starter Category hierarchy (Housing › Rent, Food › Groceries, etc.), so that I don't start from nothing.
23. As the Owner, I want to add, rename, move and remove Categories, so that the hierarchy fits my life.
24. As the Owner, I want each Category to carry a default Essential flag, so that Essential Expenses are identified automatically.
25. As the Owner, I want to override the Essential flag on a single Transaction, so that one-off essentials (an emergency dentist bill) are counted correctly.
26. As the Owner, I want Categorisation Rules (e.g. description contains "CONTINENTE" → Groceries) applied on Import, so that most Transactions categorise themselves.
27. As the Owner, I want to be offered a Rule when I categorise a Transaction by hand, so that Ballast learns from me.
28. As the Owner, I want to see which Rule categorised a Transaction, so that I can fix a bad Rule rather than individual Transactions.
29. As the Owner, I want to re-apply Rules to past Transactions after editing a Rule, so that history stays consistent.
30. As the Owner, I want a Refund recorded as a negative Expense in the original Category, so that refunds don't inflate my Revenue.
31. As the Owner, I want money I send to family recorded as an Expense, so that it counts as money that left me.

### Transfers

32. As the Owner, I want Ballast to suggest Transfer pairs (same amount, opposite direction, two of my Accounts, within a few days), so that internal moves don't look like Revenue or Expenses.
33. As the Owner, I want to confirm, reject or manually create a Transfer, so that pairing errors are fixable.
34. As the Owner, I want credit card bill payments treated as Transfers and the individual card purchases as Expenses, so that spending isn't double-counted.
35. As the Owner, I want contributions to Investment Accounts recognised as Transfers, so that "how much did I invest" is computed accurately.
36. As the Owner, I want a Transfer to an Account I don't track flagged in the Review Queue, so that I decide whether it is an Expense or a missing Account.

### Review Queue

37. As the Owner, I want one Review Queue containing uncategorised Transactions, suggested Transfers, suggested Matches and suggested Recurring Items, so that I have a single place to keep data clean.
38. As the Owner, I want to clear Review Queue items in bulk (e.g. categorise all similar lines at once), so that review is fast.
39. As the Owner, I want to see how unreviewed items reduce the confidence of my Forecast and advice, so that I know when reviewing matters.

### Reporting

40. As the Owner, I want monthly totals of Revenue, Expenses and Net Savings, so that I see whether I'm saving.
41. As the Owner, I want Expenses broken down by Category and by Essential vs non-Essential, so that I know where money goes and what I could cut.
42. As the Owner, I want my savings rate (Net Savings ÷ Revenue) per month, so that I can track progress.
43. As the Owner, I want Transfers excluded from all Revenue and Expense figures, so that reports reflect reality.
44. As the Owner, I want to record Valuations for Investment Accounts, so that their current value is known.
45. As the Owner, I want market gains and losses excluded from Revenue, so that market moves don't distort my savings rate.
46. As the Owner, I want dividends and interest paid out in cash counted as Revenue, so that real cash income is captured.
47. As the Owner, I want to see my Net Worth over time, so that I see the long-term picture.

### Forecast

48. As the Owner, I want Ballast to detect Recurring Items (rent, salary, subscriptions, annual insurance, IUC, IMI) from history, so that I don't define them by hand.
49. As the Owner, I want to confirm, edit or reject detected Recurring Items, so that the Forecast uses correct amounts and dates.
50. As the Owner, I want to update a Recurring Item when it changes (rent increase), so that the Forecast reflects it immediately.
51. As the Owner, I want the subsídio de férias and de Natal forecast in their actual months, so that June and December aren't misrepresented.
52. As the Owner, I want annual and quarterly Recurring Items forecast in the month they hit, so that I see the expensive months ahead.
53. As the Owner, I want Variable Spending forecast per Category from recent trends, weighting recent months more, so that rising costs carry forward.
54. As the Owner, I want a 12-month Forecast of Revenue, Expenses and Net Savings, so that I know how much I will save.
55. As the Owner, I want to compare last month's Forecast with actuals, so that I can judge how far to trust the Forecast.
56. As the Owner, I want the Forecast to show when my Reserve will reach its target, so that I know when investing starts.

### Financial Profile and Rule Set

57. As the Owner, I want to fill in a Financial Profile (age, employment type, dependents, household incomes, manual adjustment), so that advice fits my circumstances.
58. As the Owner, I want a manual Essential Baseline estimate while I have under three months of history, so that I get provisional advice from day one.
59. As the Owner, I want provisional advice clearly labelled, so that I don't over-trust it.
60. As the Owner, I want a default Rule Set reflecting mainstream Portuguese/EU guidance, so that advice is sensible without configuration.
61. As the Owner, I want to view and adjust Rule Set parameters (reserve months, profile modifiers, Operating Cash target, debt threshold, PPR caps, Target Allocation formula), so that I control the assumptions.
62. As the Owner, I want Rule Set changes to create a new version, so that past Recommendations remain explainable.
63. As the Owner, I want the PPR deduction caps by age band to be a Rule Set parameter, so that updates to the Orçamento do Estado are a configuration change.

### Advice

64. As the Owner, I want my Reserve Target shown with its derivation (months × Essential Baseline, and why that many months), so that I understand and trust it.
65. As the Owner, I want the Essential Baseline to be the higher of the trailing 12-month actual average and the next 12-month Forecast average, so that rising costs raise my target immediately.
66. As the Owner, I want Operating Cash above its target counted toward the Reserve, so that keeping everything in one Account still gets correct advice.
67. As the Owner, I want Investment balances never counted toward the Reserve, so that my safety doesn't depend on markets.
68. As the Owner, I want a live Allocation Status showing each waterfall step's target, current amount and gap, so that I see where I stand at any moment.
69. As the Owner, I want a Starter Reserve filled before paying down High-Interest Debt, so that a small emergency doesn't push me back into debt.
70. As the Owner, I want High-Interest Debt paid down before filling the full Reserve and investing, so that I take the guaranteed return first.
71. As the Owner, I want low-interest Liabilities (mortgage) left out of paydown advice, with their payments treated as Essential Expenses, so that cheap debt isn't over-prioritised.
72. As the Owner, I want my Investable Surplus split across Wrappers, with the PPR up to its tax-deduction cap first and the rest to brokerage, so that I invest tax-efficiently.
73. As the Owner, I want a Target Allocation suggestion (equities vs bonds) based on my age, with my current Investment mix compared to it, so that I know where new money should go.
74. As the Owner, I want advice to name Wrappers and asset classes, never specific products, so that it stays generic and doesn't age badly.

### Recommendations

75. As the Owner, I want a Recommendation issued each month after my salary arrives, so that I get a concrete action list at the right moment.
76. As the Owner, I want to generate a Recommendation on demand, so that I can get advice after a bonus or windfall.
77. As the Owner, I want each Recommendation to list concrete Transfers (amount, from Account, to Account or Wrapper), so that I know exactly what to do.
78. As the Owner, I want each Recommendation to record the Rule Set version and inputs used, so that its reasoning is reproducible later.
79. As the Owner, I want my actual Transfers matched against an open Recommendation and marked followed, partially followed or ignored, so that I see whether I follow the advice.
80. As the Owner, I want a history of Recommendations and outcomes (e.g. "invested €9,600 this year as advised"), so that I see my progress.

### Platform

81. As the Owner, I want Ballast to run locally with a single command, so that my financial data never leaves my machine.
82. As the Owner, I want to back up and restore all my data, so that nothing is lost.
83. As the Owner, I want Ballast usable from a phone-sized browser, so that I can check status once it's hosted somewhere I can reach.
84. As a future second Owner, I want my data completely separate from other Owners, so that multi-Owner hosting is safe.

## Implementation Decisions

### Architecture
- TypeScript server web app with PostgreSQL, run locally via Docker Compose (ADR 0001). No authentication in v1. It binds to localhost only, and exposing it requires HTTPS plus authentication first.
- Single-entry Transactions per Account, with Transfers as explicit links and integrity enforced through Balance Checkpoints (ADR 0002). Not double-entry.
- Functional core, imperative shell: all financial logic lives in pure modules with no I/O, and Postgres, HTTP and UI form a thin shell around them.
- Money is always integer cents with an explicit currency. Floating point never touches amounts. Splits use a largest-remainder allocation so parts always sum to the whole.
- Every persisted record is scoped to an Owner from the first migration. All queries are Owner-scoped.

### Deep core modules (pure)
- **Money**: cents arithmetic, comparison, allocation and formatting in the Base Currency.
- **Statement Parser**: one adapter per bank behind a single interface that takes the raw file and returns normalised statement lines (date, amount with sign, normalised description, optional bank transaction ID) plus Balance Checkpoints. Santander Portugal is the only adapter in v1, built against a real anonymised sample export. Adapters never categorise.
- **Ledger Ingest**: given an Account's existing Transactions and a parsed statement, it returns new Transactions, skipped duplicates and any Balance Discrepancies. Fingerprint = Account + date + amount + normalised description + occurrence index within the file. The bank transaction ID takes precedence when present.
- **Classifier**: given a Transaction and the Owner's ordered Categorisation Rules, it returns Category, Essential flag and the reason (which Rule, or "manual"/"none"). It can also propose a Rule from a manual correction. Rule matching is deterministic, and the first match wins in priority order.
- **Pairing Engine**: given Transactions, it suggests Transfer pairs (opposite sign, equal amount, two different Owner Accounts, configurable day window) and Matches (manual vs imported: same Account, same amount, date within ±3 days). It returns suggestions only and never applies them.
- **Recurring Detector**: given history, it proposes Recurring Item candidates with counterparty, cadence (monthly, quarterly, yearly, or the Portuguese twice-yearly subsídio pattern), expected amount and next date.
- **Forecaster**: given history, confirmed Recurring Items and an as-of date, it returns 12 monthly projections of Revenue, Expenses (split Essential / non-Essential) and Net Savings. Recurring Items are placed on their dates. Variable Spending per Category uses a recency-weighted trailing average with a trend term. It also returns the forward 12-month Essential average used by the Essential Baseline. No seasonality or ML in v1.
- **Advisor**: given a Rule Set version, Financial Profile, balances grouped by Account Role, Liabilities with rates and the Essential Baseline, it returns an Allocation Status (per waterfall step: target, current, gap) and can produce a Recommendation (concrete Transfers across Wrappers plus Target Allocation guidance). Both carry a structured, step-by-step explanation. The waterfall order is fixed: Operating Cash → Starter Reserve → High-Interest Debt → Reserve → Investable Surplus.
- **Rule Set**: versioned, immutable parameter sets. Parameters: Operating Cash target (months of total Expenses), Starter Reserve (months of Essential Baseline), base reserve months, Financial Profile modifiers (employment type, dependents, household incomes), reserve-month cap, High-Interest Debt threshold (APR), PPR deduction rate and caps by age band, Target Allocation formula, and Reserve-eligibility notes. Editing creates a new version. The default version encodes Portuguese guidance.

### Shell modules
- **Persistence**: Owner-scoped repositories for Owners, Accounts, Imports, Transactions, Transfers, Matches, Categories, Categorisation Rules, Recurring Items, Valuations, Balance Checkpoints, Financial Profiles, Rule Set versions and Recommendations. Imports are reversible: each Transaction records the Import that created it.
- **Application services**: Import (parse → ingest → classify → pair → persist → refresh Review Queue), Review Queue aggregation, Essential Baseline computation (max of trailing-actual and Forecast averages, falling back to the manual estimate under 3 months of history and marked provisional), Recommendation issuance (on demand, or triggered by a confirmed salary Recurring Item arriving) and Recommendation follow-up matching.
- **HTTP API + web UI**: responsive browser UI over the services. The API contract is internal in v1.

### Data rules
- Revenue and Expense are derived: any Transaction not part of a Transfer is Revenue (inflow) or Expense (outflow). A Refund is an inflow categorised into an Expense Category and counted as a negative Expense.
- Market gains are the change in Valuation not explained by Transfers. They never enter Revenue, Expenses or Net Savings.
- Net Worth = Account balances + latest Valuations − Liability balances. It's for reporting only.

## Testing Decisions

- **What makes a good test:** tests exercise each module only through its public interface and assert on observable results (returned Transactions, totals, explanations), never on internal structure. Scenarios are written in the domain language from `CONTEXT.md` (e.g. "a credit card payment is a Transfer, not an Expense"). All fixtures are synthetic, and no real bank data ever goes into the repository.
- **Thorough behaviour tests for every pure core module:** Money, Statement Parser (from a synthetic file mimicking the anonymised Santander sample's structure), Ledger Ingest (overlapping Imports, identical same-day lines, bank-ID precedence, Balance Discrepancy), Classifier, Pairing Engine, Recurring Detector (including annual items and subsídio months), Forecaster and Advisor (every waterfall step, profile modifiers, debt threshold edge cases, PPR caps per age band, provisional cold start) and Rule Set versioning. These modules are pure, so the tests are fast, deterministic and need no database.
- **Integration tests for Persistence and Application services** against a real PostgreSQL in Docker. They cover Owner scoping (one Owner can never read another's data), Import undo and the end-to-end Import pipeline.
- **Thin smoke test for the HTTP API + UI:** the app boots and a basic Import-to-Allocation-Status flow works.
- **Prior art:** none yet. This is a greenfield repository, so these tests set the conventions.

## Out of Scope

- Open Banking / automatic bank sync (planned later as another Transaction source).
- Bank formats other than Santander Portugal.
- Authentication, multiple Owners in practice and hosted deployment (the model supports them, but v1 doesn't ship them).
- Multiple currencies and FX (Accounts record a currency, but only EUR is supported).
- Per-holding investment tracking and live price feeds (Valuations are per Account and entered manually or taken from exports).
- Naming specific investment products, executing trades or moving money.
- ML/LLM categorisation suggestions.
- Seasonality-aware or ML forecasting.
- Envelope-style budgeting.
- Tax filing or IRS calculation beyond the PPR deduction cap used for Wrapper advice.

## Further Notes

- **Build order (vertical slices, each usable on its own):** (1) Ledger: Owner, Accounts with Roles, Santander Import, manual entry, dedup, Balance Checkpoints. (2) Classification: Categories with Essential flag, Rules, Review Queue, Transfers, Refunds. (3) Advice: Financial Profile, default Rule Set, Essential Baseline, Reserve Target, Allocation Waterfall with Liabilities, Allocation Status. (4) Forecast: Recurring Items, Variable Spending, 12-month Forecast feeding the Essential Baseline. (5) Recommendations: Wrappers, Target Allocation, follow-up tracking, Valuations, Net Worth. Matches can move into slice 1 if convenient.
- **Prerequisite for slice 1:** an anonymised Santander Portugal export from the Owner, used to design the parser and stored outside version control. Only a synthetic fixture derived from its structure is committed.
- **Rule Set defaults** (PPR caps, reserve months, debt threshold) must be checked against current Portuguese guidance and the latest Orçamento do Estado when the Advice slice is built. They are parameters precisely because they change.
- Ballast gives generic, rules-based guidance for one person and is not regulated financial advice. If it is ever offered to other people, this needs revisiting (CMVM / MiFID II).
- Domain language: `CONTEXT.md`. Decisions: `docs/adr/0001`, `docs/adr/0002`.
