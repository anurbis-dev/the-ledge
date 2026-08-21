@echo off
setlocal
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo === the-LEDGE: dev server ===
echo Always http://localhost:5174/  (strictPort — if busy, free it or close the other Vite).
echo Editor does NOT auto-write defaults.js — only the Bake button does.
echo Levels live in memory until Bake; reload without Bake discards map edits.
echo Close this window (or Ctrl+C) to stop.
echo.

cd /d "%PROJECT_DIR%"
call npm.cmd run dev:74

endlocal
