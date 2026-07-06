@echo off
cd /d D:\alpha-tech\server
node recovery\jobRunner.js --backup-workflow --upload --retention
exit /b %ERRORLEVEL%
