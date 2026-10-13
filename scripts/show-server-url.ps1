# AssetX - prints the address to type in the phone app ("Backend URL") for the network this PC is on now.
# Useful when the PC is connected to the phone's hotspot: the address changes whenever the hotspot restarts.
#   powershell -File scripts\show-server-url.ps1
# The URL is also copied to the clipboard. Port 3001 is the backend (see backend\.env, PORT).
$ErrorActionPreference = 'Stop'
$port = 3001
$cfgs = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' })
if ($cfgs.Count -eq 0) { throw 'This PC is not connected to a network.' }
foreach ($c in $cfgs) {
  $ip = $c.IPv4Address.IPAddress
  Write-Host ('{0,-20} http://{1}:{2}' -f $c.InterfaceAlias, $ip, $port) -ForegroundColor Green
}
$first = "http://$($cfgs[0].IPv4Address.IPAddress):$port"
Set-Clipboard -Value $first
Write-Host "Copied to clipboard: $first"
Write-Host 'Type it in the phone app, field "Backend URL" (login screen). The backend must be running.'
