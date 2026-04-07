@echo off
REM ============================================
REM Orbisporte Docker Management Script (Windows)
REM ============================================

setlocal enabledelayedexpansion

:check_admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Some commands may require administrator privileges.
)

:menu
cls
echo.
echo  ================================================================================
echo                    Orbisporte Docker Management Script
echo              AI-Powered Indian Customs Document Processing Platform
echo                       SPECTRA AI PTE. LTD., Singapore
echo  ================================================================================
echo.
echo   1. Start all services
echo   2. Stop all services
echo   3. Restart all services
echo   4. Build Docker images
echo   5. Show service status
echo   6. View logs
echo   7. Clean up (remove containers and volumes)
echo   8. Setup environment (.env)
echo   9. Help
echo   0. Exit
echo.
echo  ================================================================================
set /p choice="Select an option: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto build
if "%choice%"=="5" goto status
if "%choice%"=="6" goto logs
if "%choice%"=="7" goto clean
if "%choice%"=="8" goto setup_env
if "%choice%"=="9" goto help
if "%choice%"=="0" goto end

echo [ERROR] Invalid option. Please try again.
timeout /t 2 >nul
goto menu

:start
echo.
echo [INFO] Starting Orbisporte services...
call docker-compose up -d
echo.
echo ================================================================================
echo.
echo   SUCCESS! Orbisporte is now running!
echo.
echo   Frontend:   http://localhost:3000
echo   Backend:    http://localhost:8000
echo   API Docs:   http://localhost:8000/docs
echo.
echo ================================================================================
echo.
pause
goto menu

:stop
echo.
echo [INFO] Stopping Orbisporte services...
call docker-compose down
echo [SUCCESS] Services stopped.
echo.
pause
goto menu

:restart
echo.
echo [INFO] Restarting Orbisporte services...
call docker-compose down
call docker-compose up -d
echo [SUCCESS] Services restarted.
echo.
pause
goto menu

:build
echo.
echo [INFO] Building Docker images...
call docker-compose build --parallel
echo [SUCCESS] Docker images built successfully.
echo.
pause
goto menu

:status
echo.
echo [INFO] Service Status:
call docker-compose ps
echo.
pause
goto menu

:logs
cls
echo.
echo [INFO] Viewing logs (Press Ctrl+C to exit)...
echo.
docker-compose logs -f
goto menu

:clean
echo.
echo [WARNING] This will remove ALL containers, volumes, and images!
set /p confirm="Are you sure? (yes/no): "
if /i "%confirm%"=="yes" (
    echo [INFO] Cleaning up...
    call docker-compose down -v --remove-orphans
    call docker system prune -f
    echo [SUCCESS] Cleanup complete.
) else (
    echo [INFO] Cleanup cancelled.
)
echo.
pause
goto menu

:setup_env
if exist ".env" (
    echo [INFO] .env file already exists.
) else (
    if exist ".env.example" (
        echo [INFO] Creating .env file from template...
        copy .env.example .env
        echo [SUCCESS] Created .env file. Please edit it with your configuration.
    ) else (
        echo [ERROR] .env.example not found.
    )
)
echo.
pause
goto menu

:help
cls
echo.
echo ================================================================================
echo                         Orbisporte Docker Management
echo ================================================================================
echo.
echo Usage: manage.bat [option]
echo.
echo Options:
echo   1    Start all services
echo   2    Stop all services
echo   3    Restart all services
echo   4    Build Docker images
echo   5    Show service status
echo   6    View logs
echo   7    Clean up (remove containers and volumes)
echo   8    Setup environment (.env)
echo   9    Show this help message
echo   0    Exit
echo.
echo Services:
echo   - frontend:  React app served via Nginx on port 3000
echo   - backend:   FastAPI on port 8000
echo   - postgres:  PostgreSQL on port 5432
echo   - redis:     Redis on port 6379
echo.
echo ================================================================================
pause
goto menu

:end
echo.
echo [INFO] Goodbye!
echo.
exit /b 0
