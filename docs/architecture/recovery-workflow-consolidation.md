# ALPHA-TECH Recovery Workflow

## Decision

ALPHA-TECH uses one canonical Recovery workflow. The former Workflow A / Workflow B terminology is retired from the runtime and report model.

The Windows Task Scheduler entrypoint is `scripts/run-recovery-task.bat`, which invokes only `recovery/consolidatedRecoveryRunner.js`.

`recovery/jobRunner.js`, `recovery/captureRecoveryBundle.js`, and `recovery/restoreRecoveryBundle.js` remain internal implementation components. They are not separate scheduled workflows.

## Canonical flow

```text
Windows Task Scheduler (every 6 hours)
  -> scripts/run-recovery-task.bat
  -> recovery/consolidatedRecoveryRunner.js
       -> BACKUP_PIPELINE
          recovery/jobRunner.js
          HEALTH_CHECK
          -> BACKUP
          -> VERIFY_BACKUP
          -> UPLOAD
          -> R2_RETENTION (dry-run)
          -> RETENTION (dry-run)
       -> RECOVERY_CAPTURE
          recovery/captureRecoveryBundle.js
          -> PostgreSQL read-only consistent snapshot
          -> public + legacy_tax recovery bundle
       -> RECOVERY_RESTORE
          recovery/restoreRecoveryBundle.js
          -> authorized Recovery/Test DB
          -> public + legacy_tax restore
          -> row-count verification
       -> FINAL_REPORT
```

## Single-workflow authority rules

1. There is one scheduled entrypoint and one top-level Recovery workflow report.
2. `BACKUP_PIPELINE` must PASS before Recovery capture or restore can run.
3. `jobRunner.js` is called with `--no-standby-restore`; its legacy optional restore path cannot run in parallel with the canonical Recovery restore stage.
4. The scheduled entrypoint enables Recovery DB sync with `RECOVERY_STANDBY_SYNC_ENABLED=true`. Direct invocation remains safe-by-default when the flag is absent.
5. Recovery DB sync requires all of the following non-secret approvals:
   - `RECOVERY_DRILL_APPROVAL=ALPHATECH_RECOVERY_DRILL`
   - `RESTORE_DATABASE_RESET_CONFIRMATION=ALPHATECH_TEST_DB_RESET`
   - `RESTORE_DATABASE_ENVIRONMENT=TEST`
   - approved `RESTORE_DATABASE_PROJECT_REF`
   - `RESTORE_DATABASE_WRITE_APPROVAL=ALPHATECH_TEST_DB_WRITE`
   - `RESTORE_DATABASE_RESET_APPROVAL=ALPHATECH_TEST_DB_RESET`
6. Recovery database URLs and credentials are never embedded in the scheduled BAT or committed to Git. They continue to come from the local recovery environment files.
7. `restoreRecoveryBundle.js` retains `assertTestDatabaseAuthority(...)` as an independent target authority fence before any destructive reset.
8. Production bundle capture is read-only and uses one exported PostgreSQL snapshot for row counts and `pg_dump`.
9. The only destructive database target is the explicitly authorized Recovery/Test database.
10. Scheduled local and R2 retention are always dry-run. `RECOVERY_RETENTION_APPLY=false` and `RECOVERY_R2_RETENTION_APPLY=false` are enforced both by the scheduled entrypoint and by the canonical runner.
11. No scheduler may directly invoke `jobRunner.js`, `captureRecoveryBundle.js`, `restoreRecoveryBundle.js`, `qbrs.js`, or `qbv.js`.

## Report model

The canonical report contains one `workflow` object with these stages:

- `BACKUP_PIPELINE`
- `RECOVERY_CAPTURE`
- `RECOVERY_RESTORE`
- `FINAL_REPORT`

Legacy top-level `workflowA` and `workflowB` fields are not part of the V2 report model.

Reports continue to be written to:

- `recovery/reports/consolidated-workflow-<run-id>.json`
- `recovery/reports/consolidated-workflow.latest.json`
- `recovery/logs/consolidated-<run-id>.log`

The filename is retained for operational compatibility even though the runtime model is now one Recovery workflow.

The backup pipeline's existing detailed report is normalized after `jobRunner.js` exits so `REPORT=PASS` and the final exit code reflect the finalized job manifest.

## Scheduled behavior

The existing Windows Scheduled Task remains the cadence authority. Its current six-hour trigger runs the complete canonical flow:

```text
BACKUP_PIPELINE
-> RECOVERY_CAPTURE
-> RECOVERY_RESTORE
-> FINAL_REPORT
```

If a safety gate, backup, capture, restore, or verification stage fails, the workflow returns a non-zero exit code and later destructive stages do not continue blindly.

## Safety and rollout evidence

Before scheduled Recovery DB sync was enabled, local verification established:

- recovery safety contracts PASS
- recovery bundle contract PASS
- PostgreSQL 17 client discovery PASS
- authorized Recovery/Test target preflight PASS
- manual read-only capture PASS
- manual restore of `public` + `legacy_tax` PASS
- row-count verification PASS for the captured tables
- repeated end-to-end Recovery DB drill PASS
- Scheduled Task backup-only entrypoint PASS

Production DB remains source/read-only during Recovery capture. Recovery/Test DB is the only reset/restore target.
