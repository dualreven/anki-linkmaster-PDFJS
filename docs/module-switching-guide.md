# Anki LinkMaster PDFJS 模块切换指南（已对齐 ai_launcher）

## 概述

Anki LinkMaster PDFJS 通过统一启动器 `ai_launcher.py` 切换并启动不同的前端模块。请始终使用 `ai_launcher.py`（禁止直接运行 `python app.py` 或手工 `npm run dev`）。

## 使用方法

### 基本用法

```bash
# 启动 pdf-home 模块
python ai_launcher.py start --module pdf-home --logs-dir logs

# 启动 pdf-viewer 模块（可选：携带文档标识）
python ai_launcher.py start --module pdf-viewer --pdf-id sample --logs-dir logs
```

### 指定Vite端口

```bash
# 使用默认端口3000加载 pdf-home
python ai_launcher.py start --module pdf-home --logs-dir logs

# 指定 Vite 端口为 3001
python ai_launcher.py start --module pdf-home --vite-port 3001 --logs-dir logs

# 组合使用模块与端口参数
python ai_launcher.py start --module pdf-home --vite-port 3001 --logs-dir logs
```

说明
- `--logs-dir` 为必填参数（统一日志与进程信息输出目录），建议设为 `logs`。
- 其他端口：`--msgServer-port`（WS）、`--pdfFileServer-port`（HTTP）。

## 参数说明

| 参数 | 可选值 | 默认值 | 说明 |
|------|--------|--------|------|
| `--module` | `pdf-home`, `pdf-viewer` | 无 | 选择要加载的前端模块 |
| `--vite-port` | 任意整数 | 3000 | Vite 开发服务器端口 |
| `--msgServer-port` | 任意整数 | 8765 | WebSocket 端口 |
| `--pdfFileServer-port` | 任意整数 | 8080 | PDF 文件服务器端口 |
| `--pdf-id` | 字符串 | 无 | viewer 打开目标文档标识 |
| `--logs-dir` | 目录 | 必填 | 日志与进程信息输出目录 |

## 模块功能

### pdf-home 模块
- PDF文件管理界面
- 文件列表展示
- 文件添加/删除操作
- 表格视图

### pdf-viewer 模块
- PDF文档阅读器
- PDF.js集成
- 页面导航和缩放
- 文档预览

## 开发说明

### 技术实现

模块切换与服务编排通过以下组件实现：

1. **ai_launcher.py** - 根级统一启动器（参数解析、端口分配、进程生命周期管理、日志目录）
2. **src/frontend/** 各模块 `launcher.py` - 前端 Qt 容器与参数消费
3. **ai_scripts/** - 端口/日志/服务管理的可复用单元（若可用）

### URL生成规则

应用会根据模块和端口参数生成对应的URL：
```
http://localhost:{port}/{module}/index.html
```

例如：
- `--module pdf-home --vite-port 3000` → `http://localhost:3000/pdf-home/index.html`
- `--module pdf-viewer --vite-port 3001` → `http://localhost:3001/pdf-viewer/index.html`

## 注意事项

1. **Vite服务器**：确保Vite开发服务器正在运行，并且端口与参数指定的端口一致
2. **模块可用性**：确保对应的模块在Vite服务器中可用
3. **端口冲突**：如果端口被占用，应用可能无法正常加载前端页面
4. **统一入口**：仅使用 `ai_launcher.py`，不要直接执行 `python app.py` / `npm run dev`

## 故障排除

### 常见问题

1. **页面无法加载**：检查Vite服务器是否运行在指定端口
2. **模块不存在**：确认前端模块已正确构建和部署
3. **端口冲突**：使用 `--port` 参数指定其他可用端口

### 调试技巧

使用开发者工具（F12）查看网络请求和错误信息，例如：
```bash
python ai_launcher.py start --module pdf-home --logs-dir logs
```

## 版本历史

- **v1.1.0** (2025-11-03): 对齐统一入口 `ai_launcher.py`；移除 `app.py` 与短参示例
- **v1.0.0** (2025-09-14): 初始版本，支持模块切换功能

