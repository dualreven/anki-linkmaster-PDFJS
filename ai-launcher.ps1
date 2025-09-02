# Anki LinkMaster PDFJS - AI Launcher
param(
    [string]$Action = "start",
    [int]$WaitTime = 10
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

# Function to start npm dev
function Start-NpmDev {
    Write-Host "[1/3] Starting npm run dev..." -ForegroundColor Cyan
    
    $logFile = "$ScriptPath\logs\npm-dev.log"
    $process = Start-Process "cmd.exe" -ArgumentList "/c npm run dev > `"$logFile`" 2>&1" -PassThru
    
    $processInfo = @{
        Type = "npm-dev"
        PID = $process.Id
        LogFile = $logFile
    }
    
    return $processInfo
}

# Function to start debug.py
function Start-DebugPy {
    Write-Host "[2/3] Starting debug.py..." -ForegroundColor Cyan
    
    $logFile = "$ScriptPath\logs\debug.log"
    $process = Start-Process "python.exe" -ArgumentList "debug.py --port 9222" -RedirectStandardOutput $logFile -PassThru
    
    $processInfo = @{
        Type = "debug-py"
        PID = $process.Id
        LogFile = $logFile
    }
    
    return $processInfo
}

# Function to start app.py
function Start-AppPy {
    Write-Host "[3/3] Starting app.py..." -ForegroundColor Cyan
    
    $logFile = "$ScriptPath\logs\app.log"
    $process = Start-Process "python.exe" -ArgumentList "app.py" -RedirectStandardOutput $logFile -PassThru
    
    $processInfo = @{
        Type = "main-app"
        PID = $process.Id
        LogFile = $logFile
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
                    Stop-Process -Id $info.PID -Force -ErrorAction SilentlyContinue
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
    
    # Clean up any remaining processes
    Get-Process | Where-Object { $_.ProcessName -eq "node" -or $_.ProcessName -eq "python" } | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
        catch {}
    }
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
        Write-Host "- npm dev server: http://localhost:3000" -ForegroundColor White
        Write-Host "- Debug console: Port 9222" -ForegroundColor White
        Write-Host "- Main app: Started" -ForegroundColor White
        Write-Host ""
        Write-Host "Log files:" -ForegroundColor White
        Write-Host "- npm log: logs\npm-dev.log" -ForegroundColor White
        Write-Host "- debug log: logs\debug.log" -ForegroundColor White
        Write-Host "- app log: logs\app.log" -ForegroundColor White
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
        Write-Host "- Log files are available for debugging" -ForegroundColor Magenta
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
            "logs\debug.log", 
            "logs\app.log"
        )
        
        foreach ($logFile in $logFiles) {
            if (Test-Path $logFile) {
                Write-Host "--- $logFile (last 10 lines) ---" -ForegroundColor Yellow
                Get-Content $logFile -Tail 10 | ForEach-Object { Write-Host $_ }
                Write-Host ""
            }
        }
    }
    
    default {
        Write-Host "Usage: .\ai-launcher.ps1 [start|stop|status|logs]" -ForegroundColor Red
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor White
        Write-Host "  start  - Start all services (default)" -ForegroundColor White
        Write-Host "  stop   - Stop all services" -ForegroundColor White
        Write-Host "  status - Check service status" -ForegroundColor White
        Write-Host "  logs   - View recent logs" -ForegroundColor White
    }
}