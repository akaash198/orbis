param(
  [ValidateSet('workflow','smoke')]
  [string]$Mode = 'workflow'
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$artifactDir = Join-Path $PSScriptRoot "output\\playwright"
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

# Keep Node/npm tooling inside workspace (sandbox-friendly)
$env:HOME = $PSScriptRoot
$env:USERPROFILE = $PSScriptRoot
$env:NPM_CONFIG_CACHE = (Join-Path $artifactDir "npm-cache")
New-Item -ItemType Directory -Force -Path $env:NPM_CONFIG_CACHE | Out-Null

$fixturesDir = Join-Path $artifactDir "fixtures"
New-Item -ItemType Directory -Force -Path $fixturesDir | Out-Null

$fixturePdf = Join-Path $fixturesDir "e2e-invoice.pdf"
if (-not (Test-Path $fixturePdf)) {
  $candidate = Get-ChildItem -Recurse -File -Filter *.pdf -Path (Join-Path $PSScriptRoot "backend_backup") -ErrorAction SilentlyContinue `
    | Where-Object { $_.FullName -notmatch '\\\\venv\\\\|\\\\node_modules\\\\' } `
    | Sort-Object Length `
    | Select-Object -First 1
  if ($candidate) {
    Copy-Item -Force $candidate.FullName $fixturePdf
  } else {
    throw "No PDF fixture found under backend_backup to upload (expected at least one .pdf)."
  }
}

$backendLogOut = Join-Path $artifactDir "backend.out.log"
$backendLogErr = Join-Path $artifactDir "backend.err.log"
$frontendLogOut = Join-Path $artifactDir "frontend.out.log"
$frontendLogErr = Join-Path $artifactDir "frontend.err.log"

New-Item -ItemType File -Force -Path $backendLogOut,$backendLogErr,$frontendLogOut,$frontendLogErr | Out-Null

function Wait-Port([int]$Port, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    $ok = (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($ok) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Stop-ByPort([int]$Port) {
  $conns = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -ErrorAction SilentlyContinue
  $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $procIds) {
    if ($procId -le 0) { continue }
    try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
  }
}

function Invoke-PwCliChecked {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & npx --yes --package @playwright/cli playwright-cli @Args 2>&1
  } finally {
    $ErrorActionPreference = $prev
  }

  $exitCode = $LASTEXITCODE

  $hasCliError = $false
  foreach ($line in $output) {
    $text = $line.ToString()
    if ($text -like "### Error*") { $hasCliError = $true; break }
  }

  if ($exitCode -ne 0 -or $hasCliError) {
    $output | ForEach-Object { Write-Host $_.ToString() }
    throw ("Playwright CLI failed: " + ($Args -join " "))
  }

  return $output
}

$backendProc = $null
$frontendProc = $null

try {
  Write-Host "[1/4] Starting backend on :8000 ..."
  $backendPython = Join-Path $PSScriptRoot "backend\\venv\\Scripts\\python.exe"
  if (-not (Test-Path $backendPython)) {
    throw "Backend venv python not found at $backendPython"
  }

  $backendProc = Start-Process -FilePath $backendPython `
    -ArgumentList @("-m","uvicorn","Orbisporte.interfaces.api.main:app","--host","127.0.0.1","--port","8000") `
    -WorkingDirectory (Join-Path $PSScriptRoot "backend") `
    -RedirectStandardOutput $backendLogOut `
    -RedirectStandardError $backendLogErr `
    -PassThru

  if (-not (Wait-Port 8000 60)) {
    Write-Host "--- backend.err (tail) ---"
    Get-Content $backendLogErr -Tail 80 -ErrorAction SilentlyContinue
    Write-Host "--- backend.out (tail) ---"
    Get-Content $backendLogOut -Tail 80 -ErrorAction SilentlyContinue
    throw "Backend failed to start on port 8000 (is PostgreSQL running / DATABASE_URL valid?)"
  }

  Write-Host "[2/4] Starting frontend on :3000 ..."
  $frontendProc = Start-Process -FilePath "powershell" `
    -ArgumentList @(
      "-NoProfile",
      "-Command",
      "cd orbisporte-ui-master; " +
      "`$env:TEMP = (Join-Path (Get-Location) '.tmp'); " +
      "`$env:TMP = `$env:TEMP; `$env:TMPDIR = `$env:TEMP; " +
      "`$env:HOME = (Get-Location).Path; `$env:USERPROFILE = (Get-Location).Path; " +
      "`$env:NPM_CONFIG_CACHE = (Join-Path (Get-Location) '.tmp\\npm-cache'); " +
      "New-Item -ItemType Directory -Force -Path `$env:TEMP,`$env:NPM_CONFIG_CACHE | Out-Null; " +
      "node scripts/start.js"
    ) `
    -WorkingDirectory $PSScriptRoot `
    -RedirectStandardOutput $frontendLogOut `
    -RedirectStandardError $frontendLogErr `
    -PassThru

  if (-not (Wait-Port 3000 180)) {
    Write-Host "--- frontend.err (tail) ---"
    Get-Content $frontendLogErr -Tail 120 -ErrorAction SilentlyContinue
    Write-Host "--- frontend.out (tail) ---"
    Get-Content $frontendLogOut -Tail 120 -ErrorAction SilentlyContinue
    throw "Frontend failed to start on port 3000"
  }

  Write-Host "[3/4] Running Playwright E2E (playwright-cli) ..."

  # Use Microsoft Edge to avoid Chrome channel restrictions on remote debugging in some environments.
  Invoke-PwCliChecked open "http://localhost:3000/auth/login" --browser msedge | Out-Null
  $runFile = if ($Mode -eq 'smoke') { "e2e/smoke.run.js" } else { "e2e/workflow.run.js" }
  Invoke-PwCliChecked -s=default run-code --filename $runFile | Out-Null

  Invoke-PwCliChecked -s=default screenshot --full-page --filename "output/playwright/postrun.png" | Out-Null
  Invoke-PwCliChecked -s=default state-save "output/playwright/storage.json" | Out-Null

  Write-Host "[4/4] E2E passed."
  exit 0
}
catch {
  Write-Host "E2E failed: $($_.Exception.Message)"
  Write-Host "--- backend.err (tail) ---"
  Get-Content $backendLogErr -Tail 120 -ErrorAction SilentlyContinue
  Write-Host "--- frontend.err (tail) ---"
  Get-Content $frontendLogErr -Tail 120 -ErrorAction SilentlyContinue
  exit 1
}
finally {
  try { Invoke-PwCliChecked -s=default close | Out-Null } catch {}

  if ($frontendProc -and -not $frontendProc.HasExited) {
    try { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  if ($backendProc -and -not $backendProc.HasExited) {
    try { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }

  Stop-ByPort 3000
  Stop-ByPort 8000
}
