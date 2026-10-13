# AssetX - proves that a backup can really be restored. It NEVER touches your live database:
# it restores into a temporary database "assetx_restore_check", compares row counts with the
# live database, prints the result and deletes the temporary database.
#   powershell -File scripts\db-restore-check.ps1                (uses the newest daily backup)
#   powershell -File scripts\db-restore-check.ps1 -Dump <file>   (a specific backup)
#   add -Keep to leave the temporary database in place for inspection
# Asks once for the password of the PostgreSQL administrator role "postgres" (not stored anywhere).
param(
  [string]$Dump,
  [switch]$Keep
)
$ErrorActionPreference = 'Stop'
$testDb = 'assetx_restore_check'
$pgRoot = 'C:\Program Files\PostgreSQL'
$pgBin = Get-ChildItem $pgRoot -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName 'bin\pg_restore.exe') } |
  Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
  Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'bin' }
if (-not $pgBin) { throw 'PostgreSQL tools were not found.' }

if (-not $Dump) {
  $latest = Get-ChildItem (Join-Path $env:USERPROFILE 'Documents\assetx-backups\daily') -Filter 'assetx-????????.dump' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if (-not $latest) { throw 'No daily backup found. Run scripts\db-backup.ps1 first.' }
  $Dump = $latest.FullName
}
if (-not (Test-Path $Dump)) { throw "Backup file not found: $Dump" }
Write-Host "Backup under test: $Dump"

$secure = Read-Host 'Password of postgres (administrator)' -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$tables = 'tenants', 'users', 'employees', 'locations', 'assets', 'asset_movements', 'inventory_cycles', 'inventory_records', 'audit_events'
function Count-Rows([string]$db, [string]$table) {
  $v = & "$pgBin\psql.exe" -h 127.0.0.1 -U postgres -d $db -At -c "select count(*) from public.$table"
  if ($LASTEXITCODE -ne 0) { return -1 }
  return [int]$v
}
try {
  Write-Host "1/4 Creating temporary database $testDb ..."
  & "$pgBin\psql.exe" -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $testDb" -c "CREATE DATABASE $testDb"
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the temporary database (wrong password?).' }

  Write-Host '2/4 Restoring the backup into it ...'
  # pg_restore writes warnings to stderr; PowerShell 5.1 would treat that as a fatal error under 'Stop'
  $ErrorActionPreference = 'Continue'
  & "$pgBin\pg_restore.exe" -h 127.0.0.1 -U postgres -d $testDb --no-owner --no-privileges $Dump 2>&1 |
    ForEach-Object { if ("$_" -match 'error') { Write-Host "    note: $_" -ForegroundColor DarkYellow } }
  $ErrorActionPreference = 'Stop'

  Write-Host '3/4 Comparing row counts (live database vs restored copy) ...'
  $bad = 0
  foreach ($t in $tables) {
    $live = Count-Rows 'assetx' $t; $copy = Count-Rows $testDb $t
    $state = if ($live -eq $copy) { 'same' } elseif ($copy -ge 0 -and $live -gt $copy) { 'behind (new data after the backup - normal)' } else { 'DIFFERENT'; $bad++ }
    '{0,-20} live={1,-7} restored={2,-7} {3}' -f $t, $live, $copy, $state | Write-Host
  }
  if (@($tables | Where-Object { (Count-Rows $testDb $_) -lt 0 }).Count -gt 0) { throw 'Some tables are missing in the restored copy - this backup is NOT reliable.' }
  if ($bad -gt 0) { throw 'The restored copy has MORE rows than live or an unexpected mismatch - check manually.' }
  Write-Host 'RESULT: the backup restored correctly.' -ForegroundColor Green
}
finally {
  if (-not $Keep) {
    Write-Host "4/4 Removing temporary database $testDb ..."
    & "$pgBin\psql.exe" -h 127.0.0.1 -U postgres -d postgres -c "DROP DATABASE IF EXISTS $testDb" | Out-Null
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
