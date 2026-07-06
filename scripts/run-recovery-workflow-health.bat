@echo off
title AlphaTech Recovery Workflow Health-aware

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Workflow
echo Health-aware Backup Workflow
echo =====================================
echo.

node recovery\jobRunner.js --backup-workflow

if errorlevel 1 (
    echo.
    echo Workflow FAILED.
    pause
    exit /b 1
)

echo.
echo Workflow completed successfully.
pause
