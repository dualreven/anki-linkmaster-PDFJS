# WSL 中安装 Claude Code 完整指南

## 前置条件

- ✅ Windows 10/11 已启用 WSL2
- ✅ 已安装 Ubuntu 或其他 Linux 发行版
- ✅ VSCode 已安装 Remote-WSL 扩展

## 安装步骤

### 1. 在 WSL 中安装 Node.js 和 Claude Code

```bash
# 1.1 更新包管理器
sudo apt update && sudo apt upgrade -y

# 1.2 安装 Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 1.3 验证 Node.js 安装
node --version  # 应该显示 v20.x.x
npm --version   # 应该显示 10.x.x

# 1.4 全局安装 Claude Code
npm install -g @anthropic-ai/claude-code

# 1.5 验证安装
codex --version
which codex  # 查看安装路径
```

### 2. 配置 VSCode

#### 方法 A：通过 Remote-WSL 使用（推荐）

1. **安装 VSCode 扩展**：
   - `Remote - WSL` (ms-vscode-remote.remote-wsl)
   - `Remote Development` (ms-vscode-remote.vscode-remote-extensionpack)

2. **从 WSL 启动 VSCode**：
   ```bash
   # 在 WSL 终端中，进入项目目录
   cd ~/your-project

   # 启动 VSCode (会自动连接到 WSL)
   code .
   ```

3. **验证环境**：
   - VSCode 左下角应显示 "WSL: Ubuntu" (绿色图标)
   - 打开终端，应该是 WSL bash 终端
   - 运行 `which codex` 应该显示 `/usr/local/bin/codex`

#### 方法 B：Windows VSCode 直接调用 WSL codex

在 Windows 的 VSCode `settings.json` 中添加：

```json
{
  "claudeCode.executablePath": "wsl -e codex",
  "terminal.integrated.defaultProfile.windows": "WSL"
}
```

### 3. 配置环境变量（可选）

如果需要在 WSL 中设置 API Key 等环境变量：

```bash
# 编辑 .bashrc 或 .zshrc
nano ~/.bashrc

# 添加以下内容
export ANTHROPIC_API_KEY="your-api-key-here"
export CODEX_CONFIG_PATH="$HOME/.config/claude-code"

# 重新加载配置
source ~/.bashrc
```

### 4. 项目配置

在 WSL 中的项目根目录创建 `.claude/` 配置：

```bash
# 在项目根目录
mkdir -p .claude

# 创建配置文件
cat > .claude/config.json << 'EOF'
{
  "workingDirectory": ".",
  "pythonPath": "/usr/bin/python3",
  "excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**"
  ]
}
EOF
```

## 常见问题排查

### 问题 1: `codex: command not found`

**解决方法**：
```bash
# 检查全局 npm 包安装路径
npm config get prefix
# 应该显示 /usr/local 或 ~/.npm-global

# 如果路径不在 PATH 中，添加到 .bashrc
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 问题 2: VSCode 无法找到 codex

**解决方法**：
```bash
# 在 VSCode 的 Remote-WSL 终端中运行
which codex
# 复制输出的路径

# 在 VSCode settings.json 中设置
{
  "claudeCode.executablePath": "/usr/local/bin/codex"
}
```

### 问题 3: 权限问题

**解决方法**：
```bash
# 修复 npm 全局包权限
sudo chown -R $(whoami) /usr/local/lib/node_modules
sudo chown -R $(whoami) /usr/local/bin
```

### 问题 4: WSL 与 Windows 文件系统性能问题

**建议**：
- ✅ 将项目放在 WSL 文件系统中 (`~/projects/`)
- ❌ 避免放在 Windows 挂载点 (`/mnt/c/`)
- 性能差异：WSL 文件系统比 /mnt/c/ 快 5-10 倍

```bash
# 推荐项目路径
~/projects/anki-linkmaster-PDFJS/

# 不推荐
/mnt/c/Users/napretep/PycharmProjects/anki-linkmaster-PDFJS/
```

## 最佳实践

### 1. 使用 WSL 作为主要开发环境

```bash
# 在 WSL 中克隆项目
cd ~
mkdir -p projects
cd projects
git clone https://github.com/your-repo/anki-linkmaster-PDFJS.git
cd anki-linkmaster-PDFJS

# 从 WSL 启动 VSCode
code .
```

### 2. 配置 Git 凭据共享

```bash
# Windows 和 WSL 共享 Git 凭据
git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"
```

### 3. 设置代理（如果需要）

```bash
# 在 .bashrc 中添加
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="http://proxy.example.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

## 验证安装完整性

运行以下检查脚本：

```bash
#!/bin/bash
echo "=== Claude Code WSL 安装检查 ==="
echo ""

echo "✓ Node.js 版本:"
node --version

echo "✓ npm 版本:"
npm --version

echo "✓ codex 路径:"
which codex

echo "✓ codex 版本:"
codex --version

echo "✓ VSCode Remote-WSL 状态:"
if [ -n "$VSCODE_IPC_HOOK_CLI" ]; then
  echo "  已连接到 VSCode Remote-WSL"
else
  echo "  未连接（在 WSL 终端中运行 'code .' 启动）"
fi

echo ""
echo "=== 检查完成 ==="
```

## 参考资源

- [WSL 官方文档](https://learn.microsoft.com/en-us/windows/wsl/)
- [VSCode Remote-WSL 文档](https://code.visualstudio.com/docs/remote/wsl)
- [Claude Code 文档](https://docs.claude.com/en/docs/claude-code)

---

**最后更新**: 2025-10-07
**维护者**: AI Development Team
