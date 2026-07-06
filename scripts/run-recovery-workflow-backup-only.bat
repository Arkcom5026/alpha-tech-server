@echo off
title AlphaTech Recovery Workflow Backup Only

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Workflow
echo Backup Only
echo =====================================
echo.

node recovery\jobRunner.js --backup-only

if errorlevel 1 (
    echo.
    echo Workflow FAILED.
    pause
    exit /b 1
)

echo.
echo Workflow completed successfully.
pause
