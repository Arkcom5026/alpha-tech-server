@echo off
title AlphaTech Recovery State

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery State
echo =====================================
echo.

node recovery\state\readRecoveryState.js

echo.
pause
