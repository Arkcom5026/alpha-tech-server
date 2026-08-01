# Post-Recovery Simple Inventory Audit Preview

Related issue: #220

## Mission
Build a deterministic post-recovery audit preview for branch-scoped legacy Simple inventory cases after the completed Safe-to-Link mutation.

## Scope
- Re-run recovery analysis against current runtime state.
- Confirm completed Safe-to-Link records are excluded because a SimpleLot now exists.
- Enumerate remaining unresolved candidates.
- Preserve exact movement and cost evidence.
- Classify movement reconciliation and missing-cost candidates with deterministic reason codes and hashes.
- Report evidence-backed drift if counts differ from the historical baseline of 75 reconciliation and 32 missing-cost candidates.

## Safety Boundary
- Preview and audit only.
- `mutationPerformed: false` is mandatory.
- No SimpleLot creation.
- No StockMovement update or creation.
- No StockBalance mutation.
- No invented cost and no coercion of missing cost to zero.
- Strict branch isolation.

## Required Verification
- Post-recovery exclusion of completed records.
- Branch isolation.
- Mixed-sign movement sets.
- Quantity mismatch.
- Conflicting references.
- Missing and conflicting cost evidence.
- Deterministic manifest and source snapshot hash.

## Runtime Evidence Required Before Completion
- Current main SHA.
- Branch 2 post-recovery candidate counts.
- Proof that completed Safe-to-Link records are not proposed again.
- `mutationPerformed: false`.

No database mutation is authorized by this increment.
