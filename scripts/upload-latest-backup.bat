@echo off
title AlphaTech Upload Latest Backup

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Upload Latest Backup
echo =====================================
echo.

for /f "delims=" %%F in ('dir /b /a:-d /o:-d "D:\alpha-tech\server\backups\*.manifest.json" 2^>nul') do (
    set "MANIFEST_PATH=D:\alpha-tech\server\backups\%%F"
    goto :FOUND
)

echo No manifest found.
pause
exit /b 1

:FOUND
echo Selected manifest:
echo   %MANIFEST_PATH%
echo.

node recovery\upload\uploadBackup.js --manifest "%MANIFEST_PATH%"

if errorlevel 1 (
    echo.
    echo Upload FAILED.
    pause
    exit /b 1
)

echo.
echo Upload completed successfully.
pause
