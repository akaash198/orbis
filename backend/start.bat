@echo off
echo.
echo ==========================================
echo   Orbisporte Backend API Server
echo ==========================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Creating virtual environment...
    python -m venv venv
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from template...
    copy .env.example .env
    echo.
    echo ⚠️  Please edit .env and configure your database connection!
    echo.
    pause
)

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt
echo.

REM Start the server
echo Starting Orbisporte API server...
echo API will be available at: http://localhost:8000
echo Documentation: http://localhost:8000/docs
echo.
uvicorn Orbisporte.interfaces.api.main:app --reload --host 0.0.0.0 --port 8000
