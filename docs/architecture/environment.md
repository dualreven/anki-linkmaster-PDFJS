# 开发环境配置

## Python 虚拟环境

### 为什么使用虚拟环境

本项目**强制使用 Python 虚拟环境**进行开发，原因如下：

1. **依赖隔离** - 避免不同项目之间的依赖冲突
2. **版本控制** - 确保所有开发者使用相同的依赖版本
3. **清洁环境** - 防止系统全局包污染项目
4. **可重现性** - 便于在不同机器上复现相同的开发环境

### 虚拟环境类型

项目支持以下 Python 虚拟环境工具：

#### 1. venv (推荐，Python 内置)

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 退出虚拟环境
deactivate
```

#### 2. virtualenv

```bash
# 安装 virtualenv (如果未安装)
pip install virtualenv

# 创建虚拟环境
virtualenv venv

# 激活和使用方式与 venv 相同
```

#### 3. conda

```bash
# 创建虚拟环境
conda create -n anki-linkmaster python=3.10

# 激活虚拟环境
conda activate anki-linkmaster

# 安装依赖
pip install -r requirements.txt

# 退出虚拟环境
conda deactivate
```

### 依赖管理

项目依赖记录在以下文件中：

- `requirements.txt` - 核心 Python 依赖
- `package.json` - 前端 Node.js 依赖

#### Python 依赖安装

```bash
# 确保虚拟环境已激活
pip install -r requirements.txt

# 验证安装
pip list
```

#### Node.js 依赖安装

```bash
# 推荐使用 pnpm
pnpm install

# 或使用 npm
npm install
```

### 环境验证

安装完成后，验证关键依赖：

```bash
# 检查 Python 版本
python --version  # 应该是 3.8+

# 检查 PyQt
python -c "from PyQt6 import QtCore; print(QtCore.PYQT_VERSION_STR)"

# 检查 WebSocket 支持
python -c "from PyQt6.QtWebSockets import QWebSocket; print('WebSocket OK')"

# 检查 Node.js 版本
node --version  # 应该是 16.0+

# 检查 pnpm 版本
pnpm --version
```

## 目录结构与虚拟环境

### 推荐的目录结构

```
anki-linkmaster-PDFJS/
├── venv/                    # Python 虚拟环境 (Git 忽略)
├── node_modules/            # Node.js 依赖 (Git 忽略)
├── src/                     # 源代码
├── logs/                    # 运行日志 (Git 忽略)
├── data/                    # 数据目录 (Git 忽略)
├── requirements.txt         # Python 依赖
├── package.json             # Node.js 依赖
└── .gitignore              # Git 忽略配置
```

### .gitignore 配置

确保以下目录被 Git 忽略：

```gitignore
# Python 虚拟环境
venv/
env/
.venv/
.env/

# Node.js 依赖
node_modules/

# 运行时生成文件
logs/
data/
*.pyc
__pycache__/
.pytest_cache/
```

## IDE 配置

### VS Code

推荐的 `.vscode/settings.json` 配置：

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/venv/Scripts/python.exe",
  "python.terminal.activateEnvironment": true,
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black"
}
```

### PyCharm

1. **设置 Python 解释器**
   - File → Settings → Project → Python Interpreter
   - 选择 `<Project>/venv/Scripts/python.exe`

2. **标记目录类型**
   - 右键 `src` → Mark Directory as → Sources Root

## 常见问题

### Q: 如何知道虚拟环境是否已激活？

**A:** 命令行提示符前会显示虚拟环境名称：

```bash
# 未激活
C:\Projects\anki-linkmaster-PDFJS>

# 已激活 (venv)
(venv) C:\Projects\anki-linkmaster-PDFJS>
```

或执行：

```bash
python -c "import sys; print(sys.prefix)"
# 应该指向项目的 venv 目录，而非系统 Python
```

### Q: pip install 速度慢怎么办？

**A:** 使用国内镜像：

```bash
# 临时使用
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 永久配置 (推荐)
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

### Q: 虚拟环境损坏如何重建？

**A:** 删除后重新创建：

```bash
# Windows
rmdir /s venv
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Linux/macOS
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Q: 多个 Python 版本如何选择？

**A:** 使用 `py` 启动器（Windows）或指定路径：

```bash
# Windows - 使用 py 启动器
py -3.10 -m venv venv

# Linux/macOS - 指定 Python 路径
python3.10 -m venv venv
```

## 最佳实践

1. **总是在虚拟环境中开发**
   - 启动项目前先激活虚拟环境
   - 使用 IDE 自动激活功能

2. **不要全局安装项目依赖**
   - 避免 `pip install --user`
   - 避免系统级 `pip install`

3. **定期更新依赖**
   ```bash
   # 更新 requirements.txt
   pip list --outdated
   pip install --upgrade <package>
   pip freeze > requirements.txt

   # 更新 Node.js 依赖
   pnpm update
   ```

4. **团队协作**
   - 提交代码前更新 `requirements.txt`
   - 拉取代码后重新安装依赖
   - 遇到依赖问题先同步最新代码

## 环境变量

项目支持以下环境变量配置（可选）：

```bash
# WebSocket 端口
export MSGCENTER_PORT=8765

# HTTP 文件服务器端口
export PDFFILE_PORT=8080

# Vite 开发服务器端口
export VITE_PORT=3000

# 日志级别
export LOG_LEVEL=DEBUG

# 数据目录
export DATA_DIR=/path/to/data
```

**Windows 设置方式**：

```powershell
# 临时设置
$env:MSGCENTER_PORT=8765

# 永久设置（需要管理员权限）
[System.Environment]::SetEnvironmentVariable('MSGCENTER_PORT', '8765', 'User')
```

## 参考资料

- [Python venv 官方文档](https://docs.python.org/3/library/venv.html)
- [PyQt6 安装指南](https://www.riverbankcomputing.com/software/pyqt/)
- [pnpm 官方文档](https://pnpm.io/)

---

**维护记录**:
- 2025-01-09: 创建文档，明确 Python 虚拟环境要求
