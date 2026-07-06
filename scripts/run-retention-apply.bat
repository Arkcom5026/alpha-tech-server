@echo off
title AlphaTech Retention Apply

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Retention Policy
echo APPLY
echo =====================================
echo.

choice /C YN /M "Apply retention policy and delete expired backup files?"
if errorlevel 2 (
    echo Cancelled.
    pause
    exit /b 0
)

node recovery\retention\retentionPolicy.js --apply

if errorlevel 1 (
    echo.
    echo Retention apply FAILED.
    pause
    exit /b 1
)

echo.
echo Retention apply completed successfully.
pause
