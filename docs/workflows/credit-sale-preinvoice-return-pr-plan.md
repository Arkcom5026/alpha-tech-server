# PR Verification Plan — Credit Sale Pre-Invoice Return E2E

This branch must remain draft/not-ready until it is rebased or merged with the latest `main` and all focused + full server verification passes.

Key review targets:

- Shared receivable math is line-return aware.
- Delivery-note and Customer Money read projections agree.
- Settlement write validation independently caps both line and sale totals.
- Payment close authority uses post-return net receivable.
- Original sale total remains immutable.
- No automatic refund evidence when refund channels are empty.
- No automatic tax credit note before tax invoice issuance.
