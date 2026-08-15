$src = 'g:\01画布项目\一毛AI画布多端合一版本1.4.2\launch-all.ps1'
$tmp = Join-Path $env:TEMP 'launch-all-check.ps1'
Copy-Item -LiteralPath $src -Destination $tmp -Force
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile($tmp, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host ('ERROR: ' + $_.Message) -ForegroundColor Red }
    exit 1
} else {
    Write-Host 'SYNTAX OK' -ForegroundColor Green
    exit 0
}
