# Wave 1D Focused Verification

Run after fetching `feature/delivery-note-lifecycle-wave1d-unified-history-integration`:

```powershell
node tests/delivery-note-lifecycle-domain-foundation.contract.test.js
node tests/delivery-note-lifecycle-compatibility-loader.contract.test.js
node tests/delivery-note-lifecycle-wave1b-print-read-integration.contract.test.js
node tests/delivery-note-lifecycle-wave1c-history-projection.contract.test.js
node tests/delivery-note-lifecycle-wave1d-unified-history-integration.contract.test.js
node tests/delivery-note-history-print-eligibility.contract.test.js
```

Wave 1D remains read-only. No schema or write-path verification is expected in this checkpoint.
