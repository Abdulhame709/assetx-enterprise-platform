# AssetX - one-time setup of the automatic daily backup.
#   powershell -File scripts\db-backup-setup.ps1
# 1) asks once for the password of the PostgreSQL role "assetx_migrator"
# 2) checks it, then saves it in YOUR Windows profile only (%APPDATA%\postgresql\pgpass.conf,
#    PostgreSQL's standard password file, readable only by your Windows account)
# 3) takes a first backup, then registers a Windows scheduled task "AssetX-DB-Backup"
#    (daily at 13:30 and at every sign-in; if the PC was off it runs when it is next on).
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'db-backup.ps1'
$pgRoot = 'C:\Program Files\PostgreSQL'
$pgBin = Get-ChildItem $pgRoot -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName 'bin\psql.exe') } |
  Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
  Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'bin' }
if (-not $pgBin) { throw 'PostgreSQL tools were not found.' }

$secure = Read-Host 'Password of assetx_migrator' -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
try {
  Write-Host '1/4 Checking the password ...'
  $env:PGPASSWORD = $plain
  $ok = & "$pgBin\psql.exe" -h 127.0.0.1 -U assetx_migrator -d assetx -At -c 'select 1'
  if ($LASTEXITCODE -ne 0 -or $ok -ne '1') { throw 'Could not connect with that password - nothing was saved.' }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host '2/4 Saving the login for the backup task (your Windows account only) ...'
$dir  = Join-Path $env:APPDATA 'postgresql'
$file = Join-Path $dir 'pgpass.conf'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$escaped = $plain.Replace('\', '\\').Replace(':', '\:')
$entry   = "127.0.0.1:5432:assetx:assetx_migrator:$escaped"
$kept = @()
if (Test-Path $file) { $kept = @(Get-Content $file | Where-Object { $_ -and -not $_.StartsWith('127.0.0.1:5432:assetx:assetx_migrator:') }) }
Set-Content -Path $file -Value ($kept + $entry) -Encoding ASCII
& icacls.exe $file /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
$plain = $null

Write-Host '3/4 Taking the first backup ...'
& powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File $script -Force
if ($LASTEXITCODE -ne 0) { throw 'The first backup failed - the scheduled task was NOT created. See Documents\assetx-backups\backup.log' }

Write-Host '4/4 Registering the scheduled task ...'
$action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File `"$script`""
$triggers = @((New-ScheduledTaskTrigger -Daily -At '13:30'), (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'AssetX-DB-Backup' -Action $action -Trigger $triggers -Settings $settings -Description 'Daily backup of the local AssetX database' -Force | Out-Null

Write-Host 'DONE - automatic backups are on. Folder: Documents\assetx-backups\daily  (log: Documents\assetx-backups\backup.log)' -ForegroundColor Green
