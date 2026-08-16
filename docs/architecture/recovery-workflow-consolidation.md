# ALPHA-TECH Recovery Workflow Consolidation

## Decision

Keep Workflow A as the mandatory recovery/backup authority and consolidate Workflow B (PostgreSQL Production -> Recovery/Standby clone) into the same scheduled execution.

The Windows Task Scheduler entrypoint is `scripts/run-recovery-task.bat`, which invokes `recovery/consolidatedRecoveryRunner.js` only.

## Canonical flow

```text
Windows Task Scheduler (every 6 hours)
  -> scripts/run-recovery-task.bat
  -> recovery/consolidatedRecoveryRunner.js
       -> Workflow A (mandatory)
          recovery/jobRunner.js
          HEALTH_CHECK
          -> BACKUP
          -> VERIFY_BACKUP
          -> UPLOAD
          -> R2_RETENTION
          -> RETENTION
       -> Workflow B (scheduled Recovery/Test refresh)
          recovery/captureRecoveryBundle.js
          -> PostgreSQL read-only consistent snapshot
          -> public + legacy_tax bundle
          -> recovery/restoreRecoveryBundle.js
          -> approved Recovery/Standby DB
          -> row-count verification
```

## Authority rules

1. Workflow A always runs first. Workflow B must not run when Workflow A fails.
2. `recovery/jobRunner.js` remains the backup/verify/upload/retention authority. The consolidated runner calls it with `--no-standby-restore` so the legacy optional restore path cannot run in parallel with Workflow B.
3. Workflow B is not an independent scheduler. It is a stage of the same scheduled execution.
4. `recovery/consolidatedRecoveryRunner.js` remains safe-by-default when run directly: Workflow B stays disabled unless `RECOVERY_STANDBY_SYNC_ENABLED=true`.
5. The Windows scheduled entrypoint deliberately sets `RECOVERY_STANDBY_SYNC_ENABLED=true` and the non-secret Recovery/Test approvals required for the approved scheduled refresh.
6. Database URLs and credentials must never be embedded in the scheduled `.bat` file or committed to Git. The Node recovery tooling loads them from the local recovery environment files.
7. Scheduled standby sync is pinned to:
   - `RESTORE_DATABASE_ENVIRONMENT=TEST`
   - `RESTORE_DATABASE_PROJECT_REF=engqdeyzbvnmxbnpemau`
   - `RECOVERY_DRILL_APPROVAL=ALPHATECH_RECOVERY_DRILL`
   - `RESTORE_DATABASE_RESET_CONFIRMATION=ALPHATECH_TEST_DB_RESET`
   - `RESTORE_DATABASE_WRITE_APPROVAL=ALPHATECH_TEST_DB_WRITE`
   - `RESTORE_DATABASE_RESET_APPROVAL=ALPHATECH_TEST_DB_RESET`
8. `restoreRecoveryBundle.js` retains `assertTestDatabaseAuthority(...)` as an independent target authority fence and rejects a target that maps to configured Production/source database URLs.
9. The source bundle capture is read-only and uses one PostgreSQL exported snapshot for row counts and `pg_dump`.
10. No scheduler should call `captureRecoveryBundle.js`, `restoreRecoveryBundle.js`, `qbrs.js`, or `qbv.js` directly.
11. The Windows scheduled entrypoint forcibly sets `RECOVERY_RETENTION_APPLY=false` and `RECOVERY_R2_RETENTION_APPLY=false`. Scheduled retention therefore remains dry-run/analysis only even if a stale machine-level environment variable requested deletion. Destructive retention requires a separate explicitly approved manual execution.
12. The scheduled entrypoint uses `setlocal`/`endlocal` so its Recovery/Test approvals are scoped to that task process and are not persisted into the parent environment.

## Scheduled behavior

Every scheduled execution performs Workflow A first. When Workflow A passes, the scheduled entrypoint enables Workflow B so the approved Recovery/Test database is refreshed from a new read-only Production snapshot.

The scheduled refresh resets/restores only the authorized Recovery/Test target schemas (`public` and `legacy_tax`) and verifies the restored table row counts. Production remains the read-only source during capture.

Local and R2 retention apply modes are always forced off in the scheduled path. Backup, verification, upload, and retention analysis continue, but automatic scheduled deletion is not permitted.

Direct/manual execution of `node recovery/consolidatedRecoveryRunner.js` remains Workflow-A-only unless the operator explicitly supplies the standby-sync approvals in that process environment.

## Reports

The consolidated runner writes:

- `recovery/reports/consolidated-workflow-<run-id>.json`
- `recovery/reports/consolidated-workflow.latest.json`
- `recovery/logs/consolidated-<run-id>.log`

Workflow A reports are normalized after the child job exits so the final report records `REPORT=PASS/FAIL` and the actual final exit code rather than an intermediate running state.

## Rollout evidence required

Scheduled standby refresh must not be considered active until all of the following are proven locally:

- recovery safety contract PASS
- consolidation contract PASS
- recovery bundle contract PASS
- scheduled standby-sync contract PASS
- JavaScript syntax PASS
- one manual Workflow A-only run PASS
- one explicitly approved manual standby-sync drill against the authorized Recovery/Test target PASS
- one Windows Scheduled Task run with `standbySyncEnabled=true`, Workflow A PASS, Workflow B capture PASS, Workflow B restore PASS, and final exit code 0

Production DB must remain source/read-only during standby capture. The only destructive reset target is the explicitly authorized Recovery/Test database.
