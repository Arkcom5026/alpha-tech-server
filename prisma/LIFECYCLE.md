# Lifecycle Rules

## RepairJob
DRAFT -> RECEIVED -> DIAGNOSING -> WAITING_CUSTOMER_APPROVAL -> IN_SERVICE / WAITING_EXTERNAL_SERVICE -> QUALITY_CHECK -> READY_FOR_PICKUP -> DELIVERED -> CLOSED.

Terminal alternatives: CANCELLED.

Claim resolution must not automatically close RepairJob. After claim resolution, the device returns to QUALITY_CHECK before delivery.

## WarrantyClaim
DRAFT -> SUBMITTED -> IN_TRANSIT -> RECEIVED_BY_PROVIDER -> INSPECTING -> APPROVED / REJECTED -> REPAIRING / REPLACEMENT_PENDING / CREDIT_PENDING -> RESOLVED.

Terminal alternative: CANCELLED.

## Concurrency
Use expected status plus version/conditional update. A stale transition must return a conflict and must not overwrite the current state.
