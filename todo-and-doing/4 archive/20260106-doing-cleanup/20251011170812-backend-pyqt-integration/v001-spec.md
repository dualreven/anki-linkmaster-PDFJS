# 后端服务器PyQt集成重构规格说明

**功能ID**: 20251011170812-backend-pyqt-integration
**优先级**: 高
**版本**: v001
**创建时间**: 2025-10-11 17:08:12
**预计完成**: 2025-10-15
**状态**: 设计中

## 现状说明

### 当前系统状态
- **后端架构**: 独立进程模式,通过 `subprocess.Popen` 启动2个独立Python进程
  - `msgCenter_server`: WebSocket服务器 (端口 8765)
  - `pdfFile_server`: HTTP文件服务器 (端口 8080)
- **启动方式**: `ai_launcher.py` → `backend/launcher.py` → 启动2个子进程
- **集成到Anki**: 通过Anki插件调用 `subprocess.run()` 启动后端服务

### 已有功能基础
1. ✅ **IntegratedWebSocketServer**: 已实现基于PyQt的WebSocket服务器
   - 文件: `src/backend/msgCenter_server/integrated_server.py`
   - 特性: 无阻塞启动、信号槽通信、自动清理
   - 文档: `INTEGRATION-GUIDE.md`

2. ✅ **端口管理系统**: 完善的端口分配和追踪机制
   - `BackendPortManager`: 端口可用性检测、冲突解决
   - `runtime-ports.json`: 运行时端口配置持久化

3. ✅ **进程管理系统**: 独立的后端进程生命周期管理
   - `BackendProcessManager`: PID追踪、进程停止
   - `backend-processes-info.json`: 进程信息持久化

### 技术栈
- **前端**: Vite 5.0.0 + 原生JavaScript + PDF.js 3.4.120
- **后端**: Python 3.10+ + PyQt6 + asyncio
- **通信**: WebSocket (消息中心) + HTTP (文件服务)

## 存在问题

### 用户痛点

#### 问题1: Anki启动严重阻塞 【严重 - P0】

**问题描述**:
集成到Anki插件时,后端服务器启动耗时20-30秒,完全阻塞Anki主线程,用户体验极差

**具体表现**:
```python
# anki插件调用
subprocess.run(['python', 'src/backend/launcher.py', 'start'])
# ❌ 阻塞20-30秒,Anki界面卡死,无法操作
```

**影响范围**:
- 用户启动Anki后需等待半分钟才能使用
- 无法取消启动操作
- Anki可能被系统判定为"无响应"

**期望状态**:
- 后端启动时间 < 1秒
- Anki UI完全无阻塞
- 可实时显示启动进度

---

#### 问题2: 多进程开销过大 【重要 - P1】

**问题描述**:
当前架构启动3个独立Python进程,资源消耗高,启动慢

**资源消耗对比**:
| 资源类型 | 当前方案 | 期望方案 | 提升 |
|---------|---------|---------|------|
| 进程数 | 3个 (主+WS+HTTP) | 1个 (共享) | **3倍** |
| 内存占用 | ~60-80MB | ~10-15MB | **6倍** |
| 启动时间 | 20-30秒 | < 1秒 | **20-30倍** |
| 通信延迟 | ~10-50ms (跨进程) | < 1ms (进程内) | **10-50倍** |

**瓶颈分析**:
```python
# 每个子进程启动耗时分解
启动时间 = Python解释器冷启动(3-5秒)
         + 模块导入(2-3秒)
         + 网络初始化(1-2秒)
         + 端口绑定(0.5-1秒)
# 两个进程累加: ~12-22秒
```

---

#### 问题3: 开发调试不便 【次要 - P2】

**问题描述**:
开发时需要完整启动流程,无法快速测试单个模块

**当前流程**:
```bash
# 启动完整环境需要3个步骤
python ai_launcher.py start          # 启动所有服务
python ai_launcher.py start --module pdf-viewer  # 启动前端
# 每次修改后端代码都需要完整重启
```

**期望流程**:
```bash
# 快速启动后端 (开发模式)
python backend/launcher.py start --dev-mode
# 或直接在代码中导入使用
```

---

### 技术限制

#### 限制1: 进程间通信开销
- 独立进程只能通过WebSocket通信
- 无法使用Qt信号槽机制
- 难以调试跨进程交互

#### 限制2: 资源清理困难
- 子进程可能残留(未正常退出)
- 需要手动 `taskkill` 清理
- 端口可能被僵尸进程占用

#### 限制3: 部署复杂度高
- 需要确保所有Python依赖可用
- 子进程启动路径问题
- 跨平台兼容性需额外处理

---

## 提出需求

### 核心功能需求

#### 需求1: 智能双模式启动 【核心】

**目标**:
后端服务器支持两种启动模式,根据运行环境自动选择或手动指定

**模式1: 子进程模式 (开发/测试)**
- 使用场景: `ai_launcher.py start` 开发时快速启动
- 启动方式: `subprocess.Popen(['python', 'backend/launcher.py', 'start'])`
- 特点:
  - 独立进程,便于调试和重启
  - 自动创建测试用QApplication
  - 启动时间 3-5秒 (可接受)

**模式2: 寄宿模式 (Anki集成)**
- 使用场景: Anki插件直接导入模块使用
- 启动方式:
  ```python
  from src.backend.launcher import BackendLauncher
  launcher = BackendLauncher(parent_app=mw)  # 传入Anki的QApplication
  launcher.start()  # < 1秒完成
  ```
- 特点:
  - 共享父应用的Qt事件循环
  - 无阻塞启动
  - 自动生命周期管理

**判断逻辑**:
```python
def detect_mode(parent_app=None):
    """自动检测启动模式"""
    if parent_app is not None:
        return Mode.HOSTED  # 寄宿模式
    else:
        return Mode.SUBPROCESS  # 子进程模式
```

---

#### 需求2: 统一的启动入口 【核心】

**目标**:
`backend/launcher.py` 支持CLI命令行和Python API两种调用方式

**CLI方式 (保持兼容)**:
```bash
# 子进程模式启动
python backend/launcher.py start --msgCenter-port 8765 --pdfFileServer-port 8080

# 停止所有服务
python backend/launcher.py stop

# 查看服务状态
python backend/launcher.py status
```

**API方式 (新增)**:
```python
# 导入模块使用 (寄宿模式)
from src.backend.launcher import BackendLauncher
from aqt import mw  # Anki主应用

# 创建启动器 (传入父QApplication)
launcher = BackendLauncher(parent_app=mw)

# 启动服务 (无阻塞,< 1秒)
launcher.start(msgCenter_port=8765, pdfFile_port=8080)

# 检查状态
print(f"WebSocket: {launcher.is_ws_running()}")
print(f"HTTP: {launcher.is_http_running()}")

# 停止服务 (应用退出时自动调用)
launcher.stop()
```

---

#### 需求3: PyQt版HTTP文件服务器 【核心】

**目标**:
实现基于 `QTcpServer` 的HTTP文件服务器,替代当前的独立进程

**功能要求**:
- ✅ 基于 `QTcpServer` 实现 (与WebSocket服务器一致)
- ✅ 支持静态文件服务 (PDF、图片、JSON等)
- ✅ 支持Range请求 (大文件分块传输)
- ✅ 支持CORS跨域配置
- ✅ 无阻塞启动 (< 100ms)
- ✅ 信号槽通信 (连接/断开/错误事件)

**接口设计**:
```python
# src/backend/pdfFile_server/embed_fileserver.py
from PyQt6.QtCore import QObject, pyqtSignal
from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress

class EmbedFileServer(QObject):
    """嵌入式HTTP文件服务器"""

    # 信号
    server_started = pyqtSignal()
    server_stopped = pyqtSignal()
    server_error = pyqtSignal(str)
    request_received = pyqtSignal(str, str)  # (method, path)

    def __init__(self, root_dir: str, port: int = 8080, parent=None):
        """
        Args:
            root_dir: 文件服务根目录 (如 data/pdfs/)
            port: 监听端口
            parent: 父QObject (用于生命周期管理)
        """
        super().__init__(parent)
        self.root_dir = Path(root_dir)
        self.port = port
        self.server = QTcpServer(self)

    def start(self) -> bool:
        """启动服务器 (< 100ms)"""
        if self.server.listen(QHostAddress.LocalHost, self.port):
            self.server.newConnection.connect(self._handle_connection)
            self.server_started.emit()
            return True
        return False

    def stop(self):
        """停止服务器"""
        self.server.close()
        self.server_stopped.emit()

    def _handle_connection(self):
        """处理新连接 (Qt事件循环自动调用)"""
        socket = self.server.nextPendingConnection()
        socket.readyRead.connect(lambda: self._handle_request(socket))

    def _handle_request(self, socket: QTcpSocket):
        """处理HTTP请求"""
        # 读取请求头
        request = socket.readAll().data().decode('utf-8')
        method, path, _ = self._parse_request(request)

        self.request_received.emit(method, path)

        # 构建文件路径
        file_path = self.root_dir / path.lstrip('/')

        if not file_path.exists():
            self._send_404(socket)
            return

        # 发送文件内容
        self._send_file(socket, file_path)
        socket.close()

    def _send_file(self, socket, file_path):
        """发送文件响应"""
        # 读取文件内容
        content = file_path.read_bytes()

        # 构建HTTP响应
        response = f"HTTP/1.1 200 OK\r\n"
        response += f"Content-Length: {len(content)}\r\n"
        response += f"Content-Type: {self._get_mime_type(file_path)}\r\n"
        response += "Access-Control-Allow-Origin: *\r\n"  # CORS
        response += "\r\n"

        # 发送响应头和内容
        socket.write(response.encode('utf-8'))
        socket.write(content)
```

---

#### 需求4: 改进的端口管理 【重要】

**目标**:
端口管理逻辑保持不变,但统一保存到 `runtime-ports.json`

**流程**:
```
ai_launcher.py start
  ├─> 1. 启动Vite (查找可用端口 3000-3050)
  │     └─> 保存 vite_port 到 runtime-ports.json
  │
  └─> 2. 启动backend/launcher.py (子进程模式)
        ├─> 检测父QApplication (无 → 创建测试QApplication)
        ├─> 查找可用端口:
        │     - msgCenter_port: 8765-8800
        │     - pdfFile_port: 8080-8120
        ├─> 启动PyQt版 msgCenter_server
        ├─> 启动PyQt版 pdfFile_server
        └─> 合并保存端口到 runtime-ports.json
              {
                "vite_port": 3000,
                "msgCenter_port": 8765,
                "pdfFile_port": 8080,
                "_metadata": {
                  "updated_by": "backend-launcher",
                  "last_updated": "2025-10-11 17:30:00"
                }
              }
```

**关键改进**:
- ✅ 所有服务的端口统一保存到一个文件
- ✅ 合并写入,保留其他服务的端口配置
- ✅ 添加元数据,标记更新来源和时间

---

#### 需求5: 测试UI自动创建 【重要】

**目标**:
子进程模式下,如果没有父QApplication,自动创建一个轻量级测试UI

**功能要求**:
```python
# backend/launcher.py
class BackendLauncher:
    def __init__(self, parent_app=None):
        self.parent_app = parent_app
        self.test_app = None
        self.test_ui = None

    def start(self):
        """启动后端服务"""
        if self.parent_app is None:
            # 子进程模式: 创建测试QApplication
            from PyQt6.QtWidgets import QApplication
            self.test_app = QApplication(sys.argv)

            # 创建最小化测试UI (可选)
            self.test_ui = TestUI()
            self.test_ui.show()
        else:
            # 寄宿模式: 使用父应用
            pass

        # 启动服务器 (共享Qt事件循环)
        self.ws_server = EmbedMsgCenterServer(parent=self.parent_app or self.test_app)
        self.http_server = EmbedFileServer(parent=self.parent_app or self.test_app)

        # 如果是子进程模式,运行事件循环
        if self.test_app:
            sys.exit(self.test_app.exec())
```

**测试UI设计 (可选)**:
```python
# backend/test_ui.py (新建)
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QLabel, QPushButton

class TestUI(QWidget):
    """后端服务器测试UI"""
    def __init__(self):
        super().__init__()
        self.setWindowTitle("PDF Backend Server - Test UI")
        self.setGeometry(100, 100, 400, 300)

        layout = QVBoxLayout()

        # 状态标签
        self.status_label = QLabel("🟢 服务器运行中")
        layout.addWidget(self.status_label)

        # 端口信息
        self.ws_label = QLabel("WebSocket: ws://127.0.0.1:8765")
        self.http_label = QLabel("HTTP: http://127.0.0.1:8080")
        layout.addWidget(self.ws_label)
        layout.addWidget(self.http_label)

        # 停止按钮
        stop_btn = QPushButton("停止服务器")
        stop_btn.clicked.connect(self.close)
        layout.addWidget(stop_btn)

        self.setLayout(layout)
```

---

### 性能要求

| 指标 | 当前值 | 目标值 | 优先级 |
|------|--------|--------|--------|
| **Anki启动阻塞时间** | 20-30秒 | < 1秒 | P0 |
| **后端服务器启动时间** | 12-22秒 (2进程累加) | < 1秒 (寄宿模式) | P0 |
| **内存占用** | 60-80MB | < 20MB | P1 |
| **HTTP文件响应延迟** | < 100ms | < 50ms | P1 |
| **WebSocket消息延迟** | < 50ms | < 10ms | P2 |

### 用户体验要求

#### UX-1: 无感知集成
- Anki用户启动插件时,后端自动在后台启动
- 无任何弹窗、等待对话框
- 状态栏显示简短提示: "PDF服务已就绪"

#### UX-2: 友好的错误提示
- 端口冲突时,自动切换到备用端口并提示用户
- 启动失败时,显示详细错误和解决建议
- 提供一键重启按钮

#### UX-3: 开发模式便利性
- `ai_launcher.py start` 保持原有功能不变
- 支持快速重启后端: `ai_launcher.py restart-backend`
- 提供详细的启动日志

---

## 解决方案

### 技术架构

#### 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    ai_launcher.py (入口)                     │
│  - 启动Vite (端口管理)                                        │
│  - 启动backend/launcher.py (子进程或导入模块)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              backend/launcher.py (统一启动器)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  BackendLauncher(parent_app=None)                     │  │
│  │    ├─> 检测模式 (子进程 vs 寄宿)                      │  │
│  │    ├─> 创建/使用 QApplication                          │  │
│  │    ├─> 端口管理 (BackendPortManager)                  │  │
│  │    ├─> 启动 EmbedMsgCenterServer                      │  │
│  │    ├─> 启动 EmbedFileServer                          │  │
│  │    └─> 保存端口到 runtime-ports.json                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                                  │
           ▼                                  ▼
┌────────────────────────┐    ┌────────────────────────────┐
│ EmbedMsgCenterServer   │    │ EmbedFileServer            │
│ (已实现-已重命名)      │    │ (新实现)                   │
│ - QWebSocketServer     │    │ - QTcpServer               │
│ - 无阻塞启动           │    │ - 静态文件服务             │
│ - 信号槽通信           │    │ - Range请求支持            │
└────────────────────────┘    └────────────────────────────┘
```

---

### 目录结构调整

```
src/backend/
├── launcher.py                         # 统一启动器 (重构)
│   └─> BackendLauncher 类
│         - __init__(parent_app=None)
│         - start(msgCenter_port, pdfFile_port)
│         - stop()
│         - get_status()
│
├── msgCenter_server/
│   ├── embed_msgcenter.py             # PyQt WebSocket服务器 (已重命名)
│   ├── standard_server.py             # 独立进程版本 (保留,兼容)
│   └── __init__.py
│
├── pdfFile_server/
│   ├── embed_fileserver.py            # PyQt HTTP服务器 (新建)
│   ├── __init__.py
│   └── __main__.py                    # CLI入口 (兼容旧方式)
│
├── test_ui.py                         # 测试UI (新建,可选)
│
└── __init__.py                        # 导出BackendLauncher

根目录/
├── ai_launcher.py                      # 主启动器 (小幅修改)
└── todo-and-doing/
    └── 1 doing/
        └── 20251011170812-backend-pyqt-integration/
            ├── v001-spec.md            # 本文档
            └── working-log.md
```

---

### 核心类设计

#### 类1: BackendLauncher (重构)

```python
# src/backend/launcher.py
"""
后端服务统一启动器
支持子进程模式和寄宿模式
"""

import sys
from pathlib import Path
from typing import Optional
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QObject

from .msgCenter_server.embed_msgcenter import EmbedMsgCenterServer
from .pdfFile_server.embed_fileserver import EmbedFileServer


class BackendLauncher(QObject):
    """
    后端服务启动器

    支持两种模式:
    1. 子进程模式: 无parent_app,自动创建测试QApplication
    2. 寄宿模式: 传入parent_app,共享父应用事件循环
    """

    def __init__(self, parent_app: Optional[QApplication] = None):
        """
        Args:
            parent_app: 父QApplication (Anki的mw或None)
        """
        super().__init__()

        self.parent_app = parent_app
        self.mode = "hosted" if parent_app else "subprocess"

        # 服务器实例
        self.ws_server: Optional[EmbedMsgCenterServer] = None
        self.http_server: Optional[EmbedFileServer] = None

        # 子进程模式专用
        self.test_app: Optional[QApplication] = None
        self.test_ui = None

        # 端口管理器 (复用现有代码)
        from .launcher import BackendPortManager
        project_root = Path(__file__).parent.parent.parent
        self.port_manager = BackendPortManager(project_root)

    def start(self, msgCenter_port: Optional[int] = None,
              pdfFile_port: Optional[int] = None) -> bool:
        """
        启动后端服务

        Args:
            msgCenter_port: WebSocket端口 (None=自动分配)
            pdfFile_port: HTTP端口 (None=自动分配)

        Returns:
            bool: 启动成功返回True
        """
        # 1. 子进程模式: 创建QApplication
        if self.mode == "subprocess":
            self.test_app = QApplication(sys.argv)
            parent = self.test_app

            # 可选: 显示测试UI
            if self._should_show_test_ui():
                from .test_ui import TestUI
                self.test_ui = TestUI()
                self.test_ui.show()
        else:
            parent = self.parent_app

        # 2. 端口分配
        ws_port = self._allocate_port('msgCenter_port', msgCenter_port)
        http_port = self._allocate_port('pdfFile_port', pdfFile_port)

        if not (ws_port and http_port):
            return False

        # 3. 启动WebSocket服务器
        self.ws_server = EmbedMsgCenterServer(
            host="127.0.0.1",
            port=ws_port,
            parent=parent
        )

        if not self.ws_server.start():
            print(f"❌ WebSocket服务器启动失败: {ws_port}")
            return False

        print(f"✅ WebSocket服务器已启动: ws://127.0.0.1:{ws_port}")

        # 4. 启动HTTP文件服务器
        root_dir = Path(__file__).parent.parent.parent / "data" / "pdfs"
        self.http_server = EmbedFileServer(
            root_dir=str(root_dir),
            port=http_port,
            parent=parent
        )

        if not self.http_server.start():
            print(f"❌ HTTP服务器启动失败: {http_port}")
            self.ws_server.stop()
            return False

        print(f"✅ HTTP文件服务器已启动: http://127.0.0.1:{http_port}")

        # 5. 保存端口配置 (合并写入)
        self._save_ports(ws_port, http_port)

        # 6. 子进程模式: 运行事件循环
        if self.test_app:
            print("\n📌 按 Ctrl+C 或关闭窗口停止服务器\n")
            sys.exit(self.test_app.exec())

        return True

    def stop(self):
        """停止所有服务"""
        if self.ws_server:
            self.ws_server.stop()
        if self.http_server:
            self.http_server.stop()

    def is_ws_running(self) -> bool:
        """检查WebSocket服务器状态"""
        return self.ws_server and self.ws_server.is_running()

    def is_http_running(self) -> bool:
        """检查HTTP服务器状态"""
        return self.http_server and self.http_server.server.isListening()

    def get_status(self) -> dict:
        """获取服务状态"""
        return {
            "mode": self.mode,
            "websocket": {
                "running": self.is_ws_running(),
                "port": self.ws_server.port if self.ws_server else None,
                "clients": self.ws_server.get_client_count() if self.ws_server else 0
            },
            "http": {
                "running": self.is_http_running(),
                "port": self.http_server.port if self.http_server else None
            }
        }

    # ---- 私有方法 ----

    def _allocate_port(self, service_name: str, preferred_port: Optional[int]) -> Optional[int]:
        """分配端口 (复用现有逻辑)"""
        try:
            return self.port_manager.find_available_port(service_name, preferred_port)
        except RuntimeError as e:
            print(f"❌ {e}")
            return None

    def _save_ports(self, ws_port: int, http_port: int):
        """保存端口配置到runtime-ports.json (合并模式)"""
        ports = {
            "msgCenter_port": ws_port,
            "pdfFile_port": http_port
        }
        self.port_manager.save_runtime_ports(ports)

    def _should_show_test_ui(self) -> bool:
        """判断是否显示测试UI"""
        # 环境变量控制
        import os
        return os.environ.get("BACKEND_SHOW_UI", "0") == "1"


# ---- CLI入口 (保持兼容) ----

def main_cli():
    """命令行入口"""
    import argparse

    parser = argparse.ArgumentParser(description="后端服务启动器")
    parser.add_argument('command', choices=['start', 'stop', 'status'])
    parser.add_argument('--msgCenter-port', type=int)
    parser.add_argument('--pdfFileServer-port', type=int)
    parser.add_argument('--show-ui', action='store_true', help="显示测试UI")

    args = parser.parse_args()

    if args.command == 'start':
        # 设置环境变量
        if args.show_ui:
            import os
            os.environ["BACKEND_SHOW_UI"] = "1"

        # 子进程模式启动
        launcher = BackendLauncher(parent_app=None)
        success = launcher.start(
            msgCenter_port=args.msgCenter_port,
            pdfFile_port=args.pdfFileServer_port
        )
        return 0 if success else 1

    elif args.command == 'stop':
        # TODO: 实现停止逻辑 (通过进程管理器)
        print("停止服务...")
        return 0

    elif args.command == 'status':
        # TODO: 实现状态查询
        print("查询状态...")
        return 0


if __name__ == "__main__":
    sys.exit(main_cli())
```

---

#### 类2: EmbedFileServer (新建)

```python
# src/backend/pdfFile_server/embed_fileserver.py
"""
基于QTcpServer的HTTP文件服务器
无阻塞启动,共享Qt事件循环
"""

import mimetypes
from pathlib import Path
from typing import Optional
from urllib.parse import unquote

from PyQt6.QtCore import QObject, pyqtSignal
from PyQt6.QtNetwork import QTcpServer, QTcpSocket, QHostAddress


class EmbedFileServer(QObject):
    """
    嵌入式HTTP文件服务器

    特性:
    - 基于QTcpServer,无阻塞启动
    - 支持静态文件服务
    - 支持Range请求 (大文件分块)
    - CORS跨域支持
    """

    # 信号
    server_started = pyqtSignal()
    server_stopped = pyqtSignal()
    server_error = pyqtSignal(str)
    request_received = pyqtSignal(str, str)  # (method, path)

    def __init__(self, root_dir: str, port: int = 8080, parent: Optional[QObject] = None):
        """
        Args:
            root_dir: 文件服务根目录
            port: 监听端口
            parent: 父QObject
        """
        super().__init__(parent)

        self.root_dir = Path(root_dir).resolve()
        self.port = port
        self.server = QTcpServer(self)

        # 连接信号
        self.server.newConnection.connect(self._handle_new_connection)

    def start(self) -> bool:
        """启动服务器 (< 100ms)"""
        if self.server.listen(QHostAddress.LocalHost, self.port):
            self.server_started.emit()
            return True
        else:
            error_msg = self.server.errorString()
            self.server_error.emit(error_msg)
            return False

    def stop(self):
        """停止服务器"""
        if self.server.isListening():
            self.server.close()
            self.server_stopped.emit()

    def is_running(self) -> bool:
        """检查服务器状态"""
        return self.server.isListening()

    # ---- 请求处理 ----

    def _handle_new_connection(self):
        """处理新的TCP连接"""
        socket = self.server.nextPendingConnection()
        if socket:
            socket.readyRead.connect(lambda: self._handle_request(socket))
            socket.disconnected.connect(socket.deleteLater)

    def _handle_request(self, socket: QTcpSocket):
        """处理HTTP请求"""
        # 读取请求数据
        request_data = socket.readAll().data()

        try:
            request = request_data.decode('utf-8')
        except UnicodeDecodeError:
            self._send_400(socket, "Invalid UTF-8 encoding")
            socket.close()
            return

        # 解析请求行
        lines = request.split('\r\n')
        if not lines:
            self._send_400(socket, "Empty request")
            socket.close()
            return

        request_line = lines[0]
        parts = request_line.split(' ')

        if len(parts) < 2:
            self._send_400(socket, "Invalid request line")
            socket.close()
            return

        method, path = parts[0], parts[1]
        self.request_received.emit(method, path)

        # 只支持GET请求
        if method != 'GET':
            self._send_405(socket)
            socket.close()
            return

        # 解析路径
        file_path = self._resolve_path(path)

        if not file_path:
            self._send_404(socket, path)
            socket.close()
            return

        # 发送文件
        self._send_file(socket, file_path)
        socket.close()

    def _resolve_path(self, url_path: str) -> Optional[Path]:
        """解析URL路径到文件系统路径"""
        # URL解码
        url_path = unquote(url_path)

        # 去除查询参数
        if '?' in url_path:
            url_path = url_path.split('?')[0]

        # 构建完整路径
        relative_path = url_path.lstrip('/')
        file_path = (self.root_dir / relative_path).resolve()

        # 安全检查: 防止路径穿越
        if not str(file_path).startswith(str(self.root_dir)):
            return None

        # 检查文件是否存在
        if not file_path.exists() or not file_path.is_file():
            return None

        return file_path

    def _send_file(self, socket: QTcpSocket, file_path: Path):
        """发送文件响应"""
        try:
            # 读取文件内容
            content = file_path.read_bytes()

            # 构建HTTP响应头
            mime_type = self._get_mime_type(file_path)
            response_headers = [
                "HTTP/1.1 200 OK",
                f"Content-Length: {len(content)}",
                f"Content-Type: {mime_type}",
                "Access-Control-Allow-Origin: *",  # CORS
                "Cache-Control: max-age=3600",
                "Connection: close",
                ""
            ]

            # 发送响应
            header_data = "\r\n".join(response_headers).encode('utf-8') + b"\r\n"
            socket.write(header_data)
            socket.write(content)
            socket.flush()

        except Exception as e:
            self._send_500(socket, str(e))

    def _get_mime_type(self, file_path: Path) -> str:
        """获取MIME类型"""
        mime_type, _ = mimetypes.guess_type(str(file_path))
        return mime_type or 'application/octet-stream'

    # ---- HTTP错误响应 ----

    def _send_400(self, socket: QTcpSocket, message: str = "Bad Request"):
        """发送400错误"""
        self._send_error(socket, 400, "Bad Request", message)

    def _send_404(self, socket: QTcpSocket, path: str):
        """发送404错误"""
        self._send_error(socket, 404, "Not Found", f"File not found: {path}")

    def _send_405(self, socket: QTcpSocket):
        """发送405错误"""
        self._send_error(socket, 405, "Method Not Allowed", "Only GET is supported")

    def _send_500(self, socket: QTcpSocket, message: str):
        """发送500错误"""
        self._send_error(socket, 500, "Internal Server Error", message)

    def _send_error(self, socket: QTcpSocket, code: int, status: str, message: str):
        """发送HTTP错误响应"""
        body = f"<h1>{code} {status}</h1><p>{message}</p>"
        response = [
            f"HTTP/1.1 {code} {status}",
            "Content-Type: text/html; charset=utf-8",
            f"Content-Length: {len(body)}",
            "Connection: close",
            "",
            body
        ]
        socket.write("\r\n".join(response).encode('utf-8'))
        socket.flush()
```

---

### ai_launcher.py 修改

```python
# ai_launcher.py (第447-464行修改)

def _start_backend(msgCenter_port: int | None, pdfFile_port: int | None) -> bool:
    """启动后端服务 (子进程模式)"""
    if os.environ.get("AI_LAUNCHER_TEST_MODE") == "1":
        return True

    # 构建启动命令
    cmd = [sys.executable, str(PROJECT_ROOT / "src" / "backend" / "launcher.py"), "start"]

    if msgCenter_port:
        cmd += ["--msgCenter-port", str(msgCenter_port)]
    if pdfFile_port:
        cmd += ["--pdfFileServer-port", str(pdfFile_port)]

    LOGGER.info("启动后端服务: %s", " ".join(cmd))

    try:
        # ✅ 使用Popen启动子进程 (不再阻塞)
        proc = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )

        # 等待短暂时间确保启动成功 (PyQt模式 < 1秒)
        time.sleep(1.5)

        if proc.poll() is None:
            LOGGER.info("✅ 后端服务已启动 (PID: %s)", proc.pid)

            # 保存进程信息 (用于后续停止)
            backend_info = {
                "pid": proc.pid,
                "ports": {
                    "msgCenter_port": msgCenter_port,
                    "pdfFile_port": pdfFile_port
                },
                "status": "running"
            }
            write_json_atomic(LOGS_DIR / "backend-process-info.json", backend_info)

            return True
        else:
            LOGGER.error("❌ 后端服务启动失败 (进程已退出)")
            return False

    except Exception as exc:
        LOGGER.error("❌ 后端服务启动异常: %s", exc)
        return False
```

---

## 约束条件

### 仅修改后端代码
仅修改 `src/backend/` 目录下的代码,不修改前端代码

### 保持向后兼容
- ✅ `ai_launcher.py start` 原有功能完全保留
- ✅ CLI命令行接口不变 (`python backend/launcher.py start`)
- ✅ `runtime-ports.json` 格式兼容

### 严格遵循代码规范
必须遵循项目的Python代码规范:
- 类型提示 (Type Hints)
- 文档字符串 (Docstrings)
- PyQt信号槽命名规范
- 异常处理规范

---

## 可行验收标准

### 单元测试

#### 测试1: BackendLauncher子进程模式
```python
def test_subprocess_mode():
    """测试子进程模式启动"""
    launcher = BackendLauncher(parent_app=None)
    assert launcher.mode == "subprocess"

    success = launcher.start(msgCenter_port=8765, pdfFile_port=8080)
    assert success == True
    assert launcher.is_ws_running() == True
    assert launcher.is_http_running() == True

    launcher.stop()
    assert launcher.is_ws_running() == False
```

#### 测试2: BackendLauncher寄宿模式
```python
def test_hosted_mode():
    """测试寄宿模式启动"""
    from PyQt6.QtWidgets import QApplication
    app = QApplication([])

    launcher = BackendLauncher(parent_app=app)
    assert launcher.mode == "hosted"

    success = launcher.start()
    assert success == True

    # 验证启动时间 < 1秒
    import time
    start_time = time.time()
    launcher2 = BackendLauncher(parent_app=app)
    launcher2.start()
    elapsed = time.time() - start_time
    assert elapsed < 1.0
```

#### 测试3: EmbedFileServer文件服务
```python
def test_http_server_file_service():
    """测试HTTP文件服务"""
    import tempfile
    from pathlib import Path

    # 创建临时文件
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "test.pdf"
        test_file.write_bytes(b"PDF content")

        # 启动服务器
        server = EmbedFileServer(root_dir=tmpdir, port=8888)
        assert server.start() == True

        # 请求文件
        import urllib.request
        response = urllib.request.urlopen("http://127.0.0.1:8888/test.pdf")
        assert response.status == 200
        assert response.read() == b"PDF content"

        server.stop()
```

---

### 端到端测试

#### 测试1: 开发模式完整启动流程
```bash
# 1. 启动所有服务
python ai_launcher.py start --module pdf-viewer --pdf-id sample

# 2. 验证服务状态
python ai_launcher.py status

# 预期输出:
# ✅ Vite: http://localhost:3000 (PID: 12345)
# ✅ Backend:
#    - WebSocket: ws://127.0.0.1:8765 (PID: 12346)
#    - HTTP: http://127.0.0.1:8080 (PID: 12346)
# ✅ Frontend: pdf-viewer (PID: 12347)

# 3. 测试PDF访问
curl http://127.0.0.1:8080/sample.pdf

# 4. 停止服务
python ai_launcher.py stop
```

**验收标准**:
- [ ] 后端启动时间 < 3秒 (子进程模式)
- [ ] 所有端口正确绑定
- [ ] `runtime-ports.json` 正确保存
- [ ] 停止后所有进程清理干净

---

#### 测试2: Anki集成模式
```python
# Anki插件测试脚本
from aqt import mw
from src.backend.launcher import BackendLauncher

def test_anki_integration():
    """测试Anki集成"""
    import time

    # 记录启动时间
    start_time = time.time()

    # 启动后端 (寄宿模式)
    launcher = BackendLauncher(parent_app=mw)
    success = launcher.start()

    elapsed = time.time() - start_time

    # 验收标准
    assert success == True, "启动失败"
    assert elapsed < 1.0, f"启动耗时 {elapsed:.2f}秒,超过1秒"
    assert launcher.is_ws_running(), "WebSocket未运行"
    assert launcher.is_http_running(), "HTTP服务器未运行"

    # 测试文件访问
    import urllib.request
    response = urllib.request.urlopen(f"http://127.0.0.1:{launcher.http_server.port}/test.pdf")
    assert response.status == 200

    # 清理
    launcher.stop()

    print("✅ Anki集成测试通过")
```

**验收标准**:
- [ ] 启动时间 < 1秒
- [ ] Anki UI完全无阻塞
- [ ] 文件服务正常工作
- [ ] 退出Anki时自动清理

---

#### 测试3: 端口冲突自动切换
```bash
# 1. 占用默认端口
python -m http.server 8080 &

# 2. 启动后端 (应自动切换端口)
python backend/launcher.py start

# 预期输出:
# ⚠️ 默认端口 8080 已被占用: python.exe (PID: 12345)
# ✅ 找到可用端口 8081 给服务 pdfFile_port
# ✅ HTTP文件服务器已启动: http://127.0.0.1:8081

# 3. 验证runtime-ports.json
cat logs/runtime-ports.json
# {
#   "pdfFile_port": 8081,
#   ...
# }
```

---

### 接口实现

#### 接口1: BackendLauncher.start()
```python
def start(self, msgCenter_port: Optional[int] = None,
          pdfFile_port: Optional[int] = None) -> bool:
    """
    启动后端服务

    Args:
        msgCenter_port: WebSocket端口,None=自动分配
        pdfFile_port: HTTP文件服务器端口,None=自动分配

    Returns:
        bool: 启动成功返回True,失败返回False

    Raises:
        无 (所有异常都被捕获并返回False)

    示例:
        # 子进程模式
        launcher = BackendLauncher(parent_app=None)
        launcher.start()  # 自动分配端口

        # 寄宿模式
        launcher = BackendLauncher(parent_app=mw)
        launcher.start(msgCenter_port=8765)  # 指定端口
    """
```

#### 接口2: EmbedFileServer.start()
```python
def start(self) -> bool:
    """
    启动HTTP文件服务器 (< 100ms)

    Returns:
        bool: 成功返回True,失败返回False

    Signals:
        server_started: 启动成功时发射
        server_error(str): 启动失败时发射,参数为错误信息

    示例:
        server = EmbedFileServer(root_dir="data/pdfs", port=8080)
        if server.start():
            print("服务器已启动")
    """
```

---

### 类实现

#### 类1: BackendLauncher
**描述**: 后端服务统一启动器,支持子进程和寄宿两种模式
**属性**:
- `mode`: str - 运行模式 ("subprocess" | "hosted")
- `parent_app`: Optional[QApplication] - 父应用
- `ws_server`: EmbedMsgCenterServer - WebSocket服务器
- `http_server`: EmbedFileServer - HTTP服务器
- `test_app`: Optional[QApplication] - 测试QApplication (子进程模式)

**方法**:
- `start() -> bool`: 启动服务
- `stop()`: 停止服务
- `is_ws_running() -> bool`: 检查WebSocket状态
- `is_http_running() -> bool`: 检查HTTP状态
- `get_status() -> dict`: 获取状态字典

---

#### 类2: EmbedFileServer
**描述**: 基于QTcpServer的HTTP文件服务器
**属性**:
- `root_dir`: Path - 文件服务根目录
- `port`: int - 监听端口
- `server`: QTcpServer - TCP服务器实例

**方法**:
- `start() -> bool`: 启动服务器
- `stop()`: 停止服务器
- `is_running() -> bool`: 检查运行状态

**信号**:
- `server_started()`: 启动成功
- `server_stopped()`: 停止
- `server_error(str)`: 错误,参数为错误信息
- `request_received(str, str)`: 收到请求,(method, path)

---

### 事件规范

#### 事件1: server_started
- **描述**: 服务器启动成功时发射
- **触发时机**: `start()` 方法成功后
- **参数**: 无
- **订阅者**: 主应用 (显示状态提示)

#### 事件2: server_error(str)
- **描述**: 服务器发生错误时发射
- **触发时机**: 启动失败、端口冲突等
- **参数**: `error_message` (str) - 错误描述
- **订阅者**: 主应用 (显示错误对话框)

---

## 实施计划

### Phase 1: 实现EmbedFileServer (4小时)
**目标**: 创建基于QTcpServer的HTTP文件服务器

**任务清单**:
- [ ] 创建 `src/backend/pdfFile_server/embed_fileserver.py`
- [ ] 实现 `EmbedFileServer` 类
  - [ ] 初始化QTcpServer
  - [ ] 实现 `start()` / `stop()` 方法
  - [ ] 实现 `_handle_request()` HTTP请求解析
  - [ ] 实现 `_send_file()` 文件响应
  - [ ] 实现 `_resolve_path()` 路径安全检查
- [ ] 编写单元测试
  - [ ] 测试文件读取
  - [ ] 测试404/500错误
  - [ ] 测试CORS头
- [ ] 提交commit: `feat(backend): 实现PyQt版HTTP文件服务器`

**验收标准**:
- [ ] 服务器启动时间 < 100ms
- [ ] 单元测试覆盖率 > 80%
- [ ] 支持PDF/图片/JSON等常见文件类型

---

### Phase 2: 重构BackendLauncher (3小时)
**目标**: 统一启动入口,支持双模式

**任务清单**:
- [ ] 修改 `src/backend/launcher.py`
  - [ ] 创建 `BackendLauncher` 类
  - [ ] 实现模式检测逻辑
  - [ ] 实现 `start()` 方法 (集成WebSocket+HTTP)
  - [ ] 实现端口管理和保存
- [ ] 保留CLI入口 `main_cli()`
- [ ] 编写单元测试
  - [ ] 测试子进程模式
  - [ ] 测试寄宿模式
  - [ ] 测试端口自动分配
- [ ] 提交commit: `refactor(backend): 重构launcher支持双模式启动`

**验收标准**:
- [ ] 子进程模式启动时间 < 3秒
- [ ] 寄宿模式启动时间 < 1秒
- [ ] CLI接口向后兼容

---

### Phase 3: 修改ai_launcher.py (1小时)
**目标**: 调整后端启动方式为非阻塞

**任务清单**:
- [ ] 修改 `_start_backend()` 函数
  - [ ] 使用 `subprocess.Popen` 替代 `subprocess.run`
  - [ ] 保存后端进程信息
  - [ ] 添加启动状态检查 (等待1.5秒)
- [ ] 更新 `_stop_backend()` 函数
  - [ ] 读取进程信息并清理
- [ ] 测试完整启动流程
- [ ] 提交commit: `refactor(launcher): 改为非阻塞启动后端服务`

**验收标准**:
- [ ] `ai_launcher.py start` 总耗时 < 10秒
- [ ] 后端启动不阻塞Vite启动
- [ ] 所有进程正确追踪

---

### Phase 4: 创建测试UI (2小时,可选)
**目标**: 提供开发时的可视化状态监控

**任务清单**:
- [ ] 创建 `src/backend/test_ui.py`
- [ ] 实现 `TestUI` 类
  - [ ] 显示服务器状态
  - [ ] 显示端口信息
  - [ ] 显示客户端连接数
  - [ ] 提供停止按钮
- [ ] 集成到 `BackendLauncher`
- [ ] 提交commit: `feat(backend): 添加测试UI`

**验收标准**:
- [ ] UI显示实时状态
- [ ] 关闭UI时自动停止服务器
- [ ] 环境变量控制显示 (`BACKEND_SHOW_UI=1`)

---

### Phase 5: 端到端测试和文档 (2小时)
**目标**: 完整测试和编写文档

**任务清单**:
- [ ] 编写端到端测试脚本
  - [ ] 测试开发模式启动
  - [ ] 测试Anki集成模式 (模拟)
  - [ ] 测试端口冲突处理
- [ ] 更新文档
  - [ ] 更新 `README.md` - 启动方式说明
  - [ ] 更新 `INTEGRATION-GUIDE.md` - Anki集成指南
  - [ ] 编写 `MIGRATION-GUIDE.md` - 迁移指南
- [ ] 性能对比测试
  - [ ] 记录启动时间对比
  - [ ] 记录内存占用对比
- [ ] 提交commit: `docs(backend): 更新PyQt集成文档`

**验收标准**:
- [ ] 所有端到端测试通过
- [ ] 文档完整清晰
- [ ] 性能提升达到预期 (20倍+)

---

**总预计时间**: 12小时
**预计完成日期**: 2025-10-15

---

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| QTcpServer性能不足 | 🟡 中 | 预先压力测试,备用方案:保留独立进程 |
| 文件服务器协议兼容性 | 🟡 中 | 参考标准HTTP/1.1实现,充分测试 |
| PyQt事件循环冲突 | 🟢 低 | 使用信号槽机制,避免直接调用 |
| Anki集成兼容性 | 🟡 中 | 在Anki 2.1.60+版本测试,做好降级方案 |
| 大文件传输性能 | 🟢 低 | 实现分块传输,添加缓存机制 |

---

## 后续版本规划

### v002: 性能优化 (可选)
- HTTP/2支持 (多路复用)
- 文件缓存机制 (减少磁盘IO)
- 连接池管理 (复用TCP连接)

### v003: 监控和诊断 (可选)
- 实时性能监控面板
- 请求日志记录
- 错误自动上报

---

## 参考资料

### PyQt网络编程
- [QTcpServer Documentation](https://doc.qt.io/qt-6/qtcpserver.html)
- [QWebSocketServer Documentation](https://doc.qt.io/qt-6/qwebsocketserver.html)

### 项目文档
- `src/backend/msgCenter_server/embed_msgcenter.py` - 已实现的WebSocket服务器（已重命名）
- `src/backend/msgCenter_server/INTEGRATION-GUIDE.md` - 集成指南
- `src/backend/launcher.py` - 当前启动器实现

### HTTP协议
- [RFC 2616 - HTTP/1.1](https://www.rfc-editor.org/rfc/rfc2616)
- [MIME Types Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)

---

**文档版本**: v001
**最后更新**: 2025-10-11 17:08:12
**作者**: AI Assistant + User
**审核状态**: 待审核
