@echo off
setlocal enabledelayedexpansion

echo =========================================================
echo       Story Studio - Windows Build Engine
echo =========================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

:: 2. Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: 3. Setup Virtual Environment
if not exist "venv\Scripts\python.exe" (
    echo [1/6] Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo [2/6] Installing backend dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
pip install pyinstaller

:: 4. Install NPM packages
echo [3/6] Installing Node dependencies...
call npm install

:: 5. Prepare Windows FFmpeg
echo [4/6] Preparing bundled FFmpeg binary...
node scripts\prepare-bin.cjs

:: 6. Build Backend with PyInstaller
echo [5/6] Building Python backend executable (storyreel-backend.exe)...
node scripts\build-backend.cjs
if errorlevel 1 (
    echo [ERROR] Failed to compile backend with PyInstaller!
    pause
    exit /b 1
)

:: 7. Build UI & Electron Installer
echo [6/6] Compiling Vite UI and generating Windows Installer (.exe)...
call npm run build:ui
if errorlevel 1 (
    echo [ERROR] Vite build failed!
    pause
    exit /b 1
)

call npx electron-builder --win
if errorlevel 1 (
    echo [ERROR] electron-builder failed!
    pause
    exit /b 1
)

echo.
echo =========================================================
echo [SUCCESS] Windows Installer created successfully!
echo Location: dist_electron\Story Studio Setup 1.0.0.exe
echo =========================================================
echo.
pause
