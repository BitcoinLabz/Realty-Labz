$pgHome = "$env:LOCALAPPDATA\RealtyLabzPg\17.5"
$pgData = "$env:LOCALAPPDATA\RealtyLabzPg\data"
$logFile = "$env:LOCALAPPDATA\RealtyLabzPg\pg.log"

if (-not (Test-Path $pgData)) {
    Write-Error "Postgres data directory not found at $pgData. See CLAUDE.md 'Local Development' section for setup."
    exit 1
}

& "$pgHome\bin\pg_ctl.exe" -D $pgData -l $logFile start
