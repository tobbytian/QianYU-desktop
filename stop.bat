@echo off
chcp 65001 >nul 2>&1
setlocal

echo ========================================
echo   QianYU TTS Desktop - Stop Services
echo ========================================
echo.

echo Stopping Python server...
taskkill /FI "WINDOWTITLE eq QianYU TTS Server*" /F >nul 2>&1

echo Stopping Tauri app...
taskkill /IM "qianyu-desktop.exe" /F >nul 2>&1

echo.
echo [DONE] All services stopped.
echo.
pause
