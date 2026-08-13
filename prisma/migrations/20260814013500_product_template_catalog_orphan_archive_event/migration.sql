-- Product Template Catalog Quality Candidate
-- Orphan archive lifecycle event.
-- Additive only: no table/column/type removal and no data mutation.

ALTER TYPE "public"."ProductTemplateCandidateEventType"
  ADD VALUE IF NOT EXISTS 'ORPHAN_ARCHIVED';
