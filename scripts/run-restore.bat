@echo off
title AlphaTech Restore Tool

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Restore Tool
echo =====================================
echo.

set "MANIFEST_PATH=%~1"

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
    pause
    exit /b 1
)

:FOUND_MANIFEST
echo Selected manifest:
echo   %MANIFEST_PATH%
echo.
echo This will run:
echo   node qbrs.js --manifest "%MANIFEST_PATH%" --init
echo.

choice /C YN /M "Continue restore using this manifest?"
if errorlevel 2 (
    echo Restore cancelled.
    pause
    exit /b 0
)

node qbrs.js --manifest "%MANIFEST_PATH%" --init

if errorlevel 1 (
    echo.
    echo Restore FAILED.
    pause
    exit /b 1
)

echo.
echo Restore completed successfully.
pause
