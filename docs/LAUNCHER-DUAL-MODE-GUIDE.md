# Launcher Dual-Mode Guide

前端 launcher (pdf-home 和 pdf-viewer) 双模式使用指南

## 📋 概述

pdf-home 和 pdf-viewer 的 launcher 已经支持两种运行模式：

1. **子进程模式**（Subprocess Mode）：独立运行，自己创建 QApplication
2. **寄宿模式**（Hosted Mode）：使用外部传入的 QApplication（如 Anki）

## 🎯 核心组件

### LaunchConfig 配置类

统一的启动参数配置类，位于 `src/frontend/common/launch_config.py`

```python
from src.frontend.common.launch_config import LaunchConfig

# 从命令行参数构造
config = LaunchConfig.from_args(args)

# 从代码直接构造（仅通过 pdf_id 选择文档，导航由前端 Feature/WS 驱动）
config = LaunchConfig(
    pdf_id="sample",
    is_prod=True,
    source="anki"
)
```

### 支持的参数

```python
@dataclass
class LaunchConfig:
    # 运行模式
    is_prod: bool = False                # 生产模式/开发模式
    use_vite: bool = True                # 是否使用 Vite

    # 端口配置
    vite_port: Optional[int] = None
    msgCenter_port: Optional[int] = None
    pdfFile_port: Optional[int] = None
    js_debug_port: Optional[int] = None

    # PDF-Viewer 专用参数
    pdf_id: Optional[str] = None         # PDF 标识符（通过 URL 仅用于选择文档，不再承担导航语义）
    file_path: Optional[str] = None      # PDF 文件路径（已不推荐，优先使用 pdf_id）

    # 控制参数
    keep_backend: bool = False           # 窗口关闭时保持后端运行
    no_persist: bool = False             # 不持久化端口配置

    # 元数据
    source: str = "cli"                  # 启动来源
    extra_params: dict = field(default_factory=dict)

    # 诊断模式
    diagnose_only: bool = False
    disable_webchannel: bool = False
    disable_websocket: bool = False
    disable_js_console: bool = False
    disable_frontend_load: bool = False
```

## 📖 使用示例

### 1. CLI 模式（子进程）

#### PDF-Home

```bash
# 开发模式
python src/frontend/pdf-home/launcher.py

# 生产模式
python src/frontend/pdf-home/launcher.py --prod

# 指定端口
python src/frontend/pdf-home/launcher.py \
    --vite-port 3000 \
    --msgCenter-port 8765 \
    --pdfFile-port 8080

# 保持后端运行
python src/frontend/pdf-home/launcher.py --keep-backend
```

#### PDF-Viewer

```bash
# 基本用法（仅通过 pdf-id 选择文档）
python src/frontend/pdf-viewer/launcher.py --pdf-id sample

# 生产模式
python src/frontend/pdf-viewer/launcher.py \
    --pdf-id sample \
    --prod
```

### 2. 代码模式（子进程）

#### PDF-Home

```python
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_home.launcher import PdfHomeApp
import sys

# 创建配置
config = LaunchConfig(
    is_prod=False,
    vite_port=3000,
    msgCenter_port=8765,
    pdfFile_port=8080
)

# 创建并运行应用（子进程模式）
app = PdfHomeApp(config, parent_app=None)
sys.exit(app.run())
```

#### PDF-Viewer

```python
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_viewer.launcher import PdfViewerApp
import sys

# 创建配置
config = LaunchConfig(
    pdf_id="sample",
    is_prod=False
)

# 创建并运行应用（子进程模式）
app = PdfViewerApp(config, parent_app=None)
sys.exit(app.run())
```

### 3. Anki 插件集成（寄宿模式）

#### PDF-Home

```python
from aqt import mw  # Anki 主应用
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_home.launcher import PdfHomeApp

# 创建配置
config = LaunchConfig(
    is_prod=True,
    msgCenter_port=8765,
    pdfFile_port=8080,
    source="anki"
)

# 使用 Anki 的 QApplication（寄宿模式）
app = PdfHomeApp(config, parent_app=mw.app)
app.run()  # 不会阻塞，返回 0

# 窗口在 Anki 的事件循环中运行
```

#### PDF-Viewer

```python
from aqt import mw  # Anki 主应用
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_viewer.launcher import PdfViewerApp

# 创建配置
config = LaunchConfig(
    pdf_id="sample",
    is_prod=True,
    source="anki",
    keep_backend=True  # Anki 环境下通常保持后端运行
)

# 使用 Anki 的 QApplication（寄宿模式）
app = PdfViewerApp(config, parent_app=mw.app)
app.run()  # 不会阻塞，返回 0

# 窗口在 Anki 的事件循环中运行
```

### 4. 其他集成示例

#### 从 pdf-home 打开 pdf-viewer

```python
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_viewer.launcher import PdfViewerApp

def open_pdf_viewer(pdf_id: str, parent_app=None):
    """从 pdf-home 打开 pdf-viewer"""
    config = LaunchConfig(
        pdf_id=pdf_id,
        is_prod=False,
        source="home"  # 标识来源
    )

    # 如果在寄宿模式下，使用相同的 QApplication
    app = PdfViewerApp(config, parent_app=parent_app)
    return app.run()
```

#### 按钮点击唤醒

```python
from src.frontend.common.launch_config import LaunchConfig
from src.frontend.pdf_viewer.launcher import PdfViewerApp

def on_button_click(pdf_id: str):
    """按钮点击处理"""
    config = LaunchConfig(
        pdf_id=pdf_id,
        is_prod=True,
        source="button"  # 标识来源
    )

    app = PdfViewerApp(config)
    return app.run()
```

## 🔍 模式对比

| 特性 | 子进程模式 | 寄宿模式 |
|------|----------|---------|
| QApplication | 自己创建 | 使用外部传入 |
| 事件循环 | 运行 `app.exec()` | 不运行（共享外部） |
| 返回值 | 事件循环退出码 | 立即返回 0 |
| 独立性 | 完全独立 | 依赖父应用 |
| 适用场景 | CLI、独立运行 | Anki集成、嵌入应用 |

## 📝 注意事项

### 1. 端口配置优先级

```
命令行参数 > 配置对象 > runtime-ports.json > 默认值
```

### 1.1 Windows + QtWebEngine：loopback host 一致性（避免动态 import 拉取失败）

现象（示例）：
- `Failed to fetch dynamically imported module: http://localhost:3000/pdf-home/index.js`

原因（高频）：
- Windows 下 `localhost` 可能解析到 `::1`（IPv6 loopback），而 QtWebEngine/系统网络栈在某些链路里走 `127.0.0.1`（IPv4 loopback），导致“页面能打开但模块动态 import fetch 失败”。

约定（开发模式）：
- Vite dev server 默认监听 `127.0.0.1`（可用 `VITE_HOST` 覆盖）。
- Launcher 侧生成的 dev URL 应统一使用 `http://127.0.0.1:<url_port>/...`。

建议点检（PowerShell）：
```powershell
curl.exe -I "http://127.0.0.1:3000/@vite/client"
curl.exe -I "http://127.0.0.1:3000/pdf-home/index.js"
```

如需手工覆盖 Vite 监听地址：
```powershell
$env:VITE_HOST="127.0.0.1"
pnpm -s run dev
```

### 2. 日志文件命名

- **pdf-home**: `logs/pdf-home.log` 和 `logs/pdf-home-js.log`
- **pdf-viewer**: `logs/pdf-viewer-{pdf_id}.log` 和 `logs/pdf-viewer-{pdf_id}-js.log`

### 3. 后端服务管理

- 默认行为：窗口关闭时停止后端服务
- 保持运行：使用 `keep_backend=True` 或 `--keep-backend` 参数

### 4. 寄宿模式限制

- 不能运行多个 QApplication 实例
- 窗口关闭不会退出父应用
- 需要手动管理窗口生命周期

## 🚀 最佳实践

### 1. 使用配置对象

```python
# ✅ 推荐：使用配置对象
config = LaunchConfig(pdf_id="sample", page_at=5)
app = PdfViewerApp(config)

# ❌ 不推荐：直接传参（已废弃）
```

### 2. 明确指定模式

```python
# ✅ 推荐：明确指定 parent_app
app = PdfViewerApp(config, parent_app=None)      # 子进程模式
app = PdfViewerApp(config, parent_app=mw.app)    # 寄宿模式

# ⚠️ 可行但不明确
app = PdfViewerApp(config)  # 默认子进程模式
```

### 3. 标识启动来源

```python
config = LaunchConfig(
    pdf_id="sample",
    source="anki"  # 便于日志追踪和调试
)
```

### 4. 生产环境配置

```python
config = LaunchConfig(
    pdf_id="sample",
    is_prod=True,           # 使用生产模式
    keep_backend=True,      # 保持后端运行
    no_persist=False,       # 持久化端口配置
    source="production"
)
```

## 🐛 调试

### 启用诊断模式

```bash
python src/frontend/pdf-viewer/launcher.py \
    --pdf-id sample \
    --diagnose-only
```

### 禁用特定组件

```bash
python src/frontend/pdf-viewer/launcher.py \
    --pdf-id sample \
    --disable-webchannel \
    --disable-websocket \
    --disable-js-console
```

### 查看配置

```python
config = LaunchConfig(pdf_id="sample", page_at=5)
print(config.to_dict())
# 输出：{'is_prod': False, 'pdf_id': 'sample', 'page_at': 5, ...}
```

## 📚 相关文档

- `src/frontend/common/launch_config.py` - 配置类源码
- `src/frontend/pdf-home/launcher.py` - PDF-Home launcher 源码
- `src/frontend/pdf-viewer/launcher.py` - PDF-Viewer launcher 源码
- `src/backend/launcher.py` - 后端 launcher（参考架构）

## 🔄 迁移指南

### 从旧版 CLI 迁移

```python
# 旧版（已废弃）
python src/frontend/pdf-viewer/launcher.py --file-path data/pdfs/sample.pdf

# 新版（推荐）
python src/frontend/pdf-viewer/launcher.py --pdf-id sample
```

### 从旧版代码迁移

```python
# 旧版（已废弃）
app = PdfViewerApp(sys.argv)
app.run()

# 新版（推荐）
from src.frontend.common.launch_config import LaunchConfig

config = LaunchConfig.from_args(args)
app = PdfViewerApp(config, parent_app=None)
app.run()
```

## ✅ 总结

- **简单场景**：使用 CLI 命令直接启动
- **复杂场景**：使用 LaunchConfig 配置对象
- **Anki 集成**：使用寄宿模式（parent_app=mw.app）
- **调试开发**：使用子进程模式（parent_app=None）
