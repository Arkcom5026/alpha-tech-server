# Delivery Note Lifecycle — Wave 1D Unified History Integration

Status: IN PROGRESS

This wave wires the already verified Wave 1C history projector into the unified document history read path.

Goals:
- keep consumed/consolidated source Delivery Notes visible in DELIVERY_NOTE history;
- expose lifecycle state and action authority separately from historical readability;
- attach active consolidation destination evidence to source rows;
- preserve BILL behavior and all write paths;
- remain schema-free and mutation-free.

Safety boundary:
- no schema migration;
- no Delivery Note revision persistence yet;
- no stock/payment/receivable/tax mutation;
- no change to historical Sale gross values;
- no removal of consolidated print guards.
