param(
  [switch]$SkipPgVector = $true,
  [string]$PsqlPath = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Get-EnvValue([string]$Key) {
  $line = Get-Content .env -ErrorAction Stop | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  $value = ($line -split "=", 2)[1].Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
  if ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
  return $value
}

function Resolve-PsqlPath {
  if ($PsqlPath -and (Test-Path $PsqlPath)) { return (Resolve-Path $PsqlPath).Path }

  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) { return $cmd.Source }

  $candidates = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files\PostgreSQL\13\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\pgAdmin 4\runtime\psql.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }

  throw "psql.exe not found. Install PostgreSQL client tools or pass -PsqlPath."
}

$psql = Resolve-PsqlPath

$dbHost = Get-EnvValue "DB_HOST"
$dbPort = Get-EnvValue "DB_PORT"
$dbUser = Get-EnvValue "DB_USER"
$dbPass = Get-EnvValue "DB_PASSWORD"
$dbName = Get-EnvValue "DB_NAME"

if (-not $dbHost) { $dbHost = "localhost" }
if (-not $dbPort) { $dbPort = "5432" }
if (-not $dbUser) { $dbUser = "postgres" }
if (-not $dbName) { $dbName = "orbisporte_db" }

# Avoid printing credentials; psql uses these env vars.
$env:PGHOST = $dbHost
$env:PGPORT = $dbPort
$env:PGUSER = $dbUser
$env:PGPASSWORD = $dbPass
$env:PGDATABASE = $dbName

Write-Host "Using psql: $psql"
Write-Host "Target DB: $dbUser@$dbHost`:$dbPort/$dbName"

function Run-Psql {
  param([string[]]$PsqlArgs)
  & $psql @PsqlArgs
  if ($LASTEXITCODE -ne 0) { throw ("psql failed: " + ($PsqlArgs -join " ")) }
}

# Migration tracking table
$createMigrationsSql = @"
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"@ -replace "(\r?\n)+", " "

Run-Psql @("-v", "ON_ERROR_STOP=1", "-c", $createMigrationsSql)

$hasVector = $false
try {
  $out = & $psql -tA -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_available_extensions WHERE name='vector' LIMIT 1;"
  if ($out -match "1") { $hasVector = $true }
} catch {
  $hasVector = $false
}

if ($SkipPgVector -and -not $hasVector) {
  Write-Host "pgvector not available; skipping migrations 010/011."
}

$migrationFiles = Get-ChildItem -File -Path (Join-Path $PSScriptRoot "migrations") -Filter "*.sql" `
  | Where-Object { $_.Name -match "^\d{3}_.+\.sql$" } `
  | Sort-Object Name

foreach ($file in $migrationFiles) {
  if ($SkipPgVector -and -not $hasVector -and ($file.Name -match "^(010|011)_")) {
    continue
  }

  $escaped = $file.Name.Replace("'", "''")
  $applied = & $psql -tA -v ON_ERROR_STOP=1 -c "SELECT 1 FROM schema_migrations WHERE filename = '$escaped' LIMIT 1;"
  if ($LASTEXITCODE -ne 0) { throw "psql failed checking schema_migrations for $($file.Name)" }
  if ($applied -match "1") {
    Write-Host "SKIP  $($file.Name)"
    continue
  }

  Write-Host "APPLY $($file.Name)"
  Run-Psql @("-v", "ON_ERROR_STOP=1", "-f", $file.FullName)

  $hash = (Get-FileHash -Algorithm SHA256 -Path $file.FullName).Hash.ToLowerInvariant()
  Run-Psql @("-v", "ON_ERROR_STOP=1", "-c", "INSERT INTO schema_migrations (filename, checksum) VALUES ('$escaped', '$hash') ON CONFLICT (filename) DO NOTHING;")
}

Write-Host "Migrations complete."
