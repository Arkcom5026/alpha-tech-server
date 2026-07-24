# Migration Plan v3.1

1. Run `npx prisma format`.
2. Run `npx prisma validate`.
3. Review relation naming and generated client surface.
4. Generate migration SQL with create-only workflow; do not deploy.
5. Inspect SQL for destructive operations and legacy-row requirements.
6. Backfill/compatibility plan:
   - Existing WarrantyClaim rows must receive a valid `repairJobId` before the field becomes NOT NULL.
   - Existing SaleReturn rows leave `sourceRepairJobId` null.
   - Existing RepairJob rows leave close outcome null unless already closed and backfilled deliberately.
7. Add database preconditions before production deployment.
8. Verify local runtime and branch-scoped invariants.
9. Only then authorize production migration.
