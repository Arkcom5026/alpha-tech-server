@echo off
cd /d D:\alpha-tech\server
node recovery\consolidatedRecoveryRunner.js
exit /b %ERRORLEVEL%
