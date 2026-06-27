@echo off
chcp 65001 >nul 2>&1
setlocal

echo ========================================
echo   QianYU TTS Desktop - Dev Mode
echo ========================================
echo.

set "PROJECT_ROOT=%~dp0"
set "PYTHON=%PROJECT_ROOT%backend\WPy64-312101\python\python.exe"
set "SERVER=%PROJECT_ROOT%server.py"

echo [1/2] Starting Python TTS Server (port 8088)...
echo   - Python: %PYTHON%
echo   - Server: %SERVER%
echo.

start "QianYU TTS Server" cmd /k "cd /d "%PROJECT_ROOT%" && "%PYTHON%" "%SERVER%" --port 8088 --preload"

echo [2/2] Waiting for server to start (10 seconds)...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   Server should be ready!
echo   - Python Server: http://127.0.0.1:8088
echo   - Starting Tauri App...
echo ========================================
echo.

cd /d "%PROJECT_ROOT%"
npm run tauri dev

echo.
echo [INFO] Tauri app closed. Server window is still running.
echo [INFO] Close the server window manually or run stop.bat.
echo.
pause
