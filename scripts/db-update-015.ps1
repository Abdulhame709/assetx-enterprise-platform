# AssetX - local database update (backup first, then apply migration 015: allow deleting inventory cycles).
# Asks once for the password of the PostgreSQL role "assetx_migrator" (not stored anywhere).
$ErrorActionPreference = 'Stop'
$pgBin   = 'C:\Program Files\PostgreSQL\18\bin'
$root    = Split-Path -Parent $PSScriptRoot
$backup  = Join-Path $env:USERPROFILE 'Documents\assetx-backups'
$stamp   = Get-Date -Format 'yyyyMMdd-HHmm'
$dump    = Join-Path $backup "assetx-before-015-$stamp.sql"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$secure = Read-Host 'Password of assetx_migrator' -AsSecureString
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
try {
  Write-Host '1/3 Backing up database assetx ...'
  & "$pgBin\pg_dump.exe" -h 127.0.0.1 -U assetx_migrator -d assetx --no-owner -f $dump
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dump) -or (Get-Item $dump).Length -lt 10000) { throw 'Backup failed - nothing was changed.' }
  Write-Host "    Backup saved: $dump ($([math]::Round((Get-Item $dump).Length/1KB)) KB)"

  Write-Host '2/3 Applying migration 015 (all or nothing) ...'
  & "$pgBin\psql.exe" -h 127.0.0.1 -U assetx_migrator -d assetx -v ON_ERROR_STOP=1 --single-transaction `
    -f "$root\db\migrations\015_sync_mutations_cascade.sql" `
    -c "INSERT INTO schema_migrations (version) VALUES ('015_sync_mutations_cascade.sql') ON CONFLICT DO NOTHING;"
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed and was rolled back - the database is unchanged.' }

  Write-Host '3/3 Verifying ...'
  & "$pgBin\psql.exe" -h 127.0.0.1 -U assetx_migrator -d assetx -At `
    -c "select 'cascade on cycle FK: ' || (select confdeltype = 'c' from pg_constraint where conname = 'sync_mutations_cycle_id_fkey')" `
    -c "select 'cascade on record FK: ' || (select confdeltype = 'c' from pg_constraint where conname = 'sync_mutations_record_id_fkey')" `
    -c "select 'applied migrations: ' || count(*) from schema_migrations"
  Write-Host 'DONE - you can now delete inventory cycles. Restart the backend.' -ForegroundColor Green
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
