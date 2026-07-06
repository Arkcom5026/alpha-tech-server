@echo off
title AlphaTech Recovery Job - Backup and Verify

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Job Runner
echo Backup and Verify
echo =====================================
echo.

node recovery\jobRunner.js --backup-and-verify

if errorlevel 1 (
    echo.
    echo Job FAILED.
    pause
    exit /b 1
)

echo.
echo Job completed successfully.
pause
