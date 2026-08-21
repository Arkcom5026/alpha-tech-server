# Credit Sale Pre-Invoice Return E2E

## Reference production case

- Sale: `1046`
- Delivery note: `SL-022608-0077`
- Original gross value: `1,810.00`
- Paid before return: `0.00`
- Returned line: `32GB Micro SD Card APACER (100MB/s.)`
- Returned quantity: `2`
- Returned value: `640.00`
- Expected remaining receivable: `1,170.00`

## Authority rules

1. `Sale.totalAmount` is immutable historical gross value and must not be rewritten after a return.
2. Completed `SaleReturn` line quantities are the source evidence for receivable reduction.
3. Net billable value is `gross sale value - returned sale-line value`.
4. Outstanding receivable is `net billable value - paid/application evidence`, floored at zero.
5. A pure unpaid pre-invoice return creates no actual refund transaction.
6. A pre-invoice return does not create a tax credit note. Tax correction belongs to the issued-tax-document branch only.
7. Customer Money eligibility and settlement write validation must both exclude returned quantity/value.
8. Settlement-generated consolidated delivery is document-only and must use only the remaining active quantity/value; it never deducts stock again.
9. Sale Return remains the inventory restoration and traceability authority.
10. Payment-close projection must use the same net receivable authority so a sale can be fully settled at the post-return amount.

## Reference projection

```text
Original sale / delivery-note value     1,810.00
Less completed returned value             640.00
Net billable / receivable               1,170.00
Paid / applied                              0.00
Outstanding                             1,170.00
```

## Boundary with tax documents

### Before an output tax invoice is issued

`Sale Return -> Stock Restoration -> Receivable Reduction`

No tax credit note is generated.

### After an output tax invoice is issued

The return still restores stock through Sale Return, but tax correction must be governed separately by the output-tax credit-note eligibility and issuance flow.

## Acceptance conditions

- Partial SIMPLE return reduces only the proportional returned value.
- Serialized return removes the returned one-unit line value.
- Full return reduces receivable to zero without mutating original `Sale.totalAmount`.
- A caller cannot settle more than the remaining line value or remaining sale receivable after returns.
- Customer Money read projection and settlement write authority agree on the same post-return amount.
- Delivery-note history exposes original value, returned value, billable value, paid amount, and remaining balance as separate facts.
