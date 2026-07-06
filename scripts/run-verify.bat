@echo off
title AlphaTech Integrity Verification

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Integrity Verification
echo =====================================
echo.

node recovery\verify\qbv.js

if errorlevel 2 (
    echo.
    echo Verification completed with FAIL result.
    pause
    exit /b 2
)

if errorlevel 1 (
    echo.
    echo Verification ERROR.
    pause
    exit /b 1
)

echo.
echo Verification PASS.
pause
