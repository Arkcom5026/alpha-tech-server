@echo off
setlocal
cd /d D:\alpha-tech\server

REM Scheduled recovery authority: Workflow A always runs, Workflow B refreshes the approved Recovery/Test DB.
REM Database URLs remain outside Git and are loaded by the Node recovery tooling from local env files.
set "RECOVERY_STANDBY_SYNC_ENABLED=true"
set "RECOVERY_DRILL_APPROVAL=ALPHATECH_RECOVERY_DRILL"
set "RESTORE_DATABASE_RESET_CONFIRMATION=ALPHATECH_TEST_DB_RESET"
set "RESTORE_DATABASE_ENVIRONMENT=TEST"
set "RESTORE_DATABASE_PROJECT_REF=engqdeyzbvnmxbnpemau"
set "RESTORE_DATABASE_WRITE_APPROVAL=ALPHATECH_TEST_DB_WRITE"
set "RESTORE_DATABASE_RESET_APPROVAL=ALPHATECH_TEST_DB_RESET"

REM Scheduled retention is always analysis-only. Never inherit a destructive apply mode.
set "RECOVERY_RETENTION_APPLY=false"
set "RECOVERY_R2_RETENTION_APPLY=false"

node recovery\consolidatedRecoveryRunner.js
set "RECOVERY_EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %RECOVERY_EXIT_CODE%
