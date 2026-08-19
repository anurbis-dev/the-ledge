@echo off
setlocal
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

echo === the-LEDGE: stop dev servers, clear cache, rebuild ===
echo Project: %PROJECT_DIR%
echo.
echo Switching away from the game tab flushes src\core\defaults.js (keep the
echo editor's last edits). Waiting 1s so an in-flight bake can finish...
timeout /t 1 /nobreak >nul
echo.

echo [1/3] Stopping vite/node dev servers for this project...
powershell -NoProfile -Command ^
  "$dir = '%PROJECT_DIR%';" ^
  "$procs = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($dir.ToLower()) };" ^
  "if ($procs) {" ^
  "  foreach ($p in $procs) { Write-Host ('  killing PID ' + $p.ProcessId + ' : ' + $p.CommandLine); Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }" ^
  "} else { Write-Host '  none found' }"

echo.
echo [2/3] Clearing vite cache...
if exist "%PROJECT_DIR%\node_modules\.vite" (
  rmdir /s /q "%PROJECT_DIR%\node_modules\.vite"
  echo   removed node_modules\.vite
) else (
  echo   nothing to clear
)

echo.
echo [3/3] Building latest dist\index.html...
cd /d "%PROJECT_DIR%"
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  pause
  exit /b 1
)

echo.
echo === Done. Opening dist\index.html ===
start "" "%PROJECT_DIR%\dist\index.html"

endlocal
