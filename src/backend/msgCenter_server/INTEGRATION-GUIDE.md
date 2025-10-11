# WebSocket 服务器集成指南

## 📖 概述

使用 `EmbedMsgCenterServer` 可以将 WebSocket 服务器无缝集成到现有的 PyQt 应用中，**完全无阻塞**，共享主应用的 Qt 事件循环。

## ✨ 优势

| 特性 | 传统方式（独立进程） | 集成方式 |
|------|---------------------|---------|
| 启动方式 | 需要 subprocess | 直接创建对象 |
| 事件循环 | 阻塞在 `app.exec()` | 共享主应用事件循环 |
| 进程管理 | 需要 launcher.py | 无需额外管理 |
| 资源清理 | 手动 kill 进程 | 自动清理（随应用退出） |
| 通信方式 | WebSocket 消息 | 信号槽 + WebSocket |
| 性能 | 多进程开销 | 单进程，性能更好 |

## 🚀 快速开始

### 方式1：使用辅助函数（推荐）

```python
from PyQt6.QtWidgets import QApplication
from src.backend.msgCenter_server.embed_msgcenter import setup_embed_server
import sys

# 创建主应用
app = QApplication(sys.argv)

# 一行代码启动服务器（无阻塞）
server = setup_embed_server(app, port=8765)

if server:
    print(f"✅ 服务器已启动: ws://127.0.0.1:{server.port}")
else:
    print("❌ 服务器启动失败")

# 运行主应用（服务器在后台运行）
sys.exit(app.exec())
```

### 方式2：手动创建实例

```python
from PyQt6.QtWidgets import QApplication
from src.backend.msgCenter_server.embed_msgcenter import EmbedMsgCenterServer
import sys

app = QApplication(sys.argv)

# 创建服务器实例
server = EmbedMsgCenterServer(port=8765, parent=app)

# 连接信号（可选）
server.server_started.connect(lambda: print("🚀 服务器已启动"))
server.server_stopped.connect(lambda: print("🛑 服务器已停止"))
server.client_count_changed.connect(lambda count: print(f"📊 客户端数: {count}"))

# 启动服务器
if server.start():
    print("✅ 服务器启动成功")

# 应用退出时自动停止服务器
app.aboutToQuit.connect(server.stop)

sys.exit(app.exec())
```

## 🔌 集成到现有主窗口

### 修改 `pdf-home/main_window.py`

```python
# 在文件顶部添加导入
from src.backend.msgCenter_server.embed_msgcenter import EmbedMsgCenterServer

class MainWindow(QMainWindow):
    def __init__(self, app, ...):
        super().__init__()
        self.parent = app

        # ✅ 添加这一行：创建嵌入式服务器
        self.websocket_server = EmbedMsgCenterServer(port=8765, parent=self)

        # 连接服务器信号（可选）
        self.websocket_server.server_started.connect(self._on_server_started)
        self.websocket_server.client_count_changed.connect(self._on_client_count_changed)

        # 初始化UI...
        self._init_ui()
        self._init_menu()
        self._init_status_bar()

        # ✅ 启动服务器（无阻塞）
        if self.websocket_server.start():
            self.status_bar.showMessage('✅ WebSocket 服务器已启动')
        else:
            self.status_bar.showMessage('❌ WebSocket 服务器启动失败')

    def _on_server_started(self):
        """服务器启动回调"""
        self.status_bar.showMessage(f'✅ WebSocket 服务器: ws://127.0.0.1:{self.websocket_server.port}')

    def _on_client_count_changed(self, count: int):
        """客户端数量变化回调"""
        self.status_bar.showMessage(f'📊 已连接客户端: {count}')

    def closeEvent(self, event):
        """窗口关闭时自动停止服务器"""
        if hasattr(self, 'websocket_server'):
            self.websocket_server.stop()

        # 原有的关闭逻辑...
        event.accept()
```

### 修改 `pdf-home/launcher.py`

```python
from src.frontend.pdf_home.main_window import MainWindow

# 创建应用和主窗口
app = QApplication(sys.argv)
window = MainWindow(app, ...)

# ✅ 无需再启动独立的 WebSocket 进程
# ❌ 删除：subprocess.Popen(['python', '-m', 'src.backend.msgCenter_server.standard_server'])

# 显示窗口
window.show()

# 运行主应用（WebSocket 服务器自动在后台运行）
sys.exit(app.exec())
```

## 📡 API 参考

### EmbedMsgCenterServer

#### 构造函数

```python
server = EmbedMsgCenterServer(
    host="127.0.0.1",  # 监听地址
    port=8765,         # 监听端口
    parent=None        # 父 QObject（用于自动清理）
)
```

#### 方法

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `start()` | 启动服务器（无阻塞） | `bool` |
| `stop()` | 停止服务器 | `None` |
| `is_running()` | 检查服务器是否运行 | `bool` |
| `get_client_count()` | 获取客户端数量 | `int` |
| `broadcast_message(dict)` | 广播消息到所有客户端 | `None` |

#### 信号

| 信号 | 参数 | 说明 |
|------|------|------|
| `server_started` | - | 服务器启动成功 |
| `server_stopped` | - | 服务器停止 |
| `server_error` | `str` | 服务器错误，参数为错误信息 |
| `client_count_changed` | `int` | 客户端数量变化，参数为当前数量 |

## 🧪 测试示例

### 独立测试服务器

```bash
# 运行嵌入式服务器（测试）
python -m src.backend.msgCenter_server.embed_msgcenter
```

### 测试客户端（JavaScript）

```javascript
const ws = new WebSocket('ws://127.0.0.1:8765');

ws.onopen = () => {
    console.log('✅ 连接成功');
    ws.send(JSON.stringify({
        type: 'test',
        data: { message: 'Hello Server!' }
    }));
};

ws.onmessage = (event) => {
    console.log('📥 收到消息:', event.data);
};
```

## 🔄 迁移指南

### 从独立进程迁移

**旧方式（launcher.py）：**
```python
# ❌ 删除这些代码
import subprocess
process = subprocess.Popen([
    sys.executable, '-m',
    'src.backend.msgCenter_server.standard_server',
    '--port', '8765'
])
```

**新方式（embed_msgcenter）：**
```python
# ✅ 使用嵌入式服务器
from src.backend.msgCenter_server.embed_msgcenter import setup_embed_server

server = setup_embed_server(app, port=8765)
```

### 端口配置迁移

**旧方式（runtime-ports.json）：**
```json
{
  "msgCenter_port": 8765
}
```

**新方式（直接传参）：**
```python
# 从配置文件读取端口
import json
with open('logs/runtime-ports.json', 'r') as f:
    ports = json.load(f)
    ws_port = ports.get('msgCenter_port', 8765)

# 使用读取的端口
server = EmbedMsgCenterServer(port=ws_port)
```

## ⚠️ 注意事项

### 1. 不要混用独立进程和集成模式

```python
# ❌ 错误：同时运行两种模式会导致端口冲突
subprocess.Popen(['python', '-m', 'src.backend.msgCenter_server.standard_server'])
server = EmbedMsgCenterServer(port=8765)  # 端口被占用！
```

### 2. 确保在主线程创建服务器

```python
# ✅ 正确：在主线程创建
app = QApplication(sys.argv)
server = EmbedMsgCenterServer(parent=app)

# ❌ 错误：在子线程创建 Qt 对象会导致崩溃
from threading import Thread
Thread(target=lambda: EmbedMsgCenterServer()).start()
```

### 3. 服务器生命周期管理

```python
# ✅ 推荐：将服务器设为主窗口的成员变量
class MainWindow(QMainWindow):
    def __init__(self):
        self.server = EmbedMsgCenterServer(parent=self)

# ❌ 避免：局部变量可能被过早回收
def setup():
    server = EmbedMsgCenterServer()
    server.start()  # server 对象离开作用域后可能被销毁！
```

## 🐛 故障排查

### 问题1：端口被占用

**错误信息：**
```
❌ 服务器启动失败: The address is already in use
```

**解决方案：**
```bash
# Windows: 查看占用端口的进程
netstat -ano | findstr :8765

# 杀掉进程（替换 PID）
taskkill /PID <PID> /F

# 或者使用不同端口
server = EmbedMsgCenterServer(port=8766)
```

### 问题2：服务器未响应

**检查步骤：**
```python
# 1. 检查服务器是否运行
print(f"服务器运行状态: {server.is_running()}")

# 2. 检查客户端数量
print(f"客户端数量: {server.get_client_count()}")

# 3. 启用详细日志
import logging
logging.basicConfig(level=logging.DEBUG)
```

### 问题3：应用退出时服务器未关闭

**解决方案：**
```python
# 确保连接了 aboutToQuit 信号
app.aboutToQuit.connect(server.stop)

# 或在窗口关闭事件中手动停止
def closeEvent(self, event):
    self.server.stop()
    event.accept()
```

## 📚 进阶用法

### 自定义消息处理

```python
from src.backend.msgCenter_server.embed_msgcenter import EmbedMsgCenterServer

class CustomServer(EmbedMsgCenterServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # 连接标准服务器的消息信号
        if self._server:
            self._server.message_received.connect(self._on_custom_message)

    def _on_custom_message(self, client, message):
        """自定义消息处理"""
        msg_type = message.get('type')
        if msg_type == 'custom_action':
            # 处理自定义消息...
            response = {'status': 'ok', 'data': 'processed'}
            self.broadcast_message(response)
```

### 状态监控

```python
from PyQt6.QtCore import QTimer

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.server = EmbedMsgCenterServer(parent=self)

        # 定时监控服务器状态
        self.monitor_timer = QTimer(self)
        self.monitor_timer.timeout.connect(self._update_server_status)
        self.monitor_timer.start(5000)  # 每5秒检查一次

    def _update_server_status(self):
        """更新服务器状态显示"""
        if self.server.is_running():
            count = self.server.get_client_count()
            self.status_bar.showMessage(f'🟢 服务器运行中 | 客户端: {count}')
        else:
            self.status_bar.showMessage('🔴 服务器未运行')
```

## 🎯 最佳实践

1. **使用 parent 参数**：将服务器设为主应用的子对象，确保自动清理
2. **连接信号**：利用信号槽机制监控服务器状态
3. **异常处理**：始终检查 `start()` 返回值，处理启动失败的情况
4. **日志记录**：启用详细日志以便调试
5. **优雅退出**：在 `closeEvent` 或 `aboutToQuit` 中停止服务器

## 📞 支持

如有问题，请参考：
- `src/backend/msgCenter_server/embed_msgcenter.py` - 源代码
- `src/backend/msgCenter_server/standard_server.py` - 标准服务器实现
- 项目文档：`CROSS-PLATFORM-COMPATIBILITY.md`
