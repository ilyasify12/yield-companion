@echo off
title YIELD COMPANION
echo ============================================
echo   YIELD COMPANION
echo   Starting servers...
echo ============================================
echo.

:: Start the desktop service in a new window
echo [1/3] Starting Desktop Service (port 3001)...
start "Aura Desktop Service" cmd /c "cd /d "%~dp0desktop" && npm run dev"

:: Wait a moment for the desktop service to initialize
timeout /t 2 /nobreak > nul

:: Start the main server + frontend
echo [2/3] Starting Aura AI Server (port 3000)...
start "Aura AI Server" cmd /c "cd /d "%~dp0" && npm run dev"

:: Wait for the server to be ready
echo [3/3] Waiting for server...
:wait
timeout /t 1 /nobreak > nul
>nul 2>&1 curl -s http://localhost:3000/api/health && goto :ready
goto :wait

:ready
echo.
echo ============================================
echo   YIELD COMPANION is running!
echo   Open: http://localhost:3000
echo ============================================
start http://localhost:3000

echo.
echo Press any key to stop all servers...
pause > nul

:: Kill both server processes
echo Shutting down...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im tsx.exe >nul 2>&1
echo Done.
