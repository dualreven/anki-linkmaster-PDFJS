# Anki LinkMaster PDFJS

一个现代化的PDF查看和管理工具，基于PDF.js和WebSocket实时通信的事件驱动架构。

## 项目结构

```
anki-linkmaster-PDFJS/
├── src/
│   ├── frontend/                    # 前端模块
│   │   ├── pdf-home/               # PDF文件管理界面
│   │   ├── pdf-viewer/             # PDF查看器
│   │   └── common/                 # 共享基础设施
│   └── backend/                    # 后端模块
│       ├── msgCenter_server/       # WebSocket消息中心
│       ├── pdfFile_server/         # PDF文件服务
│       └── pdfTable_server/        # PDF表格服务
├── ai_launcher.py                  # 统一启动器
├── logs/                          # 日志目录
└── scripts/                       # 脚本工具
```

## 模块功能

### 前端模块

#### 1. pdf-home - PDF文件管理
**功能**: PDF文件列表管理、添加删除、表格显示
**技术栈**: JavaScript ES6+、Tabulator表格、事件驱动架构
**核心文件**:
- `index.js` - 主应用协调器（558行，事件驱动架构）
- `launcher.py` - Python启动器（272行，Qt集成）

**主要功能**:
- PDF文件列表显示和管理
- 文件添加、删除、双击打开
- 实时WebSocket通信
- Qt集成和日志捕获

#### 2. pdf-viewer - PDF查看器
**功能**: PDF文档查看、页面导航、缩放控制
**技术栈**: JavaScript ES6+、PDF.js、容器化依赖注入
**核心文件**:
- `main.js` - 应用主入口
- `app-core.js` - 核心协调器
- `launcher.py` - Python启动器

**主要功能**:
- PDF文档渲染和显示
- 页面导航（上一页、下一页、跳转）
- 缩放控制（放大、缩小、适应页面）
- WebSocket实时通信

#### 3. common - 共享基础设施
**功能**: EventBus、Logger、WSClient等共享组件
**技术栈**: JavaScript ES6+、模块化设计

### 后端模块

#### 1. msgCenter_server - WebSocket消息中心
**功能**: WebSocket服务器，处理实时通信
**技术栈**: Python 3.8+、WebSocket、JSON消息协议
**特性**: AES-256-GCM加密、HMAC验证、自动重连

#### 2. pdfFile_server - PDF文件服务
**功能**: HTTP文件服务器，提供PDF文件访问
**技术栈**: Python 3.8+、HTTP服务器、Range请求支持
**特性**: CORS支持、健康检查、UTF-8日志

#### 3. pdfTable_server - PDF表格服务
**功能**: PDF业务逻辑处理和数据管理
**技术栈**: Python 3.8+、WebSocket客户端

## 使用方法

### 环境要求
- **Node.js**: 16.0+ (推荐18.0+)
- **Python**: 3.8+ (推荐3.10+)
- **PyQt**: PyQt5 5.15+ 或 PyQt6 6.2+
- **包管理器**: pnpm (推荐) 或 npm

### 1. 快速启动（推荐）

使用统一启动器，自动管理所有服务：

```bash
# 启动PDF文件管理界面
python ai_launcher.py start --module pdf-home

# 启动PDF查看器
python ai_launcher.py start --module pdf-viewer

# 指定PDF文件启动查看器
python ai_launcher.py start --module pdf-viewer --pdf-id "document"

# 查看服务状态
python ai_launcher.py status

# 停止所有服务
python ai_launcher.py stop
```

### 2. 独立模块启动

如需单独启动某个模块：

```bash
# 启动后端服务
cd src/backend
python launcher.py start --module pdf-home

# 启动前端开发服务器（推荐使用pnpm）
pnpm install  # 首次运行
pnpm run dev

# 启动PDF查看器窗口
cd src/frontend/pdf-viewer
python launcher.py --file-path "path/to/document.pdf"
```

### 3. 开发模式

```bash
# 开发模式启动（包含热重载）
python ai_launcher.py start --module pdf-home --dev-mode

# 手动启动开发服务器
cd src/frontend/pdf-home
pnpm run dev -- --host 0.0.0.0 --port 3000
```

## 开发注意事项

### 优先级规则

1. **优先使用 ai_launcher.py**
   - 统一的服务管理
   - 自动端口分配和冲突检测
   - 完整的进程生命周期管理

2. **包管理器优先级：pnpm > npm**
   ```bash
   # 推荐使用 pnpm
   pnpm install
   pnpm run dev
   pnpm run build

   # 避免直接使用 npm（除非必要）
   # npm install  ❌
   # npm run dev  ❌
   ```

3. **避免安装新的Python库**
   - 项目已包含所需依赖
   - 新增依赖需要团队讨论
   - 优先使用内置模块和现有依赖

### 端口配置

系统支持灵活的端口配置，优先级：
1. 命令行参数
2. `logs/runtime-ports.json`
3. `logs/npm-dev-vite.log`
4. 默认端口

```json
// logs/runtime-ports.json 示例
{
  "vite_port": 3000,
  "msgCenter_port": 8765,
  "pdfFile_port": 8080
}
```

### 日志系统

- **Python日志**: `logs/pdf-home-{pdf_id}.log`、`logs/pdf-viewer-{pdf_id}.log`
- **JavaScript日志**: `logs/pdf-home-js.log`、`logs/pdf-viewer-{pdf_id}-js.log`
- **开发日志**: `logs/npm-dev-vite.log`、`logs/dev-process-info.json`

### 代码规范

1. **前端开发**
   - 使用ES6+语法，避免var
   - 私有字段使用#前缀
   - 事件驱动架构，通过EventBus通信
   - 所有函数需要JSDoc注释

2. **后端开发**
   - Python 3.8+兼容
   - UTF-8编码，Unix换行符(\n)
   - 统一使用logging模块
   - 模块化设计，单一职责原则

3. **测试要求**
   - 新功能必须有对应测试
   - 修改代码后运行测试验证
   - 使用Jest进行前端测试

### 调试技巧

1. **前端调试**
   ```bash
   # 查看实时日志
   tail -f logs/pdf-home-js.log

   # 检查WebSocket连接
   # 浏览器开发者工具 > Network > WS
   ```

2. **后端调试**
   ```bash
   # 查看Python日志
   tail -f logs/pdf-home-default.log

   # 检查端口占用
   netstat -an | grep 8765
   ```

3. **服务状态检查**
   ```bash
   # 检查所有服务状态
   python ai_launcher.py status

   # 检查健康状态
   curl http://localhost:8080/health
   ```

## 常见问题

### 启动问题
- **端口冲突**: 使用`python ai_launcher.py status`检查端口占用
- **模块导入错误**: 确认Python路径和依赖安装
- **前端加载失败**: 检查Vite开发服务器是否正常启动

### 通信问题
- **WebSocket连接失败**: 检查msgCenter_server是否启动
- **文件加载失败**: 检查pdfFile_server是否启动
- **Qt集成问题**: 确认PyQt版本兼容性

### 性能问题
- **PDF渲染慢**: 检查PDF文件大小，考虑使用缩略图
- **内存占用高**: 查看日志文件大小，定期清理
- **页面响应慢**: 检查WebSocket消息队列

---

**维护者**: Anki LinkMaster 开发团队
**最后更新**: 2025-09-27
**版本**: 2.1.0