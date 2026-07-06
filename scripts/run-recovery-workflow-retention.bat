@echo off
title AlphaTech Recovery Workflow Retention

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Workflow
echo Backup + Verify + Upload + Retention
echo =====================================
echo.
echo Retention runs in dry-run unless RECOVERY_RETENTION_APPLY=true
echo.

node recovery\jobRunner.js --backup-workflow --upload --retention

if errorlevel 1 (
    echo.
    echo Workflow FAILED.
    pause
    exit /b 1
)

echo.
echo Workflow completed successfully.
pause
