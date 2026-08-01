# Missing Cost Resolution Framework — Foundation

Related issue: #222

## Mission
Establish the first backend foundation for a branch-scoped Missing Cost Resolution Framework for legacy Simple inventory candidates that remain blocked because no defensible cost evidence exists.

## Increment Scope
This increment establishes contracts and domain boundaries only:

- branch-scoped missing-cost candidate identity;
- evidence source taxonomy;
- proposal lifecycle and status model;
- approval authority contract;
- immutable audit-event contract;
- stale-data and deterministic evidence-hash requirements;
- recovery re-evaluation boundary;
- API-ready DTO contracts;
- contract tests.

## Safety Boundary

- No SimpleLot creation.
- No StockMovement creation or update.
- No StockBalance mutation.
- No cost defaulting or coercion to zero.
- No recovery execution.
- No cross-branch aggregation or lookup.
- Approval does not bypass fresh manifest, plan, and execution authority.

## Required Domain Capabilities

1. **Candidate Queue Contract**
   - branchId is mandatory;
   - candidate is derived from current post-recovery audit evidence;
   - resolved/recovered candidates are excluded;
   - deterministic candidate ID and source snapshot hash.

2. **Evidence Contract**
   - source type;
   - source reference;
   - evidence summary;
   - proposed unit cost;
   - effective date;
   - confidence classification;
   - proposer identity;
   - evidence hash.

3. **Lifecycle Contract**
   - DRAFT;
   - SUBMITTED;
   - APPROVED;
   - REJECTED;
   - RETURNED_FOR_CORRECTION;
   - CANCELLED;
   - SUPERSEDED.

4. **Approval Contract**
   - explicit branch authority;
   - explicit operator identity;
   - stale evidence must abort;
   - proposer/approver separation can be enforced;
   - approved evidence is immutable and can only be superseded through a new version.

5. **Audit Contract**
   - append-only lifecycle events;
   - previous/resulting status;
   - actor identity;
   - reason and notes;
   - evidence hash;
   - timestamp.

6. **Recovery Boundary**
   - approval may make a candidate eligible for fresh recovery preview;
   - it must not mutate inventory directly;
   - fresh manifest ID, snapshot hash, plan ID/hash, explicit approval, and Serializable transaction remain mandatory.

## Verification

- deterministic candidate/evidence hashing;
- branch isolation;
- missing and zero cost rejected;
- unsupported evidence source rejected;
- invalid lifecycle transition rejected;
- approved evidence immutability;
- no inventory mutation capability exposed by foundation contracts.

## Completion Evidence

- contract tests pass locally;
- Backend CI passes;
- ALDE certification corresponds to the exact certified SHA;
- no runtime inventory mutation is performed by this increment.
