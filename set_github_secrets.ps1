param(
  [string]$Repo = "akaash198/orbis",
  [string]$SecretsDir = ".tmp/secrets"
)

$ErrorActionPreference = "Stop"

function Require-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing required file: $Path"
  }
}

function Read-Text([string]$Path) {
  (Get-Content -LiteralPath $Path -Raw).Trim()
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) not found. Install from https://cli.github.com/ and run: gh auth login"
}

$dir = Resolve-Path -LiteralPath $SecretsDir

$hostFile = Join-Path $dir "HETZNER_HOST.txt"
$userFile = Join-Path $dir "HETZNER_USER.txt"
$appDirFile = Join-Path $dir "HETZNER_APP_DIR.txt"
$ghcrUserFile = Join-Path $dir "GHCR_USER.txt"
$ghcrTokenFile = Join-Path $dir "GHCR_TOKEN.txt"
$sshKeyFile = Join-Path $dir "HETZNER_SSH_KEY.pem"

Require-File $hostFile
Require-File $userFile
Require-File $appDirFile
Require-File $ghcrUserFile
Require-File $ghcrTokenFile
Require-File $sshKeyFile

Write-Host "Setting secrets on repo: $Repo"
Write-Host "Using secrets dir: $dir"

# Note: we use --body-file for everything to avoid secrets appearing in command history/logs.
gh secret set HETZNER_HOST    --repo $Repo --body-file $hostFile
gh secret set HETZNER_USER    --repo $Repo --body-file $userFile
gh secret set HETZNER_APP_DIR --repo $Repo --body-file $appDirFile
gh secret set GHCR_USER       --repo $Repo --body-file $ghcrUserFile
gh secret set GHCR_TOKEN      --repo $Repo --body-file $ghcrTokenFile
gh secret set HETZNER_SSH_KEY --repo $Repo --body-file $sshKeyFile

Write-Host "Done."

