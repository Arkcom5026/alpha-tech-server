@echo off
cd /d D:\alpha-tech\server
set "RECOVERY_RETENTION_APPLY=false"
set "RECOVERY_R2_RETENTION_APPLY=false"
node recovery\consolidatedRecoveryRunner.js
exit /b %ERRORLEVEL%
