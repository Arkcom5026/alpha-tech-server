@echo off
title AlphaTech Restore Tool - Standby Sync Ready

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Restore Tool
echo Standby Sync Ready
echo =====================================
echo.

set "MANIFEST_PATH=%~1"
set "AUTO_YES=0"

if /I "%~2"=="--yes" set "AUTO_YES=1"
if /I "%~2"=="-y" set "AUTO_YES=1"
if /I "%~1"=="--yes" (
    set "AUTO_YES=1"
    set "MANIFEST_PATH="
)
if /I "%~1"=="-y" (
    set "AUTO_YES=1"
    set "MANIFEST_PATH="
)

if "%MANIFEST_PATH%"=="" (
    echo No manifest path provided.
    echo Searching latest manifest in:
    echo   D:\alpha-tech\server\backups
    echo.

    for /f "delims=" %%F in ('dir /b /a:-d /o:-d "D:\alpha-tech\server\backups\*.manifest.json" 2^>nul') do (
        set "MANIFEST_PATH=D:\alpha-tech\server\backups\%%F"
        goto :FOUND_MANIFEST
    )

    echo No manifest file found in D:\alpha-tech\server\backups
    echo.
    echo You can also run:
    echo   scripts\run-restore.bat "D:\alpha-tech\server\backups\your-backup.manifest.json"
    echo.
    pause
    exit /b 1
)

:FOUND_MANIFEST
echo Selected manifest:
echo   %MANIFEST_PATH%
echo.
echo This will run:
echo   node qbrs.js --manifest "%MANIFEST_PATH%" --init --reset-schema --yes
echo.
echo WARNING:
echo   This resets the Recovery/Standby DB schema before restore.
echo   Use only with RESTORE_DATABASE_URL / RECOVERY_DATABASE_URL pointing to Recovery DB.
echo.

if "%AUTO_YES%"=="0" (
    choice /C YN /M "Continue restore using this manifest?"
    if errorlevel 2 (
        echo Restore cancelled.
        pause
        exit /b 0
    )
)

node qbrs.js --manifest "%MANIFEST_PATH%" --init --reset-schema --yes

set "RESTORE_EXIT=%ERRORLEVEL%"

if not "%RESTORE_EXIT%"=="0" (
    echo.
    echo Restore FAILED. exitCode=%RESTORE_EXIT%
    if "%AUTO_YES%"=="0" pause
    exit /b %RESTORE_EXIT%
)

echo.
echo Restore completed successfully.

if "%AUTO_YES%"=="0" pause
exit /b 0
