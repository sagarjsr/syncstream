@echo off
:: SyncStream Application Startup S::Install project dependencies (shared node_modules)
echo 📦 Checking project dependencies...
cd /d "%SCRIPT_DIR%"
if not exist "node_modules" (
    echo Installing project dependencies (this includes both frontend and backend)...
    npm install
    echo ✅ All dependencies installed in shared node_modules
) else (
    echo ✅ Dependencies already installed in shared node_modules
): This script starts both the backend server and frontend development server

echo 🚀 Starting SyncStream Application...

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

:: Get script directory
set SCRIPT_DIR=%~dp0
echo 📁 Script directory: %SCRIPT_DIR%

:: Backend directory
set BACKEND_DIR=%SCRIPT_DIR%syncstream-server
:: Frontend directory
set FRONTEND_DIR=%SCRIPT_DIR%syncstream-web

:: Check if directories exist
if not exist "%BACKEND_DIR%" (
    echo ❌ Backend directory not found: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%" (
    echo ❌ Frontend directory not found: %FRONTEND_DIR%
    pause
    exit /b 1
)

:: Install backend dependencies
echo 📦 Checking backend dependencies...
cd /d "%BACKEND_DIR%"
if not exist "node_modules" (
    echo Installing backend dependencies...
    npm install
) else (
    echo ✅ Backend dependencies already installed
)

:: Install frontend dependencies
echo 📦 Checking frontend dependencies...
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
) else (
    echo ✅ Frontend dependencies already installed
)

echo 🔧 Starting services...

:: Start backend server
echo Starting backend server...
cd /d "%BACKEND_DIR%"
start "SyncStream Backend" node server.js

:: Wait for backend to start
timeout /t 3 /nobreak

:: Start frontend server
echo Starting frontend development server...
cd /d "%FRONTEND_DIR%"
start "SyncStream Frontend" npm run dev

:: Wait for frontend to start
timeout /t 3 /nobreak

echo.
echo 🎉 SyncStream is now running!
echo 🌐 Frontend: http://localhost:3000
echo 🔗 Backend:  http://localhost:3001
echo.
echo 📝 How to use:
echo 1. Open http://localhost:3000 in your browser
echo 2. Create a room or join an existing one
echo 3. Share the room link with others to watch together
echo.
echo Press any key to exit this script (servers will keep running)
pause >nul
