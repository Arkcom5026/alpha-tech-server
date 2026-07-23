# Sales reconciliation verifier

Run `node scripts/verify-sales-reconciliation.js` only with an explicitly selected database authority.
The script is read-only, prints counts and Sale IDs only, and never repairs data. In a Production
process it refuses to run unless `ACK_READONLY_PRODUCTION_RECONCILIATION=YES` is explicitly set.
