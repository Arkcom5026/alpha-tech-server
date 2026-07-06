@echo off
title AlphaTech Recovery Run Now

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Scheduler Run Now
echo =====================================
echo.

node recovery\scheduler\schedulerRunNow.js

if errorlevel 1 (
    echo.
    echo Run Now FAILED.
    pause
    exit /b 1
)

echo.
echo Run Now request sent.
echo Use scripts\recovery-scheduler-status.bat to check result.
pause
