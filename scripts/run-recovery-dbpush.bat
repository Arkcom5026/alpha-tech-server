@echo off
title AlphaTech Recovery DB Push

cd /d D:\alpha-tech\server

echo =====================================
echo AlphaTech Recovery Prisma DB Push
echo =====================================
echo.
echo This script reads .env.recovery or .env.restore and injects DATABASE_URL only for this command.
echo Production .env will not be overwritten.
echo.

node -e "require('dotenv').config({path:'.env.restore'}); try{require('dotenv').config({path:'.env.recovery', override:false})}catch(e){}; const url=process.env.RESTORE_DATABASE_URL||process.env.RECOVERY_DATABASE_URL; if(!url){console.error('Missing RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL'); process.exit(1)}; const cp=require('child_process'); const env={...process.env,DATABASE_URL:url,DIRECT_URL:url}; const p=cp.spawn('npx',['prisma','db','push'],{stdio:'inherit',shell:true,env}); p.on('close', c=>process.exit(c));"

if errorlevel 1 (
    echo.
    echo Recovery db push FAILED.
    pause
    exit /b 1
)

echo.
echo Recovery db push completed successfully.
pause
