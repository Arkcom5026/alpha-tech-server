@echo off
title AlphaTech Recovery Scheduler - Backup and Verify

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Scheduler
echo Run Once - Backup and Verify
echo =====================================
echo.

node recovery\scheduler\recoveryScheduler.js --run-once --mode backup-and-verify

if errorlevel 1 (
    echo.
    echo Scheduler job FAILED.
    pause
    exit /b 1
)

echo.
echo Scheduler job completed successfully.
pause
