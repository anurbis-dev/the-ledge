@echo off
setlocal
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo === the-LEDGE: dev server ===
echo Editor autosaves levels/params into src\core\defaults.js while this is running.
echo Bake button also writes settings/mix/talk. Close this window (or Ctrl+C) to stop.
echo.

cd /d "%PROJECT_DIR%"
call npm run dev -- --open

endlocal
