<#
.SYNOPSIS
Builds pentem.exe as a standalone Windows executable using Node.js SEA.
#>

param(
  [string]$OutputDir = "dist-exe",
  [string]$ExeName = "pentem.exe"
)

$ErrorActionPreference = "Stop"
Write-Host "=== Building pentem.exe ===" -ForegroundColor Cyan

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# Step 1: Install dependencies and build workspace (builds shared packages)
Write-Host "[1/4] Building workspace..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
  pnpm build
  if ($LASTEXITCODE -ne 0) { throw "pnpm build failed" }
} finally { Pop-Location }

# Step 2: Bundle with esbuild (includes blessed with patched dynamic requires)
Write-Host "[2/4] Bundling with esbuild..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
  node scripts/bundle-exe.mjs
  if ($LASTEXITCODE -ne 0) { throw "esbuild bundle failed" }
} finally { Pop-Location }

# Step 3: Create SEA blob
Write-Host "[3/4] Generating SEA blob..." -ForegroundColor Yellow
$CjsEntry = "$ProjectRoot\packages\pentem-cli\dist\sea-entry.cjs"
$SeaConfig = @{
  main = $CjsEntry
  output = "$ProjectRoot\sea-prep.blob"
  disableExperimentalSEAWarning = $true
} | ConvertTo-Json -Compress
$SeaConfig | Set-Content -Path "$ProjectRoot\sea-config.json" -Encoding utf8

Push-Location $ProjectRoot
try {
  node --experimental-sea-config sea-config.json
  if ($LASTEXITCODE -ne 0) { throw "SEA blob generation failed" }
} finally { Pop-Location }

# Step 4: Create EXE
Write-Host "[4/4] Creating executable..." -ForegroundColor Yellow
$OutputPath = "$ProjectRoot\$OutputDir"
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
$ExePath = "$OutputPath\$ExeName"

Copy-Item (Get-Command node.exe).Source $ExePath -Force

npx --yes postject $ExePath NODE_SEA_BLOB $ProjectRoot\sea-prep.blob `
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

if ($LASTEXITCODE -ne 0) { throw "postject injection failed" }

# Cleanup
Remove-Item $ProjectRoot\sea-config.json -Force -ErrorAction SilentlyContinue
Remove-Item $ProjectRoot\sea-prep.blob -Force -ErrorAction SilentlyContinue

$Size = [math]::Round((Get-Item $ExePath).Length / 1MB, 1)
Write-Host "`n=== pentem.exe built successfully! ===" -ForegroundColor Green
Write-Host "  Path: $ExePath" -ForegroundColor Green
Write-Host "  Size: $Size MB" -ForegroundColor Green
