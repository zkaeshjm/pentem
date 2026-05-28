<#
.SYNOPSIS
Downloads and installs the latest pentem.exe from GitHub Releases.
Usage: irm https://raw.githubusercontent.com/zkaeshjm/pentem/main/scripts/install-exe.ps1 | iex
#>

$ErrorActionPreference = "Stop"
Write-Host "=== Pentem Installer ===" -ForegroundColor Cyan

$Repo = "zkaeshjm/pentem"
$InstallDir = "$env:LOCALAPPDATA\pentem"
$ExeName = "pentem.exe"

Write-Host "[1/4] Fetching latest release..." -ForegroundColor Yellow
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Asset = $Release.assets | Where-Object { $_.name -eq $ExeName }

if (-not $Asset) {
  Write-Host "No prebuilt pentem.exe found in the latest release. Please build from source." -ForegroundColor Red
  exit 1
}

$DownloadUrl = $Asset.browser_download_url
$Version = $Release.tag_name

Write-Host "[2/4] Downloading pentem.exe ($Version)..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ExePath = "$InstallDir\$ExeName"
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ExePath

Write-Host "[3/4] Adding to PATH..." -ForegroundColor Yellow
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$InstallDir", "User")
  $env:Path += ";$InstallDir"
}

Write-Host "[4/4] Verifying installation..." -ForegroundColor Yellow
& $ExePath --help

Write-Host "`n=== pentem $Version installed successfully! ===" -ForegroundColor Green
Write-Host "  Restart your terminal or run: `$env:Path += ';$InstallDir'" -ForegroundColor Gray
Write-Host "  Then run: pentem --help" -ForegroundColor Gray
