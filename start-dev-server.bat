@echo off
setlocal
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo === the-LEDGE: dev server ===
echo Editor does NOT auto-write defaults.js — only the Bake button does.
echo Levels live in memory until Bake; reload without Bake discards map edits.
echo Close this window (or Ctrl+C) to stop.
echo.

cd /d "%PROJECT_DIR%"
call npm run dev -- --open

endlocal
