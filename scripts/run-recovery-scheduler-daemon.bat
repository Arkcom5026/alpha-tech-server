@echo off
title AlphaTech Recovery Scheduler Daemon

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Scheduler Daemon
echo =====================================
echo.
echo Default interval is controlled by RECOVERY_SCHEDULE_HOURS in .env
echo Default mode is controlled by RECOVERY_SCHEDULE_MODE in .env
echo.

node recovery\scheduler\recoveryScheduler.js --daemon --mode backup-only

pause
