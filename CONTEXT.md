# Ballast

Personal finance context: tracks money coming in and going out, projects future savings, and advises how much to hold as a safety reserve versus invest.

## Language

**Owner**:
The person whose finances are being tracked. Every financial record belongs to exactly one Owner; today there is a single Owner, but nothing in the model assumes that.
_Avoid_: User, Account, Customer

**Transaction**:
A single dated movement of money on one of the Owner's accounts, with an amount and a direction. Transactions arrive either from an Import or from manual entry.
_Avoid_: Entry, movement, record

**Account**:
A place where the Owner holds money: current account, savings account, credit card, brokerage, etc. Always means a financial account, never a login.
_Avoid_: Wallet, pot

**Transfer**:
A pair of Transactions moving money between two of the Owner's own Accounts. A Transfer is never Revenue or Expense. Credit card bill payments and contributions to a brokerage are Transfers.
_Avoid_: Internal movement, self-payment

**Revenue**:
Money entering the Owner's Accounts from outside (salary, gifts received, interest, dividends paid out in cash). Market gains are not Revenue.
_Avoid_: Income (as a separate term), earnings

**Expense**:
Money leaving the Owner's Accounts to anyone outside them, including family members.
_Avoid_: Spending (as a separate term), cost, outflow

**Refund**:
Money returned by a merchant for a prior Expense. A Refund is a negative Expense in the original Category, never Revenue.
_Avoid_: Reimbursement, credit

**Category**:
A node in an editable hierarchy classifying Expenses (and Revenue) by what they are for, e.g. Housing › Rent.
_Avoid_: Tag, label, bucket

**Categorisation Rule**:
An Owner-defined pattern (e.g. description contains "CONTINENTE") that assigns a Category to matching Transactions automatically on Import. Often created from a manual correction.
_Avoid_: Filter, mapping, auto-tag

**Review Queue**:
Everything awaiting the Owner's confirmation: Transactions with no Category, suggested Transfer pairs, suggested Matches and suggested Recurring Items. Items here need the Owner's attention.
_Avoid_: Inbox, uncategorised list, to-do

**Essential Expense**:
An Expense the Owner could not reasonably stop paying during a loss of income (rent, utilities, groceries, insurance, debt payments). Essentialness is a default on the Category and can be overridden on an individual Transaction.
_Avoid_: Fixed cost, need, mandatory spending

**Recurring Item**:
A confirmed Revenue or Expense that repeats on a known cadence (monthly, quarterly, yearly) with a predictable amount, e.g. rent, salary, subsídio de férias, annual insurance. Detected from history, confirmed by the Owner.
_Avoid_: Subscription (too narrow), standing order, fixed cost

**Variable Spending**:
All Expenses not attributable to a Recurring Item; projected per Category from recent trends.
_Avoid_: Discretionary spending (that is the non-Essential dimension, not this one)

**Forecast**:
A month-by-month projection, over the next 12 months, of Revenue, Expenses and Net Savings, built from Recurring Items and Variable Spending trends.
_Avoid_: Prediction, projection (as a separate term), budget

**Net Savings**:
Revenue minus Expenses for a period. Transfers do not affect it.
_Avoid_: Savings (alone), profit, surplus

**Balance Checkpoint**:
A bank-stated balance for an Account at a point in time, typically taken from an Import, against which the sum of Transactions is checked.
_Avoid_: Snapshot, statement balance (as a separate term)

**Balance Discrepancy**:
A mismatch between a Balance Checkpoint and the balance computed from the Account's Transactions, signalling missing, duplicated or wrong Transactions.
_Avoid_: Reconciliation error, drift

**Valuation**:
A dated market value of an Investment Account. Changes in Valuation not explained by Transfers are market gains or losses, which are never Revenue or Expense.
_Avoid_: Price, mark, snapshot

**Net Worth**:
The sum of all Account balances and latest Valuations, minus Liability balances. A reporting figure only; it never feeds the Allocation Waterfall.
_Avoid_: Wealth, total balance, equity

**Match**:
A confirmed link between a manually entered Transaction and the imported Transaction representing the same real-world movement; they are merged, with the bank's data authoritative and the Owner's Category and notes kept.
_Avoid_: Merge, reconcile, duplicate

**Rule Set**:
A named, versioned collection of parameters encoding mainstream financial guidance (e.g. how many months of Essential Expenses to hold in reserve). Each Owner is advised under exactly one Rule Set; the default reflects Portuguese/EU guidance.
_Avoid_: Policy, strategy, market rules, config

**Account Role**:
What an Account is for: Operating Cash, Reserve, Investment, or Liability. Every Account has exactly one Role.
_Avoid_: Account type (the bank product), purpose

**Operating Cash**:
Liquid money set aside for the current month's Expenses, typically in a current account. Its target is about one month of total Expenses; it never counts toward the Reserve Target.
_Avoid_: Spending money, checking balance

**Reserve**:
Money held in safe, accessible Accounts (savings, withdrawable term deposits, Certificados de Aforro past lock-in) that counts toward the Reserve Target. Operating Cash above its target also counts as Reserve.
_Avoid_: Emergency fund, savings (as a noun), safety net

**Investment**:
Money held in Accounts exposed to market risk (brokerage, PPR, funds). Never counts toward the Reserve.
_Avoid_: Portfolio (as a domain term), assets

**Liability**:
An Account representing money the Owner owes (credit card carrying a balance, personal loan, car loan, mortgage), with an interest rate.
_Avoid_: Debt account, loan (as a generic term)

**High-Interest Debt**:
Liability balances whose interest rate exceeds the Rule Set's threshold. Liabilities below the threshold (e.g. a typical mortgage) are not paid down early; their payments are simply Essential Expenses.
_Avoid_: Bad debt, toxic debt

**Starter Reserve**:
A small first slice of the Reserve (e.g. one month of Essential Expenses) filled before paying down High-Interest Debt.
_Avoid_: Mini emergency fund, starter fund

**Allocation Waterfall**:
The ordering used to advise where money belongs: (1) Operating Cash to target, (2) Starter Reserve, (3) pay down High-Interest Debt, (4) Reserve to the Reserve Target, (5) the rest is Investable Surplus.
_Avoid_: Budget split, allocation rule

**Investable Surplus**:
Liquid money remaining after Operating Cash and Reserve are at target; the amount the Owner is advised to move into Investment.
_Avoid_: Excess cash, free money, savings

**Allocation Status**:
The live position of the Owner's money against each step of the Allocation Waterfall right now. Always current, never stored.
_Avoid_: Dashboard, health, current advice

**Recommendation**:
A dated, stored set of concrete Transfers the Owner is advised to make (e.g. €400 to PPR, €800 to brokerage), produced under a specific Rule Set version from specific inputs. Usually issued monthly after salary arrives. It is later marked followed, partially followed or ignored, based on matching Transfers.
_Avoid_: Advice (as a noun), suggestion, plan

**Wrapper**:
A legal/tax container for Investment, such as a PPR or an ordinary brokerage account. Advice names Wrappers and asset classes, never specific products.
_Avoid_: Vehicle, product, fund

**Target Allocation**:
The Rule Set's suggested split of Investment across asset classes (e.g. equities vs bonds), typically derived from the Owner's age.
_Avoid_: Portfolio mix, asset split

**Financial Profile**:
The Owner's circumstances that affect risk and advice: age, employment type, number of dependents, number of household incomes, and any manual adjustment. Updated when life changes.
_Avoid_: Settings, preferences, risk profile

**Reserve Target**:
The amount the Owner should keep as a safety reserve: a number of months (derived from the Financial Profile by the Rule Set) multiplied by the Essential Baseline.
_Avoid_: Emergency fund goal, safety net, buffer

**Essential Baseline**:
The monthly Essential Expense figure the Reserve Target is built on: the higher of the trailing 12-month actual average and the next 12-month Forecast average. Until three months of history exist, it is a manual estimate from the Financial Profile and any advice based on it is provisional.
_Avoid_: Monthly essentials, cost of living, burn rate

**Base Currency**:
The single currency in which an Owner's figures are reported. Currently EUR.
_Avoid_: Home currency, default currency

**Import**:
One ingestion of a bank export file into the system, producing a batch of Transactions. Other ingestion sources (e.g. Open Banking sync) may exist later and produce Transactions the same way.
_Avoid_: Upload, sync
