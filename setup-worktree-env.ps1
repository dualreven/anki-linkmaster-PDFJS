# Worktree 环境自动配置脚本
# PowerShell script for setting up shared development environment across worktrees

param(
    [string]$WorktreePath = "",
    [switch]$Setup = $false,
    [switch]$Help = $false
)

if ($Help) {
    Write-Host "Git Worktree 环境配置脚本"
    Write-Host ""
    Write-Host "用法："
    Write-Host "  .\setup-worktree-env.ps1 -Setup          # 初始化共享环境"
    Write-Host "  .\setup-worktree-env.ps1 path/to/worktree # 为指定worktree配置环境"
    Write-Host ""
    exit 0
}

$ProjectName = "anki-linkmaster-PDFJS"
$SharedVenvPath = "C:\venvs\$ProjectName"
$PnpmStorePath = "C:\pnpm-store"

# 颜色输出函数
function Write-ColoredOutput {
    param([string]$Text, [string]$Color = "Green")
    Write-Host $Text -ForegroundColor $Color
}

function Write-Error {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Red
}

# 初始化共享环境
if ($Setup) {
    Write-ColoredOutput "🚀 正在初始化共享开发环境..."

    # 1. 配置pnpm共享存储
    Write-ColoredOutput "📦 配置pnpm共享存储..."
    if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-ColoredOutput "安装pnpm..."
        npm install -g pnpm
    }

    pnpm config set store-dir $PnpmStorePath
    Write-ColoredOutput "pnpm存储目录设置为: $PnpmStorePath"

    # 2. 创建共享Python虚拟环境
    Write-ColoredOutput "🐍 创建共享Python虚拟环境..."
    if (!(Test-Path $SharedVenvPath)) {
        python -m venv $SharedVenvPath
        Write-ColoredOutput "虚拟环境创建于: $SharedVenvPath"
    } else {
        Write-ColoredOutput "虚拟环境已存在: $SharedVenvPath"
    }

    # 3. 激活虚拟环境并安装依赖
    Write-ColoredOutput "📋 安装Python依赖..."
    & "$SharedVenvPath\Scripts\activate.ps1"

    if (Test-Path "requirements.txt") {
        pip install -r requirements.txt
        Write-ColoredOutput "Python依赖安装完成"
    } else {
        Write-ColoredOutput "创建requirements.txt..."
        pip freeze > requirements.txt
    }

    # 4. 创建版本配置文件
    Write-ColoredOutput "📝 创建版本配置文件..."

    if (!(Test-Path ".nvmrc")) {
        node --version | ForEach-Object { $_.Substring(1) } | Out-File -Encoding UTF8 ".nvmrc"
        Write-ColoredOutput "创建.nvmrc文件"
    }

    if (!(Test-Path ".python-version")) {
        python --version | ForEach-Object { $_.Split(' ')[1] } | Out-File -Encoding UTF8 ".python-version"
        Write-ColoredOutput "创建.python-version文件"
    }

    Write-ColoredOutput "✅ 共享环境初始化完成！"
    exit 0
}

# 为指定worktree配置环境
if ($WorktreePath -eq "") {
    Write-Error "请指定worktree路径，或使用 -Setup 初始化共享环境"
    Write-Host "使用 -Help 查看帮助"
    exit 1
}

if (!(Test-Path $WorktreePath)) {
    Write-Error "Worktree路径不存在: $WorktreePath"
    exit 1
}

Write-ColoredOutput "🔧 正在为worktree配置环境: $WorktreePath"

# 进入worktree目录
Push-Location $WorktreePath

try {
    # 1. 安装Node依赖 (使用共享存储)
    Write-ColoredOutput "📦 安装Node依赖 (使用共享存储)..."
    pnpm install --frozen-lockfile

    # 2. 创建启动脚本
    Write-ColoredOutput "📜 创建启动脚本..."

    $StartScript = @"
# Worktree 启动脚本 - 自动激活环境
`$VenvPath = "$SharedVenvPath"
`$ProjectPath = Get-Location

Write-Host "🚀 激活开发环境..."
Write-Host "📁 项目路径: `$ProjectPath"
Write-Host "🐍 Python虚拟环境: `$VenvPath"

# 激活Python虚拟环境
& "`$VenvPath\Scripts\activate.ps1"

# 显示环境信息
Write-Host ""
Write-Host "环境信息:"
Write-Host "  Node版本: `$(node --version)"
Write-Host "  Python版本: `$(python --version)"
Write-Host "  虚拟环境: `$env:VIRTUAL_ENV"
Write-Host ""
Write-Host "可用命令:"
Write-Host "  python ai-launcher.py start    # 启动所有服务"
Write-Host "  python ai-launcher.py status   # 查看服务状态"
Write-Host "  pnpm run dev                   # 启动前端开发服务器"
Write-Host "  pnpm run test                  # 运行测试"
Write-Host ""
"@

    $StartScript | Out-File -Encoding UTF8 "start-dev.ps1"

    # 3. 创建环境检查脚本
    $CheckScript = @"
# 环境检查脚本
Write-Host "🔍 检查开发环境状态..."

# 检查Node环境
`$NodeVersion = node --version
`$ExpectedNodeVersion = Get-Content .nvmrc -ErrorAction SilentlyContinue
if (`$ExpectedNodeVersion) {
    if (`$NodeVersion -eq "v`$ExpectedNodeVersion") {
        Write-Host "✅ Node版本正确: `$NodeVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Node版本不匹配: 当前`$NodeVersion, 期望v`$ExpectedNodeVersion" -ForegroundColor Yellow
    }
}

# 检查Python环境
if (`$env:VIRTUAL_ENV) {
    Write-Host "✅ Python虚拟环境已激活: `$env:VIRTUAL_ENV" -ForegroundColor Green
} else {
    Write-Host "❌ Python虚拟环境未激活" -ForegroundColor Red
}

# 检查依赖
if (Test-Path "node_modules") {
    Write-Host "✅ Node依赖已安装" -ForegroundColor Green
} else {
    Write-Host "❌ Node依赖未安装，请运行: pnpm install" -ForegroundColor Red
}

# 检查端口占用
`$Ports = @(3000, 8765, 8080, 9222)
foreach (`$Port in `$Ports) {
    `$Connection = Get-NetTCPConnection -LocalPort `$Port -ErrorAction SilentlyContinue
    if (`$Connection) {
        Write-Host "⚠️  端口 `$Port 已被占用" -ForegroundColor Yellow
    } else {
        Write-Host "✅ 端口 `$Port 可用" -ForegroundColor Green
    }
}
"@

    $CheckScript | Out-File -Encoding UTF8 "check-env.ps1"

    Write-ColoredOutput "✅ Worktree环境配置完成！"
    Write-ColoredOutput ""
    Write-ColoredOutput "使用方法："
    Write-ColoredOutput "  .\start-dev.ps1     # 激活环境并显示信息"
    Write-ColoredOutput "  .\check-env.ps1     # 检查环境状态"
    Write-ColoredOutput ""

} finally {
    Pop-Location
}