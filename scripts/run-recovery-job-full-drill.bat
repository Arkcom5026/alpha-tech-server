@echo off
title AlphaTech Recovery Job - Full Drill

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Job Runner
echo Full Drill
echo =====================================
echo.
echo This will run:
echo   Backup
echo   Restore to Recovery DB
echo   Verify Production vs Recovery
echo.

choice /C YN /M "Continue full recovery drill?"
if errorlevel 2 (
    echo Cancelled.
    pause
    exit /b 0
)

node recovery\jobRunner.js --full-drill

if errorlevel 1 (
    echo.
    echo Job FAILED.
    pause
    exit /b 1
)

echo.
echo Job completed successfully.
pause
