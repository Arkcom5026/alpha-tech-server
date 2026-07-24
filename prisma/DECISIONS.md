# Architecture Decisions v3.1

1. Repair Intake is the only entry authority for Warranty Claim.
2. Warranty Claim requires Repair Job and remains a child process.
3. Sale Return is independent and starts only after Repair Job completion when applicable.
4. Cross-flow relationships are immutable evidence references, never mutation authority.
5. ServiceCase is a journey container/projection boundary, not a universal state machine.
6. Current flow must complete before the next flow starts.
7. Product Trace composes timelines without owning business writes.
