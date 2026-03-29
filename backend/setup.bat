@echo off
echo ========================================
echo Orbisporte Backend Setup
echo ========================================
echo.

REM Activate virtual environment
echo [1/3] Activating virtual environment...
call venv\Scripts\activate.bat
echo.

REM Create database (if needed)
echo [2/3] Creating database...
python create_database.py
echo.

REM Initialize database tables
echo [3/3] Creating tables and test user...
python init_db.py
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next step: Start the API server
echo Run: python -m uvicorn Orbisporte.interfaces.api.main:app --reload
echo.
pause
