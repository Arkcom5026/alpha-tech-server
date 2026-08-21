-- Position-first employee authority foundation.
-- NULL means the position has not migrated yet and runtime must preserve legacy v2Role compatibility.
-- A JSON array (including []) means the position owns its capability authority.
ALTER TABLE "Position"
ADD COLUMN "capabilities" JSONB;
