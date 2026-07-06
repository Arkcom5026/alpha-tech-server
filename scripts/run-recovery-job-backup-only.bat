@echo off
title AlphaTech Recovery Job - Backup Only

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Job Runner
echo Backup Only
echo =====================================
echo.

node recovery\jobRunner.js --backup-only

if errorlevel 1 (
    echo.
    echo Job FAILED.
    pause
    exit /b 1
)

echo.
echo Job completed successfully.
pause
