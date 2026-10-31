---
status: accepted
---

# Single-entry Transactions with Balance Checkpoints, not double-entry

Each Transaction mirrors one line of a bank statement on one Account; Transfers are explicit links between two Transactions. We rejected double-entry bookkeeping (as in Firefly III and Beancount) because it would require translating every imported line into a balanced posting and would turn Categories into pseudo-accounts, clashing with Account meaning a real financial account. Integrity is instead enforced by Balance Checkpoints: the bank-stated balance from each Import is recorded, and any mismatch with the sum of Transactions surfaces as a Balance Discrepancy.
