-- Anonymous Shopping Session Foundation — Increment 2
-- Additive pre-commit shopping intent authority.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnonymousShoppingSessionStatus') THEN
    CREATE TYPE "AnonymousShoppingSessionStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'EXPIRED', 'ABANDONED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AnonymousShoppingSession" (
  "id" SERIAL PRIMARY KEY,
  "branchId" INTEGER NOT NULL,
  "publicTokenHash" TEXT NOT NULL UNIQUE,
  "status" "AnonymousShoppingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "committedAt" TIMESTAMP(3),
  "abandonedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnonymousShoppingSession_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AnonymousShoppingSession_lifecycle_consistent"
    CHECK (
      ("status" = 'ACTIVE' AND "committedAt" IS NULL AND "abandonedAt" IS NULL)
      OR ("status" = 'COMMITTED' AND "committedAt" IS NOT NULL AND "abandonedAt" IS NULL)
      OR ("status" = 'EXPIRED' AND "committedAt" IS NULL)
      OR ("status" = 'ABANDONED' AND "abandonedAt" IS NOT NULL AND "committedAt" IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS "AnonymousShoppingSessionItem" (
  "id" SERIAL PRIMARY KEY,
  "sessionId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnonymousShoppingSessionItem_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "AnonymousShoppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AnonymousShoppingSessionItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AnonymousShoppingSessionItem_quantity_positive"
    CHECK ("quantity" > 0),
  CONSTRAINT "AnonymousShoppingSessionItem_session_product_unique"
    UNIQUE ("sessionId", "productId")
);

CREATE INDEX IF NOT EXISTS "AnonymousShoppingSession_branch_status_idx"
  ON "AnonymousShoppingSession"("branchId", "status");

CREATE INDEX IF NOT EXISTS "AnonymousShoppingSession_expiry_idx"
  ON "AnonymousShoppingSession"("status", "expiresAt");

CREATE INDEX IF NOT EXISTS "AnonymousShoppingSessionItem_product_idx"
  ON "AnonymousShoppingSessionItem"("productId");
