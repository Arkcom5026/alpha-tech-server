@echo off
title AlphaTech Recovery Workflow Full Drill

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Workflow
echo Full Drill
echo =====================================
echo.

choice /C YN /M "Continue full recovery workflow?"
if errorlevel 2 (
    echo Cancelled.
    pause
    exit /b 0
)

node recovery\jobRunner.js --full-drill

if errorlevel 1 (
    echo.
    echo Workflow FAILED.
    pause
    exit /b 1
)

echo.
echo Workflow completed successfully.
pause
