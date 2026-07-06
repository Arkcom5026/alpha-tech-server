@echo off
title AlphaTech Recovery Health Check

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Health Check
echo =====================================
echo.

node recovery\health\healthCheck.js

if errorlevel 2 (
    echo.
    echo Health Check completed with FAIL result.
    pause
    exit /b 2
)

if errorlevel 1 (
    echo.
    echo Health Check ERROR.
    pause
    exit /b 1
)

echo.
echo Health Check PASS.
pause
