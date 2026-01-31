@echo off
echo Building main process...
call npm run build:main

echo.
echo Building renderer process...
call npm run build:renderer

echo.
echo Starting Electron...
call npm start
