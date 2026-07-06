@echo off
title AlphaTech Recovery Scheduler - Run Once

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Scheduler
echo Run Once - Backup Only
echo =====================================
echo.

node recovery\scheduler\recoveryScheduler.js --run-once --mode backup-only

if errorlevel 1 (
    echo.
    echo Scheduler job FAILED.
    pause
    exit /b 1
)

echo.
echo Scheduler job completed successfully.
pause
