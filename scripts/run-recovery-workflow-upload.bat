@echo off
title AlphaTech Recovery Workflow Upload

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Workflow
echo Backup + Verify + Upload
echo =====================================
echo.

node recovery\jobRunner.js --backup-workflow --upload

if errorlevel 1 (
    echo.
    echo Workflow FAILED.
    pause
    exit /b 1
)

echo.
echo Workflow completed successfully.
pause
