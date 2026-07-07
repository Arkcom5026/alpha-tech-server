-- Drop legacy ProductType.slug after runtime has moved to branchId + globalProductTypeId + normalizedName.
-- Branch.slug, GlobalProductType.slug, ProductProfile.slug, and ProductTemplate.slug are intentionally untouched.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ProductType'
      AND constraint_name = 'ProductType_branchId_globalProductTypeId_slug_key'
  ) THEN
    ALTER TABLE "ProductType"
      DROP CONSTRAINT "ProductType_branchId_globalProductTypeId_slug_key";
  END IF;
END $$;

ALTER TABLE "ProductType"
  DROP COLUMN IF EXISTS "slug";
