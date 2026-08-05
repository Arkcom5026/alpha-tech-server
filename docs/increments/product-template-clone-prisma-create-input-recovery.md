# ProductTemplate Clone Prisma Create Input Recovery

## Runtime evidence

After ProductType adoption succeeded, Product creation failed with PrismaClientValidationError because `templateProductId` was not accepted by the generated Product create input.

## Recovery

Create the store Product through explicit Prisma relation connects for templateProduct, productType, branch, brand and unit. Preserve the existing transaction, idempotent lookup and endpoint response contract.

## Non-changes

- no Prisma schema change
- no migration
- no production data mutation from repository work
