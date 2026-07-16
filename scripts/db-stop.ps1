$pgHome = "$env:LOCALAPPDATA\RealtyLabzPg\17.5"
$pgData = "$env:LOCALAPPDATA\RealtyLabzPg\data"

& "$pgHome\bin\pg_ctl.exe" -D $pgData stop
