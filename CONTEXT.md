# Ballast

Personal finance context: tracks money coming in and going out, projects future savings, and advises how much to hold as a safety reserve versus invest.

## Language

Each term has one fixed European Portuguese (pt-PT) translation, used everywhere the interface is in Portuguese (ADR 0006). Use only that term for the concept, and never the words listed under _Evitar_. Code, ADRs and issues stay in English.

**Owner**:
The person whose finances are being tracked. Every financial record belongs to exactly one Owner; today there is a single Owner, but nothing in the model assumes that.
_Avoid_: User, Account, Customer
_pt-PT_: **Titular** · _Evitar_: Utilizador, Cliente

**Transaction**:
A single dated movement of money on one of the Owner's accounts, with an amount and a direction. Transactions arrive either from an Import or from manual entry.
_Avoid_: Entry, movement, record
_pt-PT_: **Movimento** · _Evitar_: Transação, Operação

**Account**:
A place where the Owner holds money: current account, savings account, credit card, brokerage, etc. Always means a financial account, never a login.
_Avoid_: Wallet, pot
_pt-PT_: **Conta** · _Evitar_: Carteira

**Transfer**:
A pair of Transactions moving money between two of the Owner's own Accounts. A Transfer is never Revenue or Expense. Credit card bill payments and contributions to a brokerage are Transfers.
_Avoid_: Internal movement, self-payment
_pt-PT_: **Transferência interna** · _Evitar_: Transferência (sozinha), Movimento entre contas

**Revenue**:
Money entering the Owner's Accounts from outside (salary, gifts received, interest, dividends paid out in cash). Market gains are not Revenue.
_Avoid_: Income (as a separate term), earnings
_pt-PT_: **Receita** · _Evitar_: Rendimento, Ganho

**Expense**:
Money leaving the Owner's Accounts to anyone outside them, including family members.
_Avoid_: Spending (as a separate term), cost, outflow
_pt-PT_: **Despesa** · _Evitar_: Gasto, Custo

**Refund**:
Money returned by a merchant for a prior Expense. A Refund is a negative Expense in the original Category, never Revenue.
_Avoid_: Reimbursement, credit
_pt-PT_: **Reembolso** · _Evitar_: Devolução, Estorno

**Category**:
A node in an editable hierarchy classifying Expenses (and Revenue) by what they are for, e.g. Housing › Rent.
_Avoid_: Tag, label, bucket
_pt-PT_: **Categoria** · _Evitar_: Etiqueta

**Categorisation Rule**:
An Owner-defined pattern (e.g. description contains "CONTINENTE") that assigns a Category to matching Transactions automatically on Import. Often created from a manual correction.
_Avoid_: Filter, mapping, auto-tag
_pt-PT_: **Regra de categorização** · _Evitar_: Filtro

**Review Queue**:
Everything awaiting the Owner's confirmation: Transactions with no Category, suggested Transfer pairs, suggested Matches and suggested Recurring Items. Items here need the Owner's attention.
_Avoid_: Inbox, uncategorised list, to-do
_pt-PT_: **Por rever (separador: Rever)** · _Evitar_: Fila de revisão, Pendentes

**Essential Expense**:
An Expense the Owner could not reasonably stop paying during a loss of income (rent, utilities, groceries, insurance, debt payments). Essentialness is a default on the Category and can be overridden on an individual Transaction.
_Avoid_: Fixed cost, need, mandatory spending
_pt-PT_: **Despesa essencial** · _Evitar_: Despesa fixa

**Recurring Item**:
A confirmed Revenue or Expense that repeats on a known cadence (monthly, quarterly, yearly) with a predictable amount, e.g. rent, salary, subsídio de férias, annual insurance. Detected from history, confirmed by the Owner.
_Avoid_: Subscription (too narrow), standing order, fixed cost
_pt-PT_: **Recorrência** · _Evitar_: Movimento recorrente, Subscrição

**Variable Spending**:
All Expenses not attributable to a Recurring Item; projected per Category from recent trends.
_Avoid_: Discretionary spending (that is the non-Essential dimension, not this one)
_pt-PT_: **Despesas variáveis** · _Evitar_: Despesas discricionárias

**Forecast**:
A month-by-month projection, over the next 12 months, of Revenue, Expenses and Net Savings, built from Recurring Items and Variable Spending trends.
_Avoid_: Prediction, projection (as a separate term), budget
_pt-PT_: **Previsão** · _Evitar_: Projeção, Orçamento

**Net Savings**:
Revenue minus Expenses for a period. Transfers do not affect it.
_Avoid_: Savings (alone), profit, surplus
_pt-PT_: **Poupança líquida** · _Evitar_: Lucro, Excedente

**Balance Checkpoint**:
A bank-stated balance for an Account at a point in time, typically taken from an Import, against which the sum of Transactions is checked.
_Avoid_: Snapshot, statement balance (as a separate term)
_pt-PT_: **Saldo de referência** · _Evitar_: Saldo de controlo

**Balance Discrepancy**:
A mismatch between a Balance Checkpoint and the balance computed from the Account's Transactions, signalling missing, duplicated or wrong Transactions.
_Avoid_: Reconciliation error, drift
_pt-PT_: **Discrepância de saldo** · _Evitar_: Erro de reconciliação

**Valuation**:
A dated market value of an Investment Account. Changes in Valuation not explained by Transfers are market gains or losses, which are never Revenue or Expense.
_Avoid_: Price, mark, snapshot
_pt-PT_: **Valor de mercado** · _Evitar_: Avaliação, Valorização, Cotação

**Net Worth**:
The sum of all Account balances and latest Valuations, minus Liability balances. A reporting figure only; it never feeds the Allocation Waterfall.
_Avoid_: Wealth, total balance, equity
_pt-PT_: **Património líquido** · _Evitar_: Riqueza

**Match**:
A confirmed link between a manually entered Transaction and the imported Transaction representing the same real-world movement; they are merged, with the bank's data authoritative and the Owner's Category and notes kept.
_Avoid_: Merge, reconcile, duplicate
_pt-PT_: **Correspondência** · _Evitar_: Duplicado

**Rule Set**:
A named, versioned collection of parameters encoding mainstream financial guidance (e.g. how many months of Essential Expenses to hold in reserve). Each Owner is advised under exactly one Rule Set; the default reflects Portuguese/EU guidance.
_Avoid_: Policy, strategy, market rules, config
_pt-PT_: **Conjunto de regras** · _Evitar_: Política, Estratégia

**Account Role**:
What an Account is for: Operating Cash, Reserve, Investment, or Liability. Every Account has exactly one Role.
_Avoid_: Account type (the bank product), purpose
_pt-PT_: **Função da conta** · _Evitar_: Finalidade, Tipo de conta

**Operating Cash**:
Liquid money set aside for the current month's Expenses, typically in a current account. Its target is about one month of total Expenses; it never counts toward the Reserve Target.
_Avoid_: Spending money, checking balance
_pt-PT_: **Dinheiro corrente** · _Evitar_: Fundo de maneio, Tesouraria

**Reserve**:
Money held in safe, accessible Accounts (savings, withdrawable term deposits, Certificados de Aforro past lock-in) that counts toward the Reserve Target. Operating Cash above its target also counts as Reserve.
_Avoid_: Emergency fund, savings (as a noun), safety net
_pt-PT_: **Reserva** · _Evitar_: Fundo de emergência, Poupança

**Investment**:
Money held in Accounts exposed to market risk (brokerage, PPR, funds). Never counts toward the Reserve.
_Avoid_: Portfolio (as a domain term), assets
_pt-PT_: **Investimento** · _Evitar_: Carteira

**Liability**:
An Account representing money the Owner owes (credit card carrying a balance, personal loan, car loan, mortgage), with an interest rate.
_Avoid_: Debt account, loan (as a generic term)
_pt-PT_: **Dívida** · _Evitar_: Passivo, Crédito

**High-Interest Debt**:
Liability balances whose interest rate exceeds the Rule Set's threshold. Liabilities below the threshold (e.g. a typical mortgage) are not paid down early; their payments are simply Essential Expenses.
_Avoid_: Bad debt, toxic debt
_pt-PT_: **Dívida de juro elevado** · _Evitar_: Dívida má

**Starter Reserve**:
A small first slice of the Reserve (e.g. one month of Essential Expenses) filled before paying down High-Interest Debt.
_Avoid_: Mini emergency fund, starter fund
_pt-PT_: **Reserva inicial** · _Evitar_: Mini fundo de emergência

**Allocation Waterfall**:
The ordering used to advise where money belongs: (1) Operating Cash to target, (2) Starter Reserve, (3) pay down High-Interest Debt, (4) Reserve to the Reserve Target, (5) the rest is Investable Surplus.
_Avoid_: Budget split, allocation rule
_pt-PT_: **Ordem de alocação** · _Evitar_: Cascata de alocação

**Investable Surplus**:
Liquid money remaining after Operating Cash and Reserve are at target; the amount the Owner is advised to move into Investment.
_Avoid_: Excess cash, free money, savings
_pt-PT_: **Excedente investível** · _Evitar_: Dinheiro livre

**Allocation Status**:
The live position of the Owner's money against each step of the Allocation Waterfall right now. Always current, never stored.
_Avoid_: Dashboard, health, current advice
_pt-PT_: **Estado da alocação** · _Evitar_: Painel, Saúde financeira

**Recommendation**:
A dated, stored set of concrete Transfers the Owner is advised to make (e.g. €400 to PPR, €800 to brokerage), produced under a specific Rule Set version from specific inputs. Usually issued monthly after salary arrives. It is later marked followed, partially followed or ignored, based on matching Transfers.
_Avoid_: Advice (as a noun), suggestion, plan
_pt-PT_: **Recomendação** · _Evitar_: Conselho, Sugestão

**Wrapper**:
A legal/tax container for Investment, such as a PPR or an ordinary brokerage account. Advice names Wrappers and asset classes, never specific products.
_Avoid_: Vehicle, product, fund
_pt-PT_: **Enquadramento fiscal** · _Evitar_: Veículo, Produto

**Target Allocation**:
The Rule Set's suggested split of Investment across asset classes (e.g. equities vs bonds), typically derived from the Owner's age.
_Avoid_: Portfolio mix, asset split
_pt-PT_: **Alocação-alvo** · _Evitar_: Mix da carteira

**Financial Profile**:
The Owner's circumstances that affect risk and advice: age, employment type, number of dependents, number of household incomes, and any manual adjustment. Updated when life changes.
_Avoid_: Settings, preferences, risk profile
_pt-PT_: **Perfil financeiro** · _Evitar_: Definições, Perfil de risco

**Reserve Target**:
The amount the Owner should keep as a safety reserve: a number of months (derived from the Financial Profile by the Rule Set) multiplied by the Essential Baseline.
_Avoid_: Emergency fund goal, safety net, buffer
_pt-PT_: **Objetivo de reserva** · _Evitar_: Meta do fundo de emergência

**Essential Baseline**:
The monthly Essential Expense figure the Reserve Target is built on: the higher of the trailing 12-month actual average and the next 12-month Forecast average. Until three months of history exist, it is a manual estimate from the Financial Profile and any advice based on it is provisional.
_Avoid_: Monthly essentials, cost of living, burn rate
_pt-PT_: **Despesa essencial mensal** · _Evitar_: Custo de vida

**Base Currency**:
The single currency in which an Owner's figures are reported. Currently EUR.
_Avoid_: Home currency, default currency
_pt-PT_: **Moeda base** · _Evitar_: Moeda por defeito

**Import**:
One ingestion of a bank export file into the system, producing a batch of Transactions. Other ingestion sources (e.g. Open Banking sync) may exist later and produce Transactions the same way.
_Avoid_: Upload, sync
_pt-PT_: **Importação** · _Evitar_: Upload, Sincronização
