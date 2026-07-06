@echo off
title AlphaTech Uninstall Recovery Scheduler

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Uninstall Recovery Scheduler
echo =====================================
echo.

choice /C YN /M "Remove AlphaTech Recovery Workflow scheduled task?"
if errorlevel 2 (
    echo Cancelled.
    pause
    exit /b 0
)

node recovery\scheduler\schedulerUninstall.js

if errorlevel 1 (
    echo.
    echo Scheduler uninstall FAILED.
    pause
    exit /b 1
)

echo.
echo Scheduler uninstall completed successfully.
pause
