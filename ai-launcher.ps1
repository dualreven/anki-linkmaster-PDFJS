# Anki LinkMaster PDFJS - AI Launcher
param(
    [string]$Action = "start",
    [int]$WaitTime = 10,
    [Alias("Modules")][string]$Module = "pdf-viewer",
    [int]$Port = 3000,
    [string]$PdfPath = ""
)

# Set working directory
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptPath

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Process info file
$ProcessInfoFile = "logs\process-info.json"

# Function to start npm dev with custom port
function Start-NpmDev {
    Write-Host "[1/3] Starting npm run dev on port $Port for module $Module..." -ForegroundColor Cyan
    
    $logFile = "$ScriptPath\logs\npm-dev.log"
    
    # Prepare index.html for Vite
    $viteEntryFile = "src/frontend/$Module/index.html"
    if ($PdfPath -and $Module -eq "pdf-viewer") {
        $originalHtmlPath = "src/frontend/pdf-viewer/index.html"
        $tempHtmlPath = "src/frontend/pdf-viewer/index.temp.html"
        
        $htmlContent = Get-Content $originalHtmlPath -Raw
        $injectionScript = "<script>window.PDF_PATH = `"$PdfPath`";</script>"
        $htmlContent = $htmlContent -replace "</body>", "$injectionScript`n</body>"
        
        Set-Content -Path $tempHtmlPath -Value $htmlContent -Encoding UTF8
        $viteEntryFile = $tempHtmlPath
    }
    
    # Create a PowerShell script to remove ANSI codes and use custom port
    $psScript = @"
vite --port $Port 2>&1 | ForEach-Object {
    `$line = `$_ -replace '\x1b\[\d+(;\d+)*m', ''
    `$line
} | Out-File -FilePath '$logFile' -Encoding UTF8
"@
    $process = Start-Process "powershell.exe" -ArgumentList "-Command", $psScript -PassThru
    
    $processInfo = @{
        Type = "npm-dev"
        PID = $process.Id
        LogFile = $logFile
        Port = $Port
    }
    
    return $processInfo
}

# Function to start debug.py
function Start-DebugPy {
    Write-Host "[2/3] Starting debug.py..." -ForegroundColor Cyan
    
    $logFile = "$ScriptPath\logs\debug.log"
    $process = Start-Process "cmd.exe" -ArgumentList "/c chcp 65001 > nul && python.exe debug.py --port 9222 > `"$logFile`" 2>&1" -PassThru
    
    $processInfo = @{
        Type = "debug-py"
        PID = $process.Id
        LogFile = $logFile
    }
    
    return $processInfo
}

# Function to start app.py with module selection
function Start-AppPy {
    Write-Host "[3/3] Starting app.py with module: $Module..." -ForegroundColor Cyan
    
    $logFile = "$ScriptPath\logs\app.log"
    $moduleLogFile = "$ScriptPath\logs\$Module.log"
    
    # Ensure logs directory exists
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" | Out-Null
    }
    
    # Create module log header
    $logHeader = @"
=====================================
$Module Module Log
Started: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Vite Port: $Port
=====================================

"@
    $logHeader | Out-File -FilePath $moduleLogFile -Encoding UTF8
    
    # Build command arguments
    $cmdArgs = "/c chcp 65001 > nul && python.exe app.py --module $Module --port $Port"
    if ($PdfPath -and $Module -eq "pdf-viewer") {
        $cmdArgs += " --file-path `"$PdfPath`""
    }
    $cmdArgs += " > `"$logFile`" 2>&1"
    $process = Start-Process "cmd.exe" -ArgumentList $cmdArgs -PassThru
    
    $processInfo = @{
        Type = "main-app"
        PID = $process.Id
        LogFile = $logFile
        ModuleLog = $moduleLogFile
        Module = $Module
        Port = $Port
    }
    
    return $processInfo
}

# Function to stop all processes
function Stop-AllProcesses {
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    
    if (Test-Path $ProcessInfoFile) {
        try {
            $processInfos = Get-Content $ProcessInfoFile | ConvertFrom-Json
            
            foreach ($info in $processInfos) {
                try {
                    # Use taskkill to terminate the process tree
                    taskkill /F /T /PID $info.PID | Out-Null
                    Write-Host "Stopped $($info.Type) (PID: $($info.PID))" -ForegroundColor Green
                }
                catch {
                    Write-Warning "Failed to stop $($info.Type): $_"
                }
            }
            
            Remove-Item $ProcessInfoFile -Force -ErrorAction SilentlyContinue
        }
        catch {
            Write-Warning "Error reading process info: $_"
        }
    }
    
    # Note: Only stop processes that were started by this launcher
    # Do not kill all node/python processes to avoid affecting other applications
}

# Function to check process status
function Check-ProcessStatus {
    if (Test-Path $ProcessInfoFile) {
        try {
            $processInfos = Get-Content $ProcessInfoFile | ConvertFrom-Json
            
            foreach ($info in $processInfos) {
                $process = Get-Process -Id $info.PID -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "Process $($info.Type) (PID: $($info.PID)) is running" -ForegroundColor Green
                }
                else {
                    Write-Host "Process $($info.Type) (PID: $($info.PID)) has stopped" -ForegroundColor Red
                }
            }
        }
        catch {
            Write-Warning "Error checking status: $_"
        }
    }
    else {
        Write-Host "No process info found" -ForegroundColor Yellow
    }
}

# Main switch
switch ($Action.ToLower()) {
    "start" {
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host "Anki LinkMaster PDFJS - AI Launcher" -ForegroundColor Cyan
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Stop existing processes first
        Stop-AllProcesses
        
        # Start all services
        $processInfos = @()
        
        $processInfos += Start-NpmDev
        Start-Sleep -Seconds 5
        
        $processInfos += Start-DebugPy
        Start-Sleep -Seconds 2
        
        $processInfos += Start-AppPy
        
        # Save process info
        $processInfos | ConvertTo-Json | Set-Content $ProcessInfoFile
        
        Write-Host ""
        Write-Host "===================================" -ForegroundColor Green
        Write-Host "All services started!" -ForegroundColor Green
        Write-Host "===================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Services:" -ForegroundColor White
        Write-Host "- npm dev server: http://localhost:$Port" -ForegroundColor White
        Write-Host "- Debug console: Port 9222" -ForegroundColor White
        Write-Host "- Main app: Module $Module" -ForegroundColor White
        Write-Host ""
        Write-Host "Log files:" -ForegroundColor White
        Write-Host "- npm log: logs\npm-dev.log" -ForegroundColor White
        Write-Host "- debug log: logs\debug-console-at-9222.log" -ForegroundColor White
        Write-Host "- app log: logs\app.log" -ForegroundColor White
        Write-Host "- module log: logs\$Module.log" -ForegroundColor White
        Write-Host ""
        Write-Host "Waiting $WaitTime seconds for services to start..." -ForegroundColor Yellow
        
        # Wait for services
        for ($i = 1; $i -le $WaitTime; $i++) {
            Write-Progress -Activity "Starting services" -Status "Waited $i/$WaitTime seconds" -PercentComplete (($i / $WaitTime) * 100)
            Start-Sleep -Seconds 1
        }
        
        Write-Host ""
        Write-Host "Checking service status..." -ForegroundColor Yellow
        Check-ProcessStatus
        
        Write-Host ""
        Write-Host "AI Integration Tips:" -ForegroundColor Magenta
        Write-Host "- Services are running in background" -ForegroundColor Magenta
        Write-Host "- Use '$PSCommandPath stop' to stop all services" -ForegroundColor Magenta
        Write-Host "- Log files are available in logs/* for debugging" -ForegroundColor Magenta
    }
    
    "stop" {
        Write-Host "Stopping all services..." -ForegroundColor Yellow
        Stop-AllProcesses
        Write-Host "All services stopped" -ForegroundColor Green
    }
    
    "status" {
        Write-Host "Checking service status..." -ForegroundColor Yellow
        Check-ProcessStatus
    }
    
    "logs" {
        Write-Host "Showing recent logs:" -ForegroundColor Cyan
        Write-Host ""
        
        $logFiles = @(
            "logs\npm-dev.log",
            "logs\debug-console-at-9222.log",
            "logs\app.log",
            "logs\$Module.log"
        )
        
        foreach ($logFile in $logFiles) {
            if (Test-Path $logFile) {
                Write-Host "--- $logFile (last 10 lines) ---" -ForegroundColor Yellow
                
                # Use different encoding based on log file type
                if ($logFile -like "*npm-dev*") {
                    # npm-dev.log is now UTF-8 encoded with ANSI codes stripped
                    Get-Content $logFile -Tail 10 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
                } else {
                    # Python logs use UTF-8
                    Get-Content $logFile -Tail 10 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
                }
                Write-Host ""
            }
        }
    }
    
    default {
        Write-Host "Usage: .\ai-launcher.ps1 [start|stop|status|logs] [-Module|-Modules {pdf-home|pdf-viewer}] [-Port PORT] [-PdfPath PATH]" -ForegroundColor Red
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor White
        Write-Host "  start  - Start all services (default)" -ForegroundColor White
        Write-Host "  stop   - Stop all services" -ForegroundColor White
        Write-Host "  status - Check service status" -ForegroundColor White
        Write-Host "  logs   - View recent logs" -ForegroundColor White
        Write-Host ""
        Write-Host "Options:" -ForegroundColor White
        Write-Host "  -Module|-Modules {pdf-home|pdf-viewer} - Select frontend module (default: pdf-viewer)" -ForegroundColor White
        Write-Host "  -Port PORT - Vite dev server port (default: 3000)" -ForegroundColor White
        Write-Host "  -PdfPath PATH - PDF file path to load (pdf-viewer module only)" -ForegroundColor White
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor White
        Write-Host "  .\ai-launcher.ps1 start -Module pdf-home -Port 3001" -ForegroundColor White
        Write-Host "  .\ai-launcher.ps1 start -Module pdf-viewer -PdfPath `"C:\path\to\file.pdf`"" -ForegroundColor White
        Write-Host "  .\ai-launcher.ps1 start -Module pdf-viewer" -ForegroundColor White
        Write-Host "  .\ai-launcher.ps1 start" -ForegroundColor White
    }
}