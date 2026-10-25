@echo off
chcp 65001 > nul
echo ========================================================
echo        IELTS Speaking AI - Telegram Bot Launcher
echo ========================================================
echo.

cd /d "%~dp0"

if not exist ".env" (
    echo [!] .env fayli topilmadi. Iltimos, .env faylini to'ldiring!
    pause
    exit /b
)

echo Bot ishga tushirilmoqda...
"..\speaking-analyzer\.venv\Scripts\python.exe" bot.py
pause
