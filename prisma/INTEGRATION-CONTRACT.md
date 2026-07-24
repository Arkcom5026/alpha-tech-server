# Repair and Claim Integration Contract

A WarrantyClaim may reference RepairJob, RepairWorkItem, and RepairDiagnosis.

Opening a claim from repair requires:
1. RepairJob belongs to the same branch.
2. Diagnosis belongs to the same RepairJob.
3. Recommended action permits WARRANTY_CLAIM.
4. StockItem and supplier eligibility are verified when applicable.
5. No conflicting active claim exists.
6. RepairJob moves to WAITING_EXTERNAL_SERVICE in the same transaction or through a guaranteed application workflow.
7. RepairJobEvent, WarrantyClaimEvent, and custody/stock movements are append-only.

Resolving a claim requires:
1. Resolution-specific data is valid.
2. Replacement or credit is not fabricated.
3. Inventory effect and StockMovement are atomic.
4. RepairJob returns to QUALITY_CHECK, not CLOSED.
