[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$py = 'C:\venvs\anki-linkmaster-PDFJS\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $py)) {
    Write-Output "[ERR] central interpreter not found: $py"
    exit 1
}

& $py @Args

