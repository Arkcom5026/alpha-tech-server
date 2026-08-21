# Delivery Note Lifecycle — Wave 1E Verification

Run locally from the Wave 1E branch:

```powershell
node tests/delivery-note-lifecycle-domain-foundation.contract.test.js
node tests/delivery-note-lifecycle-wave1c-history-projection.contract.test.js
node tests/delivery-note-lifecycle-wave1d-unified-history-integration.contract.test.js
node tests/delivery-note-lifecycle-wave1e-document-workspace-read-authority.contract.test.js
node tests/consolidated-delivery-document-workspace.contract.test.js
```

Expected production-reference semantics for SL-022608-0077:
- original 1,810
- returned 640
- active 1,170
- APACER returned line is `RETURNED` and `selectableForConsolidation=false`
- active SANDISK line remains eligible only according to settled amount

Wave 1E does not yet harden the confirmation/write path against a stale handcrafted request. That write guard is the next wave after this read projection is verified.