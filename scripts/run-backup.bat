@echo off
title AlphaTech Daily Backup

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Hardened Backup v6
echo =====================================

node qb.js

if errorlevel 1 (
    echo.
    echo Backup FAILED.
    pause
    exit /b 1
)

echo.
echo Backup completed successfully.
pause
