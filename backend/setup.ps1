Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Orbisporte Backend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Activate virtual environment
Write-Host "[1/3] Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"
Write-Host ""

# Create database (if needed)
Write-Host "[2/3] Creating database..." -ForegroundColor Yellow
python create_database.py
Write-Host ""

# Initialize database tables
Write-Host "[3/3] Creating tables and test user..." -ForegroundColor Yellow
python init_db.py
Write-Host ""

Write-Host "[4/4] Applying SQL migrations (duty engine / BoE / rates)..." -ForegroundColor Yellow
.\apply_migrations.ps1
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Start the API server" -ForegroundColor White
Write-Host "Run: uvicorn Orbisporte.interfaces.api.main:app --reload" -ForegroundColor Yellow
Write-Host ""
