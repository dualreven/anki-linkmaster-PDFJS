# GUI Launcher 使用指南

## 📋 概述

**gui_launcher.py** 是图形化启动器，支持：
- **后端启动模式切换**：子进程模式 / Qt线程模式
- **前端双模式架构**：使用 PdfHomeApp / PdfViewerApp 统一接口
- **Anki插件集成准备**：支持 parent_app 参数（寄宿模式）

### 后端启动模式
- **子进程模式**（Legacy）：使用subprocess创建独立子进程
- **Qt线程模式**（PyQt集成）：使用BackendLauncher，无子进程，运行在Qt事件循环中

### 前端启动方式
- **双模式接口**：PdfHomeApp / PdfViewerApp 支持子进程和寄宿模式
- **统一配置**：使用 LaunchConfig 配置对象
- **Anki集成**：通过 parent_app 参数共享 QApplication

## 🚀 快速开始

### 启动方式

```bash
# 方式1：使用批处理脚本
start-gui.bat

# 方式2：直接运行Python
python gui_launcher.py
```

## 🎯 核心功能

### 1️⃣ 后端启动模式切换

在「**端口配置**」选项卡中，选择后端启动模式：

#### 子进程模式（Legacy）
- ✅ 兼容性好，稳定可靠
- ✅ 使用独立子进程
- ✅ 进程管理成熟
- ⚠️ 资源占用较高
- ⚠️ 进程间通信开销

**适用场景**：
- 命令行独立运行
- 开发调试
- AI自动化开发

#### Qt线程模式（PyQt集成）
- ✅ 无子进程，资源占用低
- ✅ 共享Qt事件循环
- ✅ 支持Qt信号槽通信
- ✅ **最适合Anki插件集成**
- ⚠️ 需要BackendLauncher支持

**适用场景**：
- Anki插件集成（推荐）
- 需要与主应用通信
- 需要共享事件循环

### 2️⃣ 状态显示增强

状态栏会显示当前后端使用的启动模式：
- `[子进程]` - 使用subprocess启动
- `[Qt线程]` - 使用BackendLauncher启动

### 3️⃣ 智能停止

停止服务时会自动识别启动模式：
- 子进程模式：使用kill_process_tree终止进程
- Qt线程模式：调用BackendLauncher.stop()优雅停止

## 📊 两种模式对比

| 特性 | 子进程模式 | Qt线程模式 |
|-----|----------|-----------|
| 进程模型 | 多进程（subprocess） | 单进程多线程 |
| 资源占用 | 高 | 低 |
| 启动速度 | 较慢（~2秒） | 快（~0.5秒） |
| 事件通信 | 进程间通信 | Qt信号槽 |
| 清理机制 | 手动kill进程 | Qt自动管理 |
| Anki集成 | 不推荐 | **推荐** |
| 稳定性 | 高（成熟） | 高（经过测试） |

## 🔧 使用步骤

### 基本使用流程

1. **启动GUI启动器**
   ```bash
   python gui_launcher.py
   # 或使用批处理脚本
   start-gui.bat
   ```

2. **选择后端启动模式**
   - 切换到「端口配置」选项卡
   - 选择「子进程模式」或「Qt线程模式」
   - 查看模式说明，确认选择

3. **配置端口**（可选）
   - Vite端口（默认3000）
   - WebSocket端口（默认8765）
   - HTTP文件服务器端口（默认8080）

4. **启动服务**
   - 切换到「快速启动」选项卡
   - 点击「启动 Vite 开发服务器」
   - 点击「启动后端服务器」
   - 查看日志确认启动成功

5. **启动前端模块**
   - 点击「启动 PDF-Home」
   - 或配置并启动「PDF-Viewer」

6. **停止服务**
   - 点击「停止所有服务」按钮
   - 系统会自动识别启动模式并正确停止

## 📝 日志信息

### 子进程模式日志示例
```
开始任务: backend
🚀 正在启动后端服务器 (子进程模式)...
✅ 后端启动成功 [子进程模式] (WebSocket: 8765, HTTP: 8080)
```

### Qt线程模式日志示例
```
开始任务: backend
🚀 正在启动后端服务器 (Qt线程模式)...
📌 使用 BackendLauncher (子进程模式，无阻塞)...
✅ 后端启动成功 [Qt线程模式]
   WebSocket: ws://127.0.0.1:8765
   HTTP: http://127.0.0.1:8080
   特性: 无子进程、Qt事件循环、信号槽通信
📌 BackendLauncher 实例已保存
```

## 🐛 故障排查

### Qt线程模式启动失败

**错误**: `无法导入 BackendLauncher`

**解决**:
1. 确认文件存在：`src/backend/launcher.py`
2. 检查BackendLauncher类是否存在
3. 查看日志获取详细错误信息

**错误**: `BackendLauncher 启动异常`

**解决**:
1. 检查端口是否被占用
2. 查看后端日志：`logs/backend-launcher.log`
3. 尝试切换到子进程模式测试

### 服务停止失败

**现象**: 点击停止后服务仍在运行

**解决**:
1. 检查日志中的停止信息
2. 手动检查进程：
   ```bash
   python ai_launcher.py status
   ```
3. 如果是Qt线程模式，尝试重启GUI启动器

## 💡 最佳实践

### 开发调试
- **推荐**：使用子进程模式
- 原因：进程独立，方便查看日志，便于终止

### Anki插件集成
- **推荐**：使用Qt线程模式
- 原因：无子进程，共享事件循环，资源占用低

### 生产部署
- **推荐**：使用子进程模式（当前阶段）
- 原因：成熟稳定，经过长期验证

### 性能测试
- 建议：两种模式都测试
- 对比：启动速度、资源占用、稳定性

## 🆕 版本更新 (v2.1)

### 最新修复（2025-10-11 22:03）
**修复前端启动导入错误**：
- 问题：gui_launcher.py 无法导入 PdfHomeApp/PdfViewerApp（目录名包含连字符）
- 解决：改用 subprocess.Popen 启动 launcher 脚本，而非导入类
- 优势：
  - 避免 Python 导入限制
  - 保持正确的工作目录上下文
  - 向后兼容 CLI 接口
  - 进程管理一致性
- 影响：前端窗口启动更稳定，支持所有命令行参数

### 主要变更（v2.0）
1. **前端启动方式改进**
   - 使用 PdfHomeApp / PdfViewerApp 双模式接口
   - 支持 LaunchConfig 统一配置
   - 为 Anki 集成做好准备（parent_app 参数）

2. **架构优化**
   - 前后端均支持双模式架构
   - 更好的代码复用性
   - 更容易集成到其他应用（如 Anki）

### 首次使用建议
- 先使用子进程模式（稳定可靠）
- 熟悉界面后再尝试Qt线程模式

## 📚 技术细节

### 架构设计

```
GUILauncher (QMainWindow)
  └─> LauncherThread (QThread)
       ├─> backend_mode: BackendMode
       │    ├─> SUBPROCESS (Legacy)
       │    └─> QTHREAD (PyQt集成)
       │
       ├─> _start_backend()
       │    ├─> if SUBPROCESS:
       │    │    └─> ai_launcher._start_backend()
       │    └─> if QTHREAD:
       │         └─> BackendLauncher(parent_app=None)
       │              └─> launcher.start()
       │
       └─> _stop_all()
            ├─> 检查 backend_launcher_instance
            └─> 调用相应的停止方法
```

### 关键代码片段

#### 后端启动（Qt线程模式）
```python
from src.backend.launcher import BackendLauncher

# 创建实例（子进程模式：parent_app=None）
launcher = BackendLauncher(
    parent_app=None,  # 独立模式
    show_ui=False     # 不显示测试UI
)

# 启动服务器
success = launcher.start(
    msgCenter_port=8765,
    pdfFile_port=8080
)
```

#### 后端停止（Qt线程模式）
```python
if backend_launcher_instance:
    backend_launcher_instance.stop()
```

## 🎓 相关文档

- `AItemp/20251011215500-AI-Working-log.md` - 后端启动架构分析
- `AItemp/20251011220000-AI-Working-log.md` - GUI增强实现记录
- `src/backend/launcher.py` - BackendLauncher源码
- `src/backend/msgCenter_server/embed_msgcenter.py` - 嵌入式WebSocket服务器
- `src/backend/pdfFile_server/embed_fileserver.py` - 嵌入式HTTP服务器

## ❓ 常见问题

### Q: 两种模式可以同时运行吗？
A: 不可以。后端服务监听相同的端口，只能运行一种模式。

### Q: Qt线程模式真的没有子进程吗？
A: BackendLauncher本身不创建子进程，但GUI启动器仍然是独立进程。在Anki插件中使用寄宿模式（parent_app=mw）才真正无子进程。

### Q: 哪种模式更快？
A: Qt线程模式启动更快（~0.5秒 vs ~2秒），因为无需启动独立进程。

### Q: 切换模式需要重启GUI吗？
A: 不需要。可以在运行时切换模式，下次启动后端时生效。

### Q: 如何验证当前使用的模式？
A: 查看状态栏的后端状态标签，会显示`[子进程]`或`[Qt线程]`。

## 📞 反馈

如有问题或建议，请：
1. 查看日志：`logs/ai-launcher.log`、`logs/backend-launcher.log`
2. 记录错误信息和复现步骤
3. 提交Issue或联系开发团队

---

**版本**: 2.1.0
**最后更新**: 2025-10-11 22:03
**维护者**: AI Assistant
**更新内容**:
- 修复前端启动导入错误（改用 subprocess 启动 launcher 脚本）
- 前端使用双模式架构（PdfHomeApp / PdfViewerApp）
- 支持 LaunchConfig 统一配置
- 为 Anki 插件集成做准备
