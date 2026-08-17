-- Store-scoped document header customization.
-- Nullable JSON preserves existing print behavior until a branch opts in.
ALTER TABLE "Branch"
ADD COLUMN IF NOT EXISTS "documentHeaderConfig" JSONB;
