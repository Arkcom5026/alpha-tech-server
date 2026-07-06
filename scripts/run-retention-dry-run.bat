@echo off
title AlphaTech Retention Dry Run

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Retention Policy
echo Dry Run
echo =====================================
echo.

node recovery\retention\retentionPolicy.js --dry-run

if errorlevel 1 (
    echo.
    echo Retention check FAILED.
    pause
    exit /b 1
)

echo.
echo Retention dry-run completed successfully.
pause
