@echo off
echo ========================================
echo Starting Orbisporte Backend Server
echo ========================================
echo.

REM Change to backend directory
cd /d "%~dp0"

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Start backend server
echo.
echo Starting backend API server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
uvicorn Orbisporte.interfaces.api.main:app --reload

pause
