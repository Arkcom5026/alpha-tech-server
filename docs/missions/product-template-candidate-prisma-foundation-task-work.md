# Task Work Mission — ProductTemplate Candidate Prisma Foundation

## Mission status

- Repository: `Arkcom5026/alpha-tech-server`
- Working branch: `feature/product-template-candidate-prisma-foundation`
- Stacked base branch: `feature/brand-tenant-ownership-additive-foundation`
- Required source SHA: `d8ea6bf8cd6bae80c6b8bc477eeb9dfb5106c7cf`
- Mission type: Prisma additive foundation only
- Runtime/API/FE work: forbidden
- Data backfill/database mutation: forbidden
- Merge/deploy: forbidden

## Critical business-data warning

The system already contains real operational data for **2 active stores**. Each store is an independent tenant. This mission must not connect to, inspect, migrate, seed, reset, backfill, merge, split, reassign, normalize, or modify any real/shared database or any Product/Brand records belonging to either store.

## Objective

Add only the minimum Prisma persistence foundation required for the real Superadmin-governed flow:

`Store Product -> ProductTemplateCandidate -> Superadmin decision -> future promoted Template Product`

This mission creates persistence capability only. It must not implement candidate services, repositories, controllers, routes, APIs, UI, classifier logic, promotion transactions, media copy, or any business runtime.

## Locked architecture

### Candidate ownership and lineage

- Candidate is platform-governance data, not store-owned operational data.
- `sourceBranchId` identifies the independent source store.
- `sourceProductId` identifies the source Product and must never cause source mutation.
- `targetTemplateBranchId` identifies the SYSTEM TEMPLATE workspace selected by platform policy.
- `targetTemplateProductId` is optional and records the resulting or merged Template Product later.
- Candidate stores a catalog-safe snapshot and proposed template data as JSON; it must not store stock, serial numbers, movements, supplier transactions, customer data, sales history, purchase documents, reservations, tax documents, or other operational/financial data.
- Event history is append-only by domain contract; this Prisma increment only provides the table structure and must not add update/delete runtime.

## Exact allowed Prisma models

Add exactly these enums and models, adjusting relation field names only where Prisma requires consistency with existing model names.

```prisma
enum ProductTemplateCandidateStatus {
  DRAFT
  UNDER_REVIEW
  REJECTED
  PROMOTED
  MERGED
  CANCELLED
}

enum ProductTemplateCandidateEventType {
  CREATED
  REVIEW_STARTED
  PROPOSED_DATA_UPDATED
  REJECTED
  PROMOTED
  MERGED
  CANCELLED
}

model ProductTemplateCandidate {
  id                      Int                            @id @default(autoincrement())
  sourceBranchId          Int
  sourceProductId         Int
  targetTemplateBranchId  Int
  targetTemplateProductId Int?
  status                  ProductTemplateCandidateStatus @default(DRAFT)
  sourceSnapshot          Json
  proposedTemplateData    Json?
  duplicateAssessment     Json?
  createdByEmployeeId     Int?
  reviewedByEmployeeId    Int?
  decisionNote            String?
  reviewedAt              DateTime?
  promotedAt              DateTime?
  createdAt               DateTime                       @default(now())
  updatedAt               DateTime                       @updatedAt

  sourceBranch          Branch   @relation("ProductTemplateCandidateSourceBranch", fields: [sourceBranchId], references: [id])
  sourceProduct         Product  @relation("ProductTemplateCandidateSourceProduct", fields: [sourceProductId], references: [id])
  targetTemplateBranch  Branch   @relation("ProductTemplateCandidateTargetBranch", fields: [targetTemplateBranchId], references: [id])
  targetTemplateProduct Product? @relation("ProductTemplateCandidateTargetProduct", fields: [targetTemplateProductId], references: [id])
  createdByEmployee     EmployeeProfile? @relation("ProductTemplateCandidateCreatedBy", fields: [createdByEmployeeId], references: [id])
  reviewedByEmployee    EmployeeProfile? @relation("ProductTemplateCandidateReviewedBy", fields: [reviewedByEmployeeId], references: [id])
  events                ProductTemplateCandidateEvent[]

  @@index([sourceBranchId, sourceProductId])
  @@index([targetTemplateBranchId, status])
  @@index([status, createdAt])
  @@index([targetTemplateProductId])
}

model ProductTemplateCandidateEvent {
  id              Int                                @id @default(autoincrement())
  candidateId     Int
  eventType       ProductTemplateCandidateEventType
  previousStatus  ProductTemplateCandidateStatus?
  resultingStatus ProductTemplateCandidateStatus
  actorEmployeeId Int?
  note            String?
  metadata        Json?
  createdAt       DateTime                           @default(now())

  candidate     ProductTemplateCandidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  actorEmployee EmployeeProfile?          @relation("ProductTemplateCandidateEventActor", fields: [actorEmployeeId], references: [id])

  @@index([candidateId, createdAt])
  @@index([eventType, createdAt])
  @@index([actorEmployeeId])
}
```

## Required reverse relations

Add only the reverse relations Prisma requires to existing models:

- `Branch`: source candidates and target-template candidates using distinct relation names.
- `Product`: source candidates and target-template candidates using distinct relation names.
- `EmployeeProfile`: created candidates, reviewed candidates, and candidate events using distinct relation names. This is the locked actor model; do not use `Employee`, `User`, or another model.

Do not rename or repurpose existing relations.

## Referential actions

- Do not specify explicit `onDelete` or `onUpdate` on Candidate relations to Branch, Product, or Employee. Report Prisma-generated actions accurately.
- `ProductTemplateCandidateEvent.candidate` may use explicit `onDelete: Cascade` because events have no independent meaning after deletion of an unshipped candidate foundation record; however, no runtime hard-delete capability is authorized in this mission.
- If existing project conventions or Prisma validation make the locked relation design impossible, stop and report `BLOCKED`; do not invent alternative lifecycle policy.

## Migration constraints

Create exactly one additive migration containing only:

- the two enums
- the two new tables
- their columns, indexes, and foreign keys

The migration must contain no alteration of existing Product, Brand, Branch, Employee, price, stock, transaction, or business rows beyond adding required reverse relation metadata in Prisma schema (which must not generate database columns).

Absolutely no:

- `UPDATE`, `INSERT`, `DELETE`, `MERGE`, `TRUNCATE`
- backfill or ownership inference
- data copy/split/normalization
- dropping or replacing existing columns, tables, indexes, unique constraints, or foreign keys
- trigger/function/view/materialized view
- seed/bootstrap/startup execution

## Snapshot safety contract

Contract tests must assert that the new schema contains only generic JSON snapshot/proposal fields. Do not introduce explicit fields for:

- stock quantity
- serial number
- stock movement
- supplier or purchase transaction
- customer or sale transaction
- cost history
- reservation
- repair/claim operational data
- tax documents

This is a schema naming/static contract only; no real data may be read.

## Allowed files

Only:

1. `prisma/schema.prisma`
2. one new additive migration directory
3. one narrowly targeted migration/schema contract test
4. this Mission Pack when reconciliation is necessary

No runtime, repository, service, controller, route, API, policy, mapper, frontend, test fixture for business runtime, CI, deployment, ProductTemplate promotion implementation, classifier, or media code may change.

## Required verification

Use a fresh checkout of the exact final PR SHA. Do not connect to any database.

Run and report:

- `npx prisma format` in a disposable formatting workspace; do not commit unrelated formatting
- `npx prisma validate` from an exact-SHA clean workspace
- `npx prisma generate` from the same exact-SHA clean workspace
- targeted migration/schema contract test
- `git diff --check`
- diff against stacked base SHA

If `prisma format` changes unrelated existing Prisma files, classify the diff separately and do not commit it. Exact-source validate/generate/test authority must remain on a clean tracked tree.

## Required contract-test assertions

At minimum:

- both enums exist with exactly the locked values
- both models and required scalar fields exist
- all relation names are distinct and valid
- required reverse relations exist
- all locked indexes exist
- no unique constraint silently prevents multiple historical candidates for one source Product
- event has no `updatedAt` field
- event relation to candidate uses the locked cascade only
- no migration data mutation/destructive DDL
- migration does not alter Product/Brand ownership foundations
- forbidden operational snapshot field names are absent from the new models

## Absolute prohibitions

- No database connection of any kind
- No migration apply, shadow DB, `migrate dev`, `migrate deploy`, `db push`, reset, seed, bootstrap, or app startup
- No reading or modifying data for either of the 2 active stores
- No Product/Brand backfill or ownership cutover
- No runtime/API/FE implementation
- No Candidate classifier implementation
- No promotion/merge transaction
- No physical asset copy implementation
- No deploy, merge, Mark Ready, or main update
- No unrelated schema repair or scope expansion

## Acceptance criteria

PASS only when:

1. Prisma schema implements exactly the locked candidate/event persistence foundation.
2. One additive migration contains no destructive DDL or data mutation.
3. Prisma validate and generate pass from exact final SHA on a clean tree.
4. Targeted contract test and `git diff --check` pass.
5. No real/shared database is contacted.
6. Neither active store’s data is read or changed.
7. Only allowed files changed.
8. PR remains Draft and unmerged.

Any uncertainty or required deviation is `BLOCKED`, never partial PASS.
