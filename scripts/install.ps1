#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Install Pentem globally on your system.
.DESCRIPTION
    Installs dependencies, builds the CLI, and links the `pentem` command globally.
    After running this script, `pentem` will be available from any directory.
#>

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ">>> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "OK $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "ERROR $Message" -ForegroundColor Red
}

Write-Host @"
  ╔══════════════════════════════════════╗
  ║        Pentem Installer             ║
  ║  Autonomous Penetration Testing CLI  ║
  ╚══════════════════════════════════════╝
"@ -ForegroundColor Magenta

# --- Check prerequisites ---
Write-Step "Checking prerequisites..."

$hasNode = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $hasNode) {
    Write-Error "Node.js >= 20 is required. Install from https://nodejs.org"
    exit 1
}

$nodeVersion = node -v
Write-Host "  Node: $nodeVersion"

# Check for pnpm or npm
$hasPnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue
$hasNpm = Get-Command "npm" -ErrorAction SilentlyContinue

if (-not $hasPnpm -and -not $hasNpm) {
    Write-Error "pnpm or npm is required. Install pnpm: https://pnpm.io/installation"
    exit 1
}

$pkgMgr = if ($hasPnpm) { "pnpm" } else { "npm" }
Write-Host "  Package manager: $pkgMgr"

# --- Get the script's directory (project root) ---
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot
Write-Host "  Project root: $ProjectRoot"

# --- Install dependencies ---
Write-Step "Installing dependencies..."
if ($pkgMgr -eq "pnpm") {
    pnpm install
    if (-not $?) { Write-Error "pnpm install failed"; exit 1 }
} else {
    npm install
    if (-not $?) { Write-Error "npm install failed"; exit 1 }
}
Write-Success "Dependencies installed"

# --- Build CLI ---
Write-Step "Building CLI..."
Set-Location -LiteralPath "$ProjectRoot\packages\pentem-cli"
if ($pkgMgr -eq "pnpm") {
    pnpm build
    if (-not $?) { Write-Error "Build failed"; exit 1 }
} else {
    npm run build
    if (-not $?) { Write-Error "Build failed"; exit 1 }
}
Write-Success "CLI built"

# --- Link globally ---
Write-Step "Linking pentem globally..."
npm link
if (-not $?) {
    # Fallback: try pnpm link
    if ($pkgMgr -eq "pnpm") {
        Write-Host "  npm link failed, trying pnpm link --global..."
        pnpm link --global 2>$null
        if (-not $?) {
            Write-Error "Global linking failed. Try running: npm link (from packages/pentem-cli)"
            exit 1
        }
    } else {
        Write-Error "Global linking failed. Try running: npm link (from packages/pentem-cli)"
        exit 1
    }
}
Write-Success "pentem linked globally"

# --- Verify ---
Write-Step "Verifying installation..."
Set-Location -LiteralPath $ProjectRoot
try {
    $helpOutput = pentem --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Pentem installed successfully!"
        Write-Host ""
        Write-Host "Try it out:" -ForegroundColor Yellow
        Write-Host "  pentem --help" -ForegroundColor Green
        Write-Host "  pentem tui" -ForegroundColor Green
        Write-Host "  pentem scan <target-url>" -ForegroundColor Green
    } else {
        Write-Error "Verification failed. Check your PATH."
    }
} catch {
    Write-Error "Could not verify. Try running 'pentem --help' manually."
}

Write-Host ""
Write-Host "Pentem is now installed!" -ForegroundColor Green
