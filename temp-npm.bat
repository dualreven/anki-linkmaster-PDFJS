@echo off
npm.cmd run dev > logs/npm-temp-output.log 2>&1
powershell -Command "Get-Content 'logs/npm-temp-output.log' | ForEach-Object { $_ -replace '\x1b\[[0-9;]*m', '' } | Set-Content 'logs/npm-output.log'"
if exist logs/npm-temp-output.log del logs/npm-temp-output.log
