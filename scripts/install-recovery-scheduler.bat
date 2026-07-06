@echo off
title AlphaTech Install Recovery Scheduler

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Install Recovery Scheduler
echo =====================================
echo.

node recovery\scheduler\schedulerInstaller.js

if errorlevel 1 (
    echo.
    echo Scheduler install FAILED.
    pause
    exit /b 1
)

echo.
echo Scheduler install completed successfully.
pause
