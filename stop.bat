@echo off
chcp 65001 >nul 2>&1
setlocal

echo ========================================
echo   QianYU TTS Desktop - Stop Services
echo ========================================
echo.

echo [1/4] Stopping Python server...
taskkill /FI "WINDOWTITLE eq QianYU TTS Server*" /F >nul 2>&1
wmic process where "commandline like '%%server.py%%'" call terminate >nul 2>&1
taskkill /IM "python.exe" /F >nul 2>&1

echo [2/4] Stopping Tauri app...
taskkill /IM "qianyu-desktop.exe" /F >nul 2>&1

echo [3/4] Cleaning Python cache...
for /r "%~dp0backend" %%d in (__pycache__) do if exist "%%d" rd /s /q "%%d"

echo [4/4] Done.
echo.
pause
