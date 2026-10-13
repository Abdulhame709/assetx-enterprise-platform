# AssetX - daily backup of the local database "assetx".
# Runs by itself from Windows Task Scheduler (see db-backup-setup.ps1) or by hand:
#   powershell -File scripts\db-backup.ps1            (skips if a backup newer than 6 hours exists)
#   powershell -File scripts\db-backup.ps1 -Force     (always takes a new backup)
# Uses the saved login in %APPDATA%\postgresql\pgpass.conf, so it never asks for a password.
# Keeps the newest $Keep daily files and verifies every dump before it counts as a success.
param(
  [int]$Keep = 14,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$backupDir = Join-Path $env:USERPROFILE 'Documents\assetx-backups\daily'
$logFile   = Join-Path $env:USERPROFILE 'Documents\assetx-backups\backup.log'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Write-Log([string]$message) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

$dump = Join-Path $backupDir ('assetx-{0}.dump' -f (Get-Date -Format 'yyyyMMdd'))
try {
  # newest installed PostgreSQL tools
  $pgRoot = 'C:\Program Files\PostgreSQL'
  $pgBin = Get-ChildItem $pgRoot -Directory -ErrorAction Stop |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin\pg_dump.exe') } |
    Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
    Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'bin' }
  if (-not $pgBin) { throw 'PostgreSQL tools (pg_dump.exe) were not found.' }

  $name = Split-Path $dump -Leaf
  if (-not $Force -and (Test-Path $dump) -and ((Get-Date) - (Get-Item $dump).LastWriteTime).TotalHours -lt 6) {
    Write-Log "SKIP  a recent backup already exists: $name"
    exit 0
  }

  $tmp = "$dump.partial"
  Remove-Item $tmp -ErrorAction SilentlyContinue
  & "$pgBin\pg_dump.exe" -h 127.0.0.1 -U assetx_migrator -d assetx --no-owner -Fc -f $tmp
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tmp)) { throw 'pg_dump failed (check that PostgreSQL is running and the saved login is correct).' }

  # verify: the file must be readable and must contain data for the main tables
  $toc = & "$pgBin\pg_restore.exe" --list $tmp
  if ($LASTEXITCODE -ne 0) { throw 'The new backup file is not readable - it was discarded.' }
  $dataEntries = @($toc | Where-Object { $_ -match 'TABLE DATA public (assets|inventory_cycles|inventory_records|users)\b' }).Count
  if ($dataEntries -lt 4) { throw 'The new backup is missing core tables - it was discarded.' }
  if ((Get-Item $tmp).Length -lt 10000) { throw 'The new backup is suspiciously small - it was discarded.' }

  Move-Item -Force $tmp $dump
  $kb = [math]::Round((Get-Item $dump).Length / 1KB)
  Write-Log "OK    $name ($kb KB)"

  # retention: delete only our own daily files beyond the newest $Keep
  Get-ChildItem $backupDir -Filter 'assetx-????????.dump' |
    Sort-Object Name -Descending | Select-Object -Skip $Keep |
    ForEach-Object { Remove-Item $_.FullName; Write-Log "PRUNE $($_.Name)" }
  exit 0
}
catch {
  Remove-Item "$dump.partial" -ErrorAction SilentlyContinue
  Write-Log "FAIL  $($_.Exception.Message)"
  exit 1
}
