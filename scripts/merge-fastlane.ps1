[CmdletBinding(DefaultParameterSetName = 'Commits')]
param(
  [Parameter(ParameterSetName = 'Commits', Mandatory = $true)]
  [string[]]$Commits,

  [Parameter(ParameterSetName = 'QueueFile', Mandatory = $true)]
  [string]$QueueFile,

  [string]$BaseBranch = 'main',
  [string]$IntegrationBranch,
  [string[]]$TestPaths,
  [string]$ReportPath,

  [switch]$DryRun,
  [switch]$ForceIntegrationBranch,
  [switch]$AllowDirty
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

function Write-LineN {
  param([Parameter(Mandatory = $true)][string]$Text)
  $t = $Text -replace "`r`n", "`n"
  [Console]::Write($t + "`n")
}

function Fail {
  param([Parameter(Mandatory = $true)][string]$Message)
  throw $Message
}

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "缺少命令：$Name（请先安装/加入 PATH）"
  }
}

function Run-ReadCmd {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter()][string[]]$Args = @()
  )
  $cmdLine = $File + ' ' + (($Args | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' ')
  Write-LineN "[cmd] $cmdLine"
  $out = & $File @Args 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Fail "命令失败（exit=$code）：$cmdLine`n$out"
  }
  return ,$out
}

function Run-WriteCmd {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter()][string[]]$Args = @()
  )
  $cmdLine = $File + ' ' + (($Args | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' ')
  if ($DryRun) {
    Write-LineN "[dry-run] $cmdLine"
    return @()
  }
  Write-LineN "[cmd] $cmdLine"
  $out = & $File @Args 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Fail "命令失败（exit=$code）：$cmdLine`n$out"
  }
  return ,$out
}

function Ensure-Directory {
  param([Parameter(Mandatory = $true)][string]$Dir)
  if (Test-Path -LiteralPath $Dir) { return }
  if ($DryRun) {
    Write-LineN "[dry-run] mkdir $Dir"
    return
  }
  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
}

function Write-ReportUtf8Lf {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $normalized = $Content -replace "`r`n", "`n"
  $dir = Split-Path -Parent $Path
  if ($dir) { Ensure-Directory $dir }

  if ($DryRun) {
    Write-LineN "[dry-run] write report -> $Path"
    return
  }
  [System.IO.File]::WriteAllText($Path, $normalized, [System.Text.Encoding]::UTF8)
}

function Get-Timestamp {
  return (Get-Date -Format 'yyyyMMddHHmmss')
}

function Load-Queue {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    Fail "QueueFile 不存在：$Path"
  }
  $raw = Get-Content -Raw -Encoding utf8 -LiteralPath $Path
  try {
    return ($raw | ConvertFrom-Json)
  } catch {
    Fail "QueueFile JSON 解析失败：$Path`n$($_.Exception.Message)"
  }
}

function Normalize-Config {
  param(
    [Parameter()]$Queue
  )

  $cfg = [ordered]@{
    baseBranch = $BaseBranch
    integrationBranch = $IntegrationBranch
    commits = $Commits
    testPaths = $TestPaths
    reportPath = $ReportPath
  }

  if ($Queue) {
    $names = @($Queue.PSObject.Properties.Name)
    if (($names -contains 'baseBranch') -and $Queue.baseBranch) { $cfg.baseBranch = [string]$Queue.baseBranch }
    if (($names -contains 'integrationBranch') -and $Queue.integrationBranch) { $cfg.integrationBranch = [string]$Queue.integrationBranch }
    if (($names -contains 'reportPath') -and $Queue.reportPath) { $cfg.reportPath = [string]$Queue.reportPath }

    if (($names -contains 'commits') -and $Queue.commits) { $cfg.commits = @($Queue.commits | ForEach-Object { [string]$_ }) }
    if (($names -contains 'testPaths') -and $Queue.testPaths) { $cfg.testPaths = @($Queue.testPaths | ForEach-Object { [string]$_ }) }
  }

  if (-not $cfg.integrationBranch) {
    $cfg.integrationBranch = "integration/fastlane-$(Get-Timestamp)"
  }
  if (-not $cfg.reportPath) {
    $cfg.reportPath = "AItemp/reports/$(Get-Timestamp)-merge-fastlane-report.md"
  }

  if (-not $cfg.commits -or $cfg.commits.Count -eq 0) {
    Fail "必须提供 commits（参数 -Commits 或 QueueFile.commits）"
  }
  if (-not $cfg.testPaths -or $cfg.testPaths.Count -eq 0) {
    Fail "必须提供 testPaths（参数 -TestPaths 或 QueueFile.testPaths）"
  }

  return $cfg
}

function Assert-TestPathsExist {
  param([Parameter(Mandatory = $true)][string[]]$Paths)
  foreach ($p in $Paths) {
    if (-not (Test-Path -LiteralPath $p)) {
      Fail "测试文件不存在：$p"
    }
  }
}

function Assert-CommitsExist {
  param([Parameter(Mandatory = $true)][string[]]$CommitsToCheck)
  foreach ($c in $CommitsToCheck) {
    Run-ReadCmd git @('rev-parse', '--verify', "$c^{commit}") | Out-Null
  }
}

function Ensure-CleanWorkingTree {
  $status = (Run-ReadCmd git @('status', '--porcelain'))
  if ($status -and $status.Count -gt 0) {
    Fail "工作区不干净（请先提交/还原改动后再跑 fastlane）"
  }
}

function Ensure-BranchExists {
  param([Parameter(Mandatory = $true)][string]$Branch)
  Run-ReadCmd git @('rev-parse', '--verify', $Branch) | Out-Null
}

function Ensure-BranchNotExistsOrForce {
  param([Parameter(Mandatory = $true)][string]$Branch)
  $exists = $true
  try {
    Run-ReadCmd git @('rev-parse', '--verify', $Branch) | Out-Null
  } catch {
    $exists = $false
  }
  if (-not $exists) { return }

  if (-not $ForceIntegrationBranch) {
    Fail "integration 分支已存在：$Branch（如需覆盖请加 -ForceIntegrationBranch）"
  }

  if ($DryRun) {
    Write-LineN "[dry-run] git branch -D $Branch"
    return
  }
  Run-WriteCmd git @('branch', '-D', $Branch) | Out-Null
}

function Get-RepoRoot {
  $root = (Run-ReadCmd git @('rev-parse', '--show-toplevel')) | Select-Object -First 1
  if (-not $root) { Fail "无法定位 git 仓库根目录" }
  return [string]$root
}

function Start-Step {
  param([Parameter(Mandatory = $true)][string]$Name)
  return [ordered]@{ name = $Name; startedAt = (Get-Date) }
}

function End-Step {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Step,
    [Parameter()][string]$Result = 'OK'
  )
  $endedAt = Get-Date
  $durationMs = [int]([TimeSpan]($endedAt - $Step.startedAt)).TotalMilliseconds
  return [ordered]@{
    name = $Step.name
    startedAt = $Step.startedAt.ToString('s')
    endedAt = $endedAt.ToString('s')
    durationMs = $durationMs
    result = $Result
  }
}

try {
  Require-Command git
  Require-Command pnpm

  $repoRoot = Get-RepoRoot
  Set-Location -LiteralPath $repoRoot

  $queue = $null
  if ($PSCmdlet.ParameterSetName -eq 'QueueFile') {
    $queue = Load-Queue -Path $QueueFile
  }
  $cfg = Normalize-Config -Queue $queue

  Write-LineN "[info] repoRoot=$repoRoot"
  Write-LineN "[info] baseBranch=$($cfg.baseBranch)"
  Write-LineN "[info] integrationBranch=$($cfg.integrationBranch)"
  Write-LineN "[info] dryRun=$DryRun"

  Assert-CommitsExist -CommitsToCheck $cfg.commits

  if (-not $AllowDirty) {
    Ensure-CleanWorkingTree
  } else {
    Write-LineN "[warn] AllowDirty=true：已跳过工作区干净检查（仅建议用于自检/调试）"
  }
  Ensure-BranchExists -Branch $cfg.baseBranch

  Ensure-BranchNotExistsOrForce -Branch $cfg.integrationBranch

  $steps = New-Object System.Collections.Generic.List[object]
  $startedAt = Get-Date

  $s = Start-Step "checkout baseBranch"
  Run-WriteCmd git @('checkout', $cfg.baseBranch) | Out-Null
  $steps.Add((End-Step $s)) | Out-Null

  $s = Start-Step "create integration branch"
  Run-WriteCmd git @('checkout', '-b', $cfg.integrationBranch) | Out-Null
  $steps.Add((End-Step $s)) | Out-Null

  $picked = @()
  foreach ($c in $cfg.commits) {
    $s = Start-Step "cherry-pick $c"
    try {
      Run-WriteCmd git @('cherry-pick', $c) | Out-Null
      $picked += $c
      $steps.Add((End-Step $s)) | Out-Null
    } catch {
      $steps.Add((End-Step $s -Result 'FAILED')) | Out-Null
      if (-not $DryRun) {
        try {
          Run-WriteCmd git @('cherry-pick', '--abort') | Out-Null
        } catch {
          # 保持 fail-fast：不吞错，但也不覆盖原始错误
        }
      }
      throw
    }
  }

  # 测试文件可能由本次 cherry-pick 引入：必须在合入后再校验存在性
  Assert-TestPathsExist -Paths $cfg.testPaths

  $s = Start-Step "pnpm -s run lint"
  Run-WriteCmd pnpm @('-s', 'run', 'lint') | Out-Null
  $steps.Add((End-Step $s)) | Out-Null

  $s = Start-Step "pnpm exec jest --runTestsByPath"
  $jestArgs = @('exec', 'jest', '--runTestsByPath') + @($cfg.testPaths) + @('-i')
  Run-WriteCmd pnpm $jestArgs | Out-Null
  $steps.Add((End-Step $s)) | Out-Null

  $endedAt = Get-Date
  $totalMs = [int]([TimeSpan]($endedAt - $startedAt)).TotalMilliseconds

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# merge-fastlane report") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
  $lines.Add("repoRoot: $repoRoot") | Out-Null
  $lines.Add("baseBranch: $($cfg.baseBranch)") | Out-Null
  $lines.Add("integrationBranch: $($cfg.integrationBranch)") | Out-Null
  $lines.Add("dryRun: $DryRun") | Out-Null
  $lines.Add("totalMs: $totalMs") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("## commits") | Out-Null
  foreach ($c in $cfg.commits) { $lines.Add("- $c") | Out-Null }
  $lines.Add("") | Out-Null
  $lines.Add("## tests") | Out-Null
  foreach ($p in $cfg.testPaths) { $lines.Add("- $p") | Out-Null }
  $lines.Add("") | Out-Null
  $lines.Add("## steps") | Out-Null
  foreach ($st in $steps) {
    $lines.Add("- $($st.name): $($st.result) ($($st.durationMs)ms)") | Out-Null
  }
  $lines.Add("") | Out-Null
  $lines.Add("result: OK") | Out-Null

  $report = ($lines -join "`n") + "`n"
  Write-ReportUtf8Lf -Path $cfg.reportPath -Content $report
  Write-LineN "[ok] report=$($cfg.reportPath)"

  exit 0
} catch {
  $msg = $_.Exception.Message
  Write-LineN "[err] $msg"
  exit 1
}
