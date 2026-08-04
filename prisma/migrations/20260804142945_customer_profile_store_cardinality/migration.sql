-- Replace platform-wide CustomerProfile user uniqueness
-- with store-scoped CustomerProfile identity.

DROP INDEX "CustomerProfile_userId_key";

CREATE INDEX "CustomerProfile_userId_idx"
ON "CustomerProfile"("userId");

CREATE UNIQUE INDEX "CustomerProfile_branchId_userId_key"
ON "CustomerProfile"("branchId", "userId");
